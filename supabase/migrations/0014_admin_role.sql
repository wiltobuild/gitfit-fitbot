-- Add the admin role: a superset of staff plus admin-exclusive capabilities
-- (time-off approval). is_staff() is redefined to also match admin rows,
-- since every existing staff-wide RLS policy should also admit admins.
-- Use is_admin() for admin-exclusive gates (things staff must NOT get).

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('client', 'staff', 'admin'));

-- This staff-wide access helper also matches admins. Use is_admin() below for
-- admin-exclusive gates.
create or replace function public.is_staff(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('staff', 'admin')
  );
$$;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'admin'
  );
$$;

-- protect_profile_role() already allows staff to change roles (is_staff check);
-- that now also covers admins, which is correct — admins may promote/demote.

-- Approve/deny time-off: admin-only (staff functions stay as-is; staff has
-- no approval capability today, so this is purely additive to admin).
create policy "time_off_requests_update_admin"
on public.time_off_requests
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- One-off promotion of the 4 known @pursuit.org staff accounts to admin.
-- Not idempotent DDL — a deliberate data change, run once.
update public.profiles
set role = 'admin'
where role = 'staff'
  and id in (
    select id from auth.users
    where email in (
      'wil.sheppard@pursuit.org',
      'riarusso@pursuit.org',
      'dikshyant.giri@pursuit.org',
      'stanley.remy@pursuit.org'
    )
  );
