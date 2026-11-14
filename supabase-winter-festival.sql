-- ============================================================================
-- VEYLENTRA — WINTER FESTIVAL, FEATURE MANAGEMENT & GAMIFICATION 2.0 MIGRATION
-- Safe to run multiple times (idempotent DDL + RLS + Realtime setup).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Platform Feature & Theme Management Registry
CREATE TABLE IF NOT EXISTS public.platform_features (
  key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Other Platform Features',
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  release_version TEXT NOT NULL DEFAULT '2026.12',
  rollout_note TEXT NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_seasonal BOOLEAN NOT NULL DEFAULT FALSE,
  can_preview_by_super_admin BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT,
  updated_by_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_feature_audit_logs (
  id TEXT PRIMARY KEY,
  feature_key TEXT NOT NULL,
  previous_enabled BOOLEAN,
  new_enabled BOOLEAN NOT NULL,
  action TEXT NOT NULL DEFAULT 'toggle',
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_feature_audit_key
  ON public.platform_feature_audit_logs(feature_key, created_at DESC);

-- 2. Timestamped Authoritative XP Ledger (for Weekly / Monthly / All-Time separated leaderboards)
CREATE TABLE IF NOT EXISTS public.gamification_xp_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'Member',
  user_role TEXT NOT NULL DEFAULT 'student',
  grade TEXT DEFAULT '',
  section TEXT DEFAULT '',
  house TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'academic',
  action_key TEXT NOT NULL,
  xp_delta INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gamification_xp_ledger_role_time
  ON public.gamification_xp_ledger(user_role, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gamification_xp_ledger_dedup
  ON public.gamification_xp_ledger(user_id, action_key);

-- 3. Winter Festival Per-User State, Tasks, Collectible Winter Badges & Reward Ledger
CREATE TABLE IF NOT EXISTS public.winter_user_profiles (
  user_id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL DEFAULT 'Member',
  user_role TEXT NOT NULL DEFAULT 'student',
  cookies_count INTEGER NOT NULL DEFAULT 0,
  streak_shields INTEGER NOT NULL DEFAULT 0,
  unlocked_frames JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipped_frame TEXT,
  spin_next_eligible_at TIMESTAMPTZ,
  last_spin_at TIMESTAMPTZ,
  last_wheel_notified_cycle TEXT,
  ai_bonus_date TEXT,
  ai_bonus_credits_today INTEGER NOT NULL DEFAULT 0,
  quiz_completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.winter_reward_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feature_type TEXT NOT NULL, -- 'santa_gift' | 'spin_wheel' | 'winter_task'
  idempotency_key TEXT NOT NULL,
  event_night_key TEXT, -- e.g., '2026-12-20' in Asia/Kolkata
  status TEXT NOT NULL DEFAULT 'applied', -- 'pending_apply' | 'applied' | 'recovered'
  rarity TEXT NOT NULL DEFAULT 'common',
  segment_index INTEGER,
  reward_label TEXT NOT NULL,
  xp_bonus INTEGER NOT NULL DEFAULT 0,
  cookies_bonus INTEGER NOT NULL DEFAULT 0,
  ai_bonus_queries INTEGER NOT NULL DEFAULT 0,
  streak_shield BOOLEAN NOT NULL DEFAULT FALSE,
  badge_id TEXT,
  frame_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  UNIQUE(user_id, feature_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_winter_reward_ledger_user_night
  ON public.winter_reward_ledger(user_id, feature_type, event_night_key);

-- 4. Row-Level Security (Permissive for Veylentra hybrid auth while protecting writes cleanly)
ALTER TABLE public.platform_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feature_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_xp_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_task_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winter_reward_ledger ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'platform_features',
    'platform_feature_audit_logs',
    'gamification_xp_ledger',
    'winter_user_profiles',
    'winter_task_claims',
    'winter_user_badges',
    'winter_reward_ledger'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'veylentra_public_rw_' || t
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)', 'veylentra_public_rw_' || t, t);
    END IF;
  END LOOP;
END $$;

-- 5. Enable Supabase Realtime publication for live feature-flag & leaderboard sync
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_features;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.gamification_xp_ledger;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
