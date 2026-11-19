-- ============================================================================
-- VEYLENTRA — WINTER FESTIVAL PERSISTENCE, XP LEDGER & BYTE QUOTA REPAIR SQL
-- Safe to run multiple times (completely idempotent, zero destructive drops).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Ensure winter_user_profiles has all durable state columns & safety checks
ALTER TABLE IF EXISTS public.winter_user_profiles
  ADD COLUMN IF NOT EXISTS claimed_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS earned_winter_badges JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS santa_claimed_nights JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reward_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'winter_user_profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_winter_cookies_nonneg') THEN
      ALTER TABLE public.winter_user_profiles
        ADD CONSTRAINT chk_winter_cookies_nonneg CHECK (cookies_count >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_winter_shields_bounds') THEN
      ALTER TABLE public.winter_user_profiles
        ADD CONSTRAINT chk_winter_shields_bounds CHECK (streak_shields >= 0 AND streak_shields <= 3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_winter_ai_bonus_bounds') THEN
      ALTER TABLE public.winter_user_profiles
        ADD CONSTRAINT chk_winter_ai_bonus_bounds CHECK (ai_bonus_credits_today >= 0 AND ai_bonus_credits_today <= 5);
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_winter_user_profiles_cookies
  ON public.winter_user_profiles(cookies_count DESC);

-- 2. Physically enforce max 1 Santa Gift per user per IST night across concurrent instances
CREATE UNIQUE INDEX IF NOT EXISTS idx_winter_reward_ledger_santa_unique_night
  ON public.winter_reward_ledger(user_id, feature_type, event_night_key)
  WHERE feature_type = 'santa_gift' AND event_night_key IS NOT NULL;

-- 3. Ensure gamification_xp_ledger dedup index & query indexes exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_gamification_xp_ledger_dedup
  ON public.gamification_xp_ledger(user_id, action_key);

CREATE INDEX IF NOT EXISTS idx_gamification_xp_ledger_user_time
  ON public.gamification_xp_ledger(user_id, created_at DESC);

-- 4. Durable Byte AI Rolling 24h Usage Logs, Redeemed Vouchers & Role Limits
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL DEFAULT 'student',
  feature TEXT NOT NULL DEFAULT 'ai_buddy',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created
  ON public.ai_usage_logs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_user_vouchers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  voucher_code TEXT NOT NULL,
  bonus_queries INTEGER NOT NULL DEFAULT 0 CHECK (bonus_queries >= 0),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, voucher_code)
);

CREATE INDEX IF NOT EXISTS idx_ai_user_vouchers_user
  ON public.ai_user_vouchers(user_id);

CREATE TABLE IF NOT EXISTS public.ai_role_limits (
  role TEXT PRIMARY KEY,
  daily_limit INTEGER NOT NULL CHECK (daily_limit > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ai_role_limits (role, daily_limit)
VALUES
  ('student', 30),
  ('teacher', 75),
  ('coordinator', 100),
  ('admin', 150),
  ('super_admin', 150)
ON CONFLICT (role) DO NOTHING;

-- 5. Enable RLS & policies consistent with existing server-keyed Veylentra tables
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_user_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_role_limits ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_usage_logs',
    'ai_user_vouchers',
    'ai_role_limits'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'veylentra_public_rw_' || t
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)', 'veylentra_public_rw_' || t, t);
    END IF;
  END LOOP;
END $$;

-- 6. Safe, additive backfill of missing historical regular XP into user_profiles & gamification_xp_ledger
-- Computes ONLY missing delta (GREATEST(0, max_historical_xp - existing_ledger_sum)) so all-time totals reconcile without inflating weekly deltas or double-counting.
DO $$
DECLARE
  rec RECORD;
  uid_val TEXT;
  xp_val INTEGER;
  led_sum INTEGER;
  prof_pts INTEGER;
  target_xp INTEGER;
  missing_delta INTEGER;
  uname TEXT;
  urole TEXT;
  ugrade TEXT;
  usection TEXT;
  uhouse TEXT;
  uavatar TEXT;
  min_led_at TIMESTAMPTZ;
  ts_val TIMESTAMPTZ;
BEGIN
  FOR rec IN
    SELECT id, data, updated_at
    FROM public.global_data
    WHERE id LIKE 'gamification_user_%'
      AND data IS NOT NULL
  LOOP
    uid_val := COALESCE(NULLIF(rec.data->>'userId', ''), REPLACE(rec.id, 'gamification_user_', ''));
    IF uid_val IS NULL OR uid_val = '' THEN
      CONTINUE;
    END IF;

    xp_val := CASE
      WHEN (rec.data->>'xp') ~ '^\d+$' THEN (rec.data->>'xp')::integer
      ELSE 0
    END;

    SELECT COALESCE(MAX(points), 0) INTO prof_pts
    FROM public.user_profiles
    WHERE id::text = uid_val OR uid = uid_val;

    SELECT COALESCE(SUM(GREATEST(0, xp_delta)), 0), MIN(created_at)
      INTO led_sum, min_led_at
    FROM public.gamification_xp_ledger
    WHERE user_id = uid_val;

    target_xp := GREATEST(COALESCE(xp_val, 0), COALESCE(prof_pts, 0), COALESCE(led_sum, 0));
    IF target_xp <= 0 THEN
      CONTINUE;
    END IF;

    missing_delta := GREATEST(0, target_xp - COALESCE(led_sum, 0));

    uname := COALESCE(NULLIF(rec.data->>'userName', ''), NULLIF(rec.data->>'name', ''), 'Member');
    urole := LOWER(COALESCE(NULLIF(rec.data->>'role', ''), 'student'));
    ugrade := COALESCE(rec.data->>'grade', '');
    usection := COALESCE(rec.data->>'section', '');
    uhouse := COALESCE(rec.data->>'house', '');
    uavatar := COALESCE(NULLIF(rec.data->>'avatar', ''), NULLIF(rec.data->>'photoURL', ''), '');

    -- Sync user_profiles.points safely (never overwrite higher value)
    UPDATE public.user_profiles
    SET points = GREATEST(COALESCE(points, 0), target_xp)
    WHERE id::text = uid_val OR uid = uid_val;

    IF missing_delta <= 0 THEN
      CONTINUE;
    END IF;

    ts_val := COALESCE(min_led_at - INTERVAL '2 days', NOW() - INTERVAL '14 days');
    BEGIN
      IF rec.data->>'updatedAt' IS NOT NULL AND rec.data->>'updatedAt' <> '' THEN
        IF (rec.data->>'updatedAt')::timestamptz < ts_val THEN
          ts_val := (rec.data->>'updatedAt')::timestamptz;
        END IF;
      ELSIF rec.updated_at IS NOT NULL AND rec.updated_at < ts_val THEN
        ts_val := rec.updated_at;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      ts_val := COALESCE(min_led_at - INTERVAL '2 days', NOW() - INTERVAL '14 days');
    END;

    -- Idempotently insert ONLY the un-ledgered historical reconciliation delta in <=150 XP chunks
    IF NOT EXISTS (
      SELECT 1 FROM public.gamification_xp_ledger
      WHERE user_id = uid_val AND action_key LIKE 'migration:historical_xp_reconciliation%'
    ) THEN
      DECLARE
        v_rem INTEGER := missing_delta;
        v_part INTEGER := 1;
        v_chunk INTEGER;
      BEGIN
        WHILE v_rem > 0 LOOP
          v_chunk := LEAST(150, v_rem);
          v_rem := v_rem - v_chunk;
          INSERT INTO public.gamification_xp_ledger (
            id, user_id, user_name, user_role, grade, section, house, avatar,
            source_type, action_key, xp_delta, label, created_at
          )
          VALUES (
            'xp_recon_' || substr(md5(uid_val), 1, 14) || '_' || v_part::text,
            uid_val,
            uname,
            urole,
            ugrade,
            usection,
            uhouse,
            uavatar,
            'academic',
            'migration:historical_xp_reconciliation:' || v_part::text,
            v_chunk,
            'Historical Regular XP Reconciliation',
            ts_val
          )
          ON CONFLICT (user_id, action_key) DO NOTHING;
          v_part := v_part + 1;
        END LOOP;
      END;
    END IF;
  END LOOP;
END $$;
