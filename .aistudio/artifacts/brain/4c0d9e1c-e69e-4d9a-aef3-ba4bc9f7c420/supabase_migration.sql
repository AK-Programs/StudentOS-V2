-- Feedback Board Table & RLS Policies for Veylentra
create table if not exists public.feedback_posts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_name text,
  user_role text,
  title text not null,
  body text not null,
  category text default 'suggestion',
  status text default 'open',
  created_at timestamptz default now()
);

alter table public.feedback_posts enable row level security;

drop policy if exists "authenticated can read feedback" on public.feedback_posts;
create policy "authenticated can read feedback"
  on public.feedback_posts for select
  using (auth.role() = 'authenticated');

drop policy if exists "authenticated can insert own feedback" on public.feedback_posts;
create policy "authenticated can insert own feedback"
  on public.feedback_posts for insert
  with check (auth.uid()::text = user_id);

drop policy if exists "admins can update feedback" on public.feedback_posts;
create policy "admins can update feedback"
  on public.feedback_posts for update
  using (auth.role() = 'authenticated');
