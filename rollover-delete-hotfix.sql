-- NON EVENT CINEMAS — rollover DELETE hotfix
-- Run this in Supabase SQL Editor if midnight-rollover.sql previously failed
-- with: DELETE requires a WHERE clause.
--
-- Recreate only the internal finaliser with a valid DELETE predicate.

create or replace function public._non_event_finalize_screening(
  p_screening_id bigint,
  p_force boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.screenings%rowtype;
  close_at timestamptz;
  next_local timestamp;
  next_at timestamptz;
  next_id bigint;
begin
  select * into s
  from public.screenings
  where id = p_screening_id
  for update;

  if not found then
    raise exception 'Screening not found';
  end if;

  if s.is_past then
    select id into next_id
    from public.screenings
    where is_past = false
      and is_cancelled = false
      and screening_at > s.screening_at
    order by screening_at
    limit 1;

    return next_id;
  end if;

  close_at :=
    (
      (
        (s.screening_at at time zone 'Europe/London')::date + 1
      )::timestamp
      at time zone 'Europe/London'
    );

  if not p_force and now() < close_at then
    return null;
  end if;

  update public.screenings
  set is_past = true
  where id = s.id;

  next_local := (s.screening_at at time zone 'Europe/London') + interval '14 days';
  next_at := next_local at time zone 'Europe/London';

  select id into next_id
  from public.screenings
  where is_past = false
    and is_cancelled = false
    and screening_at > s.screening_at
  order by screening_at
  limit 1;

  if next_id is null then
    insert into public.screenings (
      title,
      screening_at,
      runtime,
      year,
      note,
      poster_url,
      curator,
      is_past,
      is_cancelled
    )
    values (
      'TBC',
      next_at,
      null,
      null,
      null,
      null,
      null,
      false,
      false
    )
    returning id into next_id;
  end if;

  update public.recommendations
  set votes = 0
  where is_active = true;

  delete from public.recommendation_votes
  where recommendation_id is not null;

  return next_id;
end;
$$;

revoke all on function public._non_event_finalize_screening(bigint, boolean)
from public, anon, authenticated;
