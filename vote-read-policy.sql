-- NON EVENT CINEMAS — expose existing recommendation vote rows to the public site
-- This DOES NOT create a new vote table.
-- It only lets the site read the existing recommendation_votes table that
-- toggle_recommendation_vote already uses.

alter table public.recommendation_votes enable row level security;

drop policy if exists "public can read recommendation votes" on public.recommendation_votes;
create policy "public can read recommendation votes"
on public.recommendation_votes
for select
to anon, authenticated
using (true);
