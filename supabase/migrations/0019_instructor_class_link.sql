-- Direct FK from a class to the members row that teaches it, so a staff
-- dashboard can query "classes I'm hosting" by identity (auth_user_id ->
-- members.id -> classes.instructor_member_id) instead of matching
-- classes.instructor text at request time. classes.instructor stays as
-- the display string; the FK is the authoritative link going forward.

alter table public.classes
  add column instructor_member_id uuid references public.members(id);

-- One-time backfill: match every existing class's free-text instructor
-- name to the corresponding members row (exact match against full_name).
update public.classes c
set instructor_member_id = m.id
from public.members m
where c.instructor_member_id is null
  and m.is_instructor
  and m.full_name = c.instructor;

-- One-off promotion: every instructor login becomes staff so they can
-- reach a staff dashboard. Only promotes rows still at the default
-- 'client' role -- already-promoted instructor accounts are left as-is.
update public.profiles p
set role = 'staff'
from public.members m
where p.id = m.auth_user_id
  and m.is_instructor
  and p.role = 'client';
