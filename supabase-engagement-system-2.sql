-- ============================================================================
-- VEYLENTRA — COMPLETE ATTENTION, ENGAGEMENT & RETENTION SYSTEM 2.0 MIGRATION
-- 100% Additive & Idempotent. Preserves all existing XP, badges & Winter data.
-- Safe to run multiple times in Supabase SQL Editor.
-- ============================================================================

-- 1. Extend user_profiles with authoritative streak & activity tracking columns
alter table if exists public.user_profiles
  add column if not exists streak_days integer not null default 0,
  add column if not exists longest_streak integer not null default 0,
  add column if not exists streak_state text not null default 'active',
  add column if not exists frozen_streak_count integer not null default 0,
  add column if not exists last_active_date text,
  add column if not exists streak_timezone text not null default 'Asia/Kolkata',
  add column if not exists streak_recovery_deadline timestamptz,
  add column if not exists streak_recovery_last_used_at timestamptz,
  add column if not exists streak_recoveries_this_month integer not null default 0,
  add column if not exists streak_recovery_month text,
  add column if not exists streak_updated_at timestamptz,
  add column if not exists study_hours numeric not null default 0,
  add column if not exists quizzes_taken integer not null default 0;

-- Keep longest_streak monotonic >= streak_days without reducing any existing values
update public.user_profiles
set longest_streak = greatest(coalesce(longest_streak, 0), coalesce(streak_days, 0))
where coalesce(longest_streak, 0) < coalesce(streak_days, 0);

-- 2. Extend notifications & notification_user_state for lifecycle, targeting & expiry
alter table if exists public.notifications
  add column if not exists target_role text,
  add column if not exists target_roles jsonb not null default '[]'::jsonb,
  add column if not exists priority text not null default 'normal',
  add column if not exists expires_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists dedupe_key text;

create index if not exists idx_notifications_dedupe_key
  on public.notifications(dedupe_key)
  where dedupe_key is not null;

create index if not exists idx_notifications_expires_at
  on public.notifications(expires_at)
  where expires_at is not null;

alter table if exists public.notification_user_state
  add column if not exists user_key text,
  add column if not exists delivered_at timestamptz,
  add column if not exists popup_presented_at timestamptz,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists dismissed_at timestamptz,
  add column if not exists read_at timestamptz;

create index if not exists idx_notif_user_state_user_key
  on public.notification_user_state(user_key, notification_id);

-- 3. Authoritative Streak History Log
create table if not exists public.engagement_streak_history (
  id text primary key,
  user_id text not null,
  activity_date text not null,
  event_type text not null, -- maintained | missed | frozen | recovery_available | recovered | expired
  streak_before integer not null default 0,
  streak_after integer not null default 0,
  source text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_engagement_streak_history_user_date
  on public.engagement_streak_history(user_id, activity_date desc);

alter table public.engagement_streak_history enable row level security;

drop policy if exists "engagement streak history owner read" on public.engagement_streak_history;
create policy "engagement streak history owner read"
  on public.engagement_streak_history
  for select
  using (auth.uid()::text = user_id or auth.role() = 'service_role');

drop policy if exists "engagement streak history service write" on public.engagement_streak_history;
create policy "engagement streak history service write"
  on public.engagement_streak_history
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- 4. Server-Verified Mission & Checklist Progress
create table if not exists public.engagement_mission_progress (
  id text primary key,
  user_id text not null,
  mission_id text not null,
  period_key text not null,
  role_scope text not null default 'student',
  status text not null default 'in_progress', -- available | in_progress | completed | claimed | expired
  progress_value integer not null default 0,
  target_value integer not null default 1,
  xp_awarded integer not null default 0,
  completed_at timestamptz,
  claimed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_engagement_mission_user_period
  on public.engagement_mission_progress(user_id, mission_id, period_key);

alter table public.engagement_mission_progress enable row level security;

drop policy if exists "engagement mission owner read" on public.engagement_mission_progress;
create policy "engagement mission owner read"
  on public.engagement_mission_progress
  for select
  using (auth.uid()::text = user_id or auth.role() = 'service_role');

drop policy if exists "engagement mission service write" on public.engagement_mission_progress;
create policy "engagement mission service write"
  on public.engagement_mission_progress
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- 5. Admin & Super Admin Engagement Policy Configuration & Audit Log
create table if not exists public.engagement_policy_config (
  id text primary key,
  scope text not null default 'platform',
  version integer not null default 1,
  config_json jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.engagement_policy_config enable row level security;

drop policy if exists "engagement policy authenticated read" on public.engagement_policy_config;
create policy "engagement policy authenticated read"
  on public.engagement_policy_config
  for select
  using (true);

drop policy if exists "engagement policy service write" on public.engagement_policy_config;
create policy "engagement policy service write"
  on public.engagement_policy_config
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.engagement_config_audit_logs (
  id text primary key,
  actor_user_id text not null,
  actor_email text,
  actor_role text,
  action text not null,
  previous_config jsonb,
  next_config jsonb,
  summary text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_engagement_config_audit_created
  on public.engagement_config_audit_logs(created_at desc);

alter table public.engagement_config_audit_logs enable row level security;

drop policy if exists "engagement config audit service only" on public.engagement_config_audit_logs;
create policy "engagement config audit service only"
  on public.engagement_config_audit_logs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
