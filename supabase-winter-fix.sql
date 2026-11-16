-- Veylentra Winter Reward Ledger, User Profiles, XP Ledger & RLS Migration
-- Safe to run multiple times in Supabase SQL Editor.

alter table public.winter_reward_ledger
  add column if not exists reward_label text not null default '',
  add column if not exists xp_bonus integer not null default 0,
  add column if not exists cookies_bonus integer not null default 0,
  add column if not exists ai_bonus_queries integer not null default 0,
  add column if not exists streak_shield boolean not null default false,
  add column if not exists badge_id text,
  add column if not exists frame_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.winter_user_profiles
  add column if not exists claimed_task_ids jsonb not null default '[]'::jsonb,
  add column if not exists earned_winter_badges jsonb not null default '{}'::jsonb,
  add column if not exists santa_claimed_nights jsonb not null default '{}'::jsonb,
  add column if not exists reward_history jsonb not null default '[]'::jsonb,
  add column if not exists state_json jsonb not null default '{}'::jsonb;

create table if not exists public.gamification_xp_ledger (
  id text primary key,
  user_id text not null,
  user_name text not null default 'Member',
  user_role text not null default 'student',
  xp_delta integer not null default 0,
  label text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_xp_ledger_created
  on public.gamification_xp_ledger(created_at desc);

alter table public.winter_reward_ledger enable row level security;
drop policy if exists "reward ledger rw" on public.winter_reward_ledger;
create policy "reward ledger rw" on public.winter_reward_ledger for all using (true) with check (true);

alter table public.winter_user_profiles enable row level security;
alter table public.gamification_xp_ledger enable row level security;

drop policy if exists "winter profile rw" on public.winter_user_profiles;
create policy "winter profile rw" on public.winter_user_profiles for all using (true) with check (true);

drop policy if exists "xp ledger rw" on public.gamification_xp_ledger;
create policy "xp ledger rw" on public.gamification_xp_ledger for all using (true) with check (true);
