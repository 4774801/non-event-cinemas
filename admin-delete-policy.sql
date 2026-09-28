-- NON EVENT CINEMAS
-- Run once in Supabase > SQL Editor.
-- Ensures a logged-in Supabase admin can remove recommendations.
-- Public friends do NOT receive this permission.

alter table public.recommendations enable row level security;

drop policy if exists "authenticated admin can update recommendations" on public.recommendations;
create policy "authenticated admin can update recommendations"
on public.recommendations
for update
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated admin can delete recommendations" on public.recommendations;
create policy "authenticated admin can delete recommendations"
on public.recommendations
for delete
to authenticated
using (true);
