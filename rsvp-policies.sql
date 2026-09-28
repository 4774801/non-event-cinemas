-- NON EVENT CINEMAS — RSVP permissions
-- Run once in Supabase > SQL Editor.
--
-- Friends on the public site use the browser publishable/anon key rather
-- than Supabase Auth, so the rsvps table needs public INSERT + UPDATE access.

alter table public.rsvps enable row level security;

drop policy if exists "public can read rsvps" on public.rsvps;
create policy "public can read rsvps"
on public.rsvps
for select
to anon, authenticated
using (true);

drop policy if exists "public can add rsvps" on public.rsvps;
create policy "public can add rsvps"
on public.rsvps
for insert
to anon, authenticated
with check (true);

drop policy if exists "public can update rsvps" on public.rsvps;
create policy "public can update rsvps"
on public.rsvps
for update
to anon, authenticated
using (true)
with check (true);
