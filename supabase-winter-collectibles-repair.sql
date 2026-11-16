-- ============================================================================
-- VEYLENTRA — WINTER COLLECTIBLES, BORDERS & SECURE RLS MIGRATION
-- Safe & idempotent: can be executed multiple times in Supabase SQL Editor.
-- Preserves all existing user inventory, badges, frames, XP, and reward logs.
-- ============================================================================

-- 1. Additive Winter Borders & Collectibles columns on winter_user_profiles
ALTER TABLE public.winter_user_profiles
  ADD COLUMN IF NOT EXISTS unlocked_borders JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipped_border TEXT,
  ADD COLUMN IF NOT EXISTS claimed_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS earned_winter_badges JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS santa_claimed_nights JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reward_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS state_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill top-level border fields safely from state_json if previously stored there
UPDATE public.winter_user_profiles
SET
  unlocked_borders = COALESCE(state_json->'unlockedBorders', '[]'::jsonb),
  equipped_border = NULLIF(state_json->>'equippedBorder', '')
WHERE
  (unlocked_borders = '[]'::jsonb OR unlocked_borders IS NULL)
  AND state_json ? 'unlockedBorders';

-- 2. Additive Border column + reward fields on winter_reward_ledger
ALTER TABLE public.winter_reward_ledger
  ADD COLUMN IF NOT EXISTS reward_label TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS xp_bonus INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cookies_bonus INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_bonus_queries INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_shield BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS badge_id TEXT,
  ADD COLUMN IF NOT EXISTS frame_id TEXT,
  ADD COLUMN IF NOT EXISTS border_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Ensure winter_task_claims & winter_user_badges constraints exist cleanly
CREATE TABLE IF NOT EXISTS public.winter_task_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  cookies_awarded INTEGER NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, task_id)
);

CREATE TABLE IF NOT EXISTS public.winter_user_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'seasonal',
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_winter_task_claims_user
  ON public.winter_task_claims(user_id, claimed_at DESC);

CREATE INDEX IF NOT EXISTS idx_winter_user_badges_user
  ON public.winter_user_badges(user_id, unlocked_at DESC);

-- 4. Strict Row-Level Security (RLS stays ENABLED — never disabled)
ALTER TABLE public.winter_task_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_reward_ledger ENABLE ROW LEVEL SECURITY;

-- Remove insecure/stale policies on task claims & badges before creating scoped ones
DROP POLICY IF EXISTS "veylentra_public_rw_winter_task_claims" ON public.winter_task_claims;
DROP POLICY IF EXISTS "winter_task_claims_owner_select" ON public.winter_task_claims;
DROP POLICY IF EXISTS "winter_task_claims_owner_insert" ON public.winter_task_claims;
DROP POLICY IF EXISTS "winter_task_claims_service_all" ON public.winter_task_claims;

CREATE POLICY "winter_task_claims_owner_select"
  ON public.winter_task_claims
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "winter_task_claims_owner_insert"
  ON public.winter_task_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "winter_task_claims_service_all"
  ON public.winter_task_claims
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "veylentra_public_rw_winter_user_badges" ON public.winter_user_badges;
DROP POLICY IF EXISTS "winter_user_badges_owner_select" ON public.winter_user_badges;
DROP POLICY IF EXISTS "winter_user_badges_owner_insert" ON public.winter_user_badges;
DROP POLICY IF EXISTS "winter_user_badges_service_all" ON public.winter_user_badges;

CREATE POLICY "winter_user_badges_owner_select"
  ON public.winter_user_badges
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "winter_user_badges_owner_insert"
  ON public.winter_user_badges
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "winter_user_badges_service_all"
  ON public.winter_user_badges
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Hardened SECURITY DEFINER Postgres RPCs for verified claim & badge persistence
-- Enforces authenticated caller ownership whenever auth.uid() is present,
-- validates canonical task/badge IDs & reward bounds, and preserves UNIQUE(user_id, task_id).

CREATE OR REPLACE FUNCTION public.claim_winter_task_secure(
  p_claim_id TEXT,
  p_user_id TEXT,
  p_task_id TEXT,
  p_xp_awarded INTEGER,
  p_cookies_awarded INTEGER,
  p_claimed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS public.winter_task_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller TEXT;
  v_row public.winter_task_claims;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RAISE EXCEPTION 'Verified user ID is required.' USING ERRCODE = '22023';
  END IF;

  v_caller := auth.uid()::text;
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden: caller cannot claim tasks for another user.' USING ERRCODE = '42501';
  END IF;

  IF p_task_id NOT IN (
    'task_visit_festival',
    'task_winter_quiz',
    'task_academic_engagement',
    'task_collect_cookies',
    'task_seasonal_wheel_or_gift'
  ) THEN
    RAISE EXCEPTION 'Unknown or disallowed Winter task ID: %', p_task_id USING ERRCODE = '22023';
  END IF;

  IF p_xp_awarded < 0 OR p_xp_awarded > 200 OR p_cookies_awarded < 0 OR p_cookies_awarded > 20 THEN
    RAISE EXCEPTION 'Invalid Winter task reward amounts.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.winter_task_claims (
    id, user_id, task_id, xp_awarded, cookies_awarded, claimed_at
  )
  VALUES (
    p_claim_id, p_user_id, p_task_id, p_xp_awarded, p_cookies_awarded, COALESCE(p_claimed_at, NOW())
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_winter_task_claim_secure(
  p_claim_id TEXT,
  p_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller TEXT;
  v_deleted INTEGER;
BEGIN
  v_caller := auth.uid()::text;
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden rollback attempt.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.winter_task_claims
  WHERE id = p_claim_id
    AND user_id = p_user_id
    AND claimed_at >= NOW() - INTERVAL '2 minutes';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_winter_badge_secure(
  p_row_id TEXT,
  p_user_id TEXT,
  p_badge_id TEXT,
  p_rarity TEXT DEFAULT 'seasonal',
  p_unlocked_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller TEXT;
BEGIN
  IF p_user_id IS NULL OR length(trim(p_user_id)) = 0 THEN
    RAISE EXCEPTION 'Verified user ID is required.' USING ERRCODE = '22023';
  END IF;

  v_caller := auth.uid()::text;
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'Forbidden: caller cannot write badges for another user.' USING ERRCODE = '42501';
  END IF;

  IF p_badge_id NOT IN (
    'snowflake_explorer',
    'winter_scholar',
    'frosty_focus',
    'cookie_collector',
    'winter_champion',
    'sleigh_keeper',
    'winter_wheel_ace',
    'aurora_miracle',
    'north_star_secret'
  ) THEN
    RAISE EXCEPTION 'Unknown Winter badge ID: %', p_badge_id USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.winter_user_badges (
    id, user_id, badge_id, rarity, unlocked_at
  )
  VALUES (
    p_row_id, p_user_id, p_badge_id, COALESCE(NULLIF(p_rarity, ''), 'seasonal'), COALESCE(p_unlocked_at, NOW())
  )
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_winter_task_secure(TEXT, TEXT, TEXT, INTEGER, INTEGER, TIMESTAMPTZ)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rollback_winter_task_claim_secure(TEXT, TEXT)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.sync_winter_badge_secure(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  TO authenticated, anon, service_role;
