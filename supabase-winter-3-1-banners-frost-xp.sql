-- ============================================================================
-- VEYLENTRA — WINTER FESTIVAL 3.1 MIGRATION
-- Additive, Idempotent Migration for:
--   1. Winter Profile Banners (replacing legacy Winter Frames category safely)
--   2. Isolated Seasonal Frost XP Currency & Atomic Postgres Ledger / RPCs
--   3. Super Admin Direct Claim Audit Log
-- Safe to run multiple times in Supabase SQL Editor.
-- ============================================================================

-- 1. Extend winter_user_profiles with Frost XP and Banner columns
alter table if exists public.winter_user_profiles
  add column if not exists frost_xp integer not null default 0,
  add column if not exists unlocked_banners jsonb not null default '[]'::jsonb,
  add column if not exists equipped_banner text,
  add column if not exists unlocked_borders jsonb not null default '[]'::jsonb,
  add column if not exists equipped_border text,
  add column if not exists claimed_task_ids jsonb not null default '[]'::jsonb,
  add column if not exists earned_winter_badges jsonb not null default '{}'::jsonb,
  add column if not exists santa_claimed_nights jsonb not null default '{}'::jsonb,
  add column if not exists reward_history jsonb not null default '[]'::jsonb,
  add column if not exists state_json jsonb not null default '{}'::jsonb;

-- Backfill Winter Banner IDs safely from prior unlocked_frames / equipped_frame columns
-- Leaves any user_profiles permanent AVATAR_FRAMES untouched.
update public.winter_user_profiles
set
  unlocked_banners = coalesce(
    (
      select jsonb_agg(distinct val)
      from (
        select jsonb_array_elements_text(coalesce(unlocked_banners, '[]'::jsonb)) as val
        union
        select elem as val
        from jsonb_array_elements_text(coalesce(unlocked_frames, '[]'::jsonb)) as elem
        where elem in ('frosted_aurora', 'candy_ribbon', 'starlight_gold', 'aurora_crown')
      ) s
    ),
    '[]'::jsonb
  ),
  equipped_banner = coalesce(
    equipped_banner,
    case
      when equipped_frame in ('frosted_aurora', 'candy_ribbon', 'starlight_gold', 'aurora_crown')
      then equipped_frame
      else null
    end
  )
where unlocked_frames is not null or equipped_frame is not null;

-- 2. Extend winter_reward_ledger with frost_xp_bonus & banner_id
alter table if exists public.winter_reward_ledger
  add column if not exists frost_xp_bonus integer not null default 0,
  add column if not exists banner_id text;

update public.winter_reward_ledger
set banner_id = coalesce(banner_id, frame_id)
where banner_id is null
  and frame_id in ('frosted_aurora', 'candy_ribbon', 'starlight_gold', 'aurora_crown');

-- 3. Isolated Frost XP Transaction Ledger (strictly separated from Scholar XP / gamification_xp_ledger)
create table if not exists public.winter_frost_xp_ledger (
  id text primary key,
  user_id text not null,
  amount integer not null check (amount <> 0),
  balance_after integer not null default 0 check (balance_after >= 0),
  reason text not null default '',
  reference_type text,
  reference_id text,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_winter_frost_xp_user_idemp
  on public.winter_frost_xp_ledger(user_id, idempotency_key);

create index if not exists idx_winter_frost_xp_user_created
  on public.winter_frost_xp_ledger(user_id, created_at desc);

alter table public.winter_frost_xp_ledger enable row level security;

drop policy if exists "winter frost xp ledger owner read" on public.winter_frost_xp_ledger;
create policy "winter frost xp ledger owner read"
  on public.winter_frost_xp_ledger
  for select
  using (auth.uid()::text = user_id or auth.role() = 'service_role');

drop policy if exists "winter frost xp ledger service write" on public.winter_frost_xp_ledger;
create policy "winter frost xp ledger service write"
  on public.winter_frost_xp_ledger
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- 4. Super Admin Direct Grant Audit Table (distinct from Preview Mode)
create table if not exists public.winter_admin_grant_audit (
  id text primary key,
  admin_user_id text not null,
  admin_email text not null default '',
  target_user_id text not null,
  item_type text not null,
  item_id text not null,
  reason text not null default 'super_admin_direct_claim',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_winter_admin_grant_created
  on public.winter_admin_grant_audit(created_at desc);

alter table public.winter_admin_grant_audit enable row level security;

drop policy if exists "winter admin grant audit service only" on public.winter_admin_grant_audit;
create policy "winter admin grant audit service only"
  on public.winter_admin_grant_audit
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- 5. Atomic Postgres RPC: Award Frost XP with Idempotency Guarantee
create or replace function public.award_frost_xp_secure(
  p_ledger_id text,
  p_user_id text,
  p_amount integer,
  p_reason text,
  p_reference_type text,
  p_reference_id text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_bal integer;
  v_new_bal integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_FROST_XP_AMOUNT';
  end if;

  if exists (
    select 1 from public.winter_frost_xp_ledger
    where user_id = p_user_id and idempotency_key = p_idempotency_key
  ) then
    select coalesce(frost_xp, 0) into v_existing_bal
    from public.winter_user_profiles
    where user_id = p_user_id;
    return jsonb_build_object('success', true, 'deduplicated', true, 'frost_xp', coalesce(v_existing_bal, 0));
  end if;

  insert into public.winter_user_profiles(user_id, frost_xp)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  select coalesce(frost_xp, 0) into v_existing_bal
  from public.winter_user_profiles
  where user_id = p_user_id
  for update;

  v_new_bal := greatest(0, v_existing_bal + p_amount);

  update public.winter_user_profiles
  set frost_xp = v_new_bal,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.winter_frost_xp_ledger(
    id, user_id, amount, balance_after, reason, reference_type, reference_id, idempotency_key
  ) values (
    p_ledger_id, p_user_id, p_amount, v_new_bal, coalesce(p_reason, 'Frost XP Earned'), p_reference_type, p_reference_id, p_idempotency_key
  );

  return jsonb_build_object('success', true, 'deduplicated', false, 'frost_xp', v_new_bal);
end;
$$;

-- 6. Atomic Postgres RPC: Spend Frost XP & Grant Banner/Border Collectible (No Overspend, No Duplicates)
create or replace function public.spend_frost_xp_and_grant_collectible_secure(
  p_ledger_id text,
  p_user_id text,
  p_cost integer,
  p_item_type text,
  p_item_id text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal integer;
  v_new_bal integer;
  v_banners jsonb;
  v_borders jsonb;
begin
  if p_cost is null or p_cost <= 0 then
    raise exception 'INVALID_COST';
  end if;
  if p_item_type not in ('banner', 'border') then
    raise exception 'INVALID_ITEM_TYPE';
  end if;

  select coalesce(frost_xp, 0), coalesce(unlocked_banners, '[]'::jsonb), coalesce(unlocked_borders, '[]'::jsonb)
    into v_bal, v_banners, v_borders
  from public.winter_user_profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if p_item_type = 'banner' and v_banners ? p_item_id then
    raise exception 'COLLECTIBLE_ALREADY_OWNED';
  end if;
  if p_item_type = 'border' and v_borders ? p_item_id then
    raise exception 'COLLECTIBLE_ALREADY_OWNED';
  end if;

  if v_bal < p_cost then
    raise exception 'INSUFFICIENT_FROST_XP';
  end if;

  v_new_bal := v_bal - p_cost;

  if p_item_type = 'banner' then
    v_banners := v_banners || to_jsonb(p_item_id);
    update public.winter_user_profiles
    set frost_xp = v_new_bal, unlocked_banners = v_banners, updated_at = now()
    where user_id = p_user_id;
  else
    v_borders := v_borders || to_jsonb(p_item_id);
    update public.winter_user_profiles
    set frost_xp = v_new_bal, unlocked_borders = v_borders, updated_at = now()
    where user_id = p_user_id;
  end if;

  insert into public.winter_frost_xp_ledger(
    id, user_id, amount, balance_after, reason, reference_type, reference_id, idempotency_key
  ) values (
    p_ledger_id, p_user_id, -p_cost, v_new_bal, coalesce(p_reason, 'Collectible Purchase'), p_item_type, p_item_id, p_idempotency_key
  );

  return jsonb_build_object(
    'success', true,
    'frost_xp', v_new_bal,
    'unlocked_banners', v_banners,
    'unlocked_borders', v_borders
  );
end;
$$;

-- 7. Winter Task Claims Table, RLS Policy & Secure RPC
create table if not exists public.winter_task_claims (
  id text primary key,
  user_id text not null,
  task_id text not null,
  xp_awarded integer not null default 0,
  cookies_awarded integer not null default 0,
  claimed_at timestamptz not null default now()
);

create unique index if not exists idx_winter_task_claims_user_task
  on public.winter_task_claims(user_id, task_id);

create or replace function public.claim_winter_task_secure(
  p_claim_id text,
  p_user_id text,
  p_task_id text,
  p_xp_awarded integer,
  p_cookies_awarded integer,
  p_claimed_at timestamptz
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.winter_task_claims (id, user_id, task_id, xp_awarded, cookies_awarded, claimed_at)
  values (p_claim_id, p_user_id, p_task_id, p_xp_awarded, p_cookies_awarded, p_claimed_at)
  on conflict (user_id, task_id) do nothing;
end;
$$;

alter table public.winter_task_claims enable row level security;
drop policy if exists "task claims rw" on public.winter_task_claims;
create policy "task claims rw" on public.winter_task_claims for all using (true) with check (true);

