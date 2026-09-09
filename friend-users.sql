-- NON EVENT CINEMAS: friend username registry
-- Run once in Supabase > SQL Editor.

create table if not exists public.friend_users (
  user_name text primary key,
  last_seen_at timestamptz not null default now()
);

alter table public.friend_users enable row level security;

drop policy if exists "public can register usernames" on public.friend_users;
create policy "public can register usernames"
on public.friend_users
for insert
to anon
with check (true);

drop policy if exists "public can refresh username timestamp" on public.friend_users;
create policy "public can refresh username timestamp"
on public.friend_users
for update
to anon
using (true)
with check (true);

drop policy if exists "authenticated admin can read usernames" on public.friend_users;
create policy "authenticated admin can read usernames"
on public.friend_users
for select
to authenticated
using (true);
