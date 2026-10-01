-- NON EVENT CINEMAS — midnight round rollover
-- Run this ONCE in Supabase > SQL Editor.
--
-- Behaviour:
-- * ratings open 1 hour after screening start
-- * ratings close at UK midnight (or immediately when admin finalises early)
-- * at midnight the screening becomes past
-- * next fortnightly TBC screening is created if one does not already exist
-- * carried recommendations remain active but their votes reset
-- * recommendation_votes are cleared for the fresh round
-- * public pages can safely call finalize_due_screening()
-- * only authenticated admin can call admin_finalize_screening()

-- -------------------------------------------------------------------------
-- Enforce the rating window in the database as well as in the UI.
-- -------------------------------------------------------------------------
create or replace function public.enforce_non_event_rating_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.screenings%rowtype;
  unlock_at timestamptz;
  close_at timestamptz;
begin
  select * into s
  from public.screenings
  where id = new.screening_id;

  if not found then
    raise exception 'Screening does not exist';
  end if;

  unlock_at := s.screening_at + interval '1 hour';

  close_at :=
    (
      (
        (s.screening_at at time zone 'Europe/London')::date + 1
      )::timestamp
      at time zone 'Europe/London'
    );

  if s.is_past then
    raise exception 'Rating is closed for this screening';
  end if;

  if now() < unlock_at then
    raise exception 'Rating is not open yet';
  end if;

  if now() >= close_at then
    raise exception 'Rating closed at midnight';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_non_event_rating_window on public.ratings;
create trigger enforce_non_event_rating_window
before insert or update on public.ratings
for each row
execute function public.enforce_non_event_rating_window();

-- -------------------------------------------------------------------------
-- Internal finaliser. Not callable directly by site visitors.
-- -------------------------------------------------------------------------
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

  -- Idempotent: if this row is already past, just return the next live row.
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

  -- Keep the same local UK clock time exactly 14 days later, including DST.
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

  -- Fresh voting round. The selected film has already been removed from the
  -- active queue when "Use film" is pressed; the rest carry forward.
  update public.recommendations
  set votes = 0
  where is_active = true;

  delete from public.recommendation_votes;

  return next_id;
end;
$$;

revoke all on function public._non_event_finalize_screening(bigint, boolean)
from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- Public safe wrapper: does nothing before midnight.
-- -------------------------------------------------------------------------
create or replace function public.finalize_due_screening()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id bigint;
begin
  -- Pick the most recent active screening that has actually started.
  -- This avoids stale old placeholder rows.
  select id into target_id
  from public.screenings
  where is_past = false
    and is_cancelled = false
    and screening_at <= now()
  order by screening_at desc
  limit 1;

  if target_id is null then
    return null;
  end if;

  return public._non_event_finalize_screening(target_id, false);
end;
$$;

revoke all on function public.finalize_due_screening() from public;
grant execute on function public.finalize_due_screening() to anon, authenticated;

-- -------------------------------------------------------------------------
-- Admin-only early finalise wrapper.
-- -------------------------------------------------------------------------
create or replace function public.admin_finalize_screening(p_screening_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Admin authentication required';
  end if;

  return public._non_event_finalize_screening(p_screening_id, true);
end;
$$;

revoke all on function public.admin_finalize_screening(bigint) from public, anon;
grant execute on function public.admin_finalize_screening(bigint) to authenticated;
