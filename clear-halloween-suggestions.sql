-- NON EVENT CINEMAS — HALLOWEEN SPECIAL cleanup
-- Run this ONCE in Supabase SQL Editor if you want to clear the current
-- suggestion pile and recommendation votes for the Halloween host-pick round.
--
-- This removes only ACTIVE suggestions. Past film data, ratings and RSVPs are untouched.

begin;

delete from public.recommendation_votes
where recommendation_id in (
  select id
  from public.recommendations
  where is_active = true
);

delete from public.recommendations
where is_active = true;

commit;
