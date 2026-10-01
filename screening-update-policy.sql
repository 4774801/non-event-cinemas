-- NON EVENT CINEMAS — allow authenticated admin to update screenings
-- Run once in Supabase > SQL Editor.
-- This is required for the admin "Use film" handoff.

alter table public.screenings enable row level security;

drop policy if exists "authenticated admin can update screenings" on public.screenings;
create policy "authenticated admin can update screenings"
on public.screenings
for update
to authenticated
using (true)
with check (true);

-- The public site must still be able to read the upcoming screening.
drop policy if exists "public can read screenings" on public.screenings;
create policy "public can read screenings"
on public.screenings
for select
to anon, authenticated
using (true);
