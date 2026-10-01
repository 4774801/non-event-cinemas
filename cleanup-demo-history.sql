-- NON EVENT CINEMAS — remove the three development films
-- Run ONCE in Supabase > SQL Editor.
--
-- Your only real completed screening so far is The Road to El Dorado.
-- This script:
--   1. finds that screening
--   2. ensures it is a real Past Film
--   3. removes every OTHER row currently marked is_past=true
--
-- rsvps and ratings belonging to deleted demo screenings are removed
-- automatically by the existing ON DELETE CASCADE foreign keys.
-- Road to El Dorado's RSVPs and ratings are preserved.

do $$
declare
  keep_id bigint;
begin
  select id
  into keep_id
  from public.screenings
  where lower(title) like '%el dorado%'
  order by screening_at desc, id desc
  limit 1;

  if keep_id is null then
    raise exception 'Could not find a screening with "El Dorado" in the title. No rows were changed.';
  end if;

  update public.screenings
  set is_past = true,
      is_cancelled = false
  where id = keep_id;

  delete from public.screenings
  where is_past = true
    and id <> keep_id;
end
$$;

-- Useful verification result: this should return exactly one past film.
select
  id,
  title,
  screening_at,
  is_past,
  is_cancelled,
  curator
from public.screenings
where is_past = true
order by screening_at desc;
