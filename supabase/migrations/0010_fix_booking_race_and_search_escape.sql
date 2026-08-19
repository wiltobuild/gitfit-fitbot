-- Fix 1: overbooking race condition, found by adversarial review after Phase 10.
--
-- ensure_class_has_capacity() (0005) read classes.booked_count/capacity with a
-- plain SELECT under READ COMMITTED isolation. Two concurrent bookings for the
-- last open spot (different users) could both read the same pre-increment
-- booked_count before either commits, both pass the capacity check, and both
-- insert — overbooking the class. Fix: lock the class row with FOR UPDATE so
-- the second concurrent transaction blocks until the first commits (and then
-- sees the incremented booked_count from the AFTER INSERT trigger).
create or replace function public.ensure_class_has_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_booked_count int;
  class_capacity int;
begin
  select booked_count, capacity
  into current_booked_count, class_capacity
  from public.classes
  where id = new.class_id
  for update;

  if current_booked_count >= class_capacity then
    raise exception 'Class is full';
  end if;

  return new;
end;
$$;

-- Fix 2: wildcard-injection hardening in search_members, found by adversarial
-- review. search_term wasn't escaped for ILIKE's %/_ metacharacters, so a
-- staff user typing "%" would broaden their own search unexpectedly (not a
-- cross-role exploit — staff already have full search_members access by
-- design — but a real correctness/usability gap worth closing).
create or replace function public.search_members(search_term text)
returns table (id uuid, email text, full_name text, role text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  escaped_term text;
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'Only staff may search members';
  end if;

  escaped_term := replace(replace(search_term, '%', '\%'), '_', '\_');

  return query
  select u.id, u.email::text, p.full_name, p.role, u.created_at
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.email ilike '%' || escaped_term || '%'
     or p.full_name ilike '%' || escaped_term || '%'
  order by u.created_at desc
  limit 10;
end;
$$;
