-- Fix: staff users could satisfy is_staff(auth.uid()) for their own profile,
-- which let the profiles UPDATE policy and protect_profile_role() trigger
-- treat a self-promotion from staff to admin as authorized. Admin-only role
-- changes now require is_admin(auth.uid()), while every user still retains
-- the existing ability to update their own non-role profile fields.
--
-- Run this file manually in the Supabase SQL Editor, after 0029.

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
     and auth.role() is distinct from 'service_role'
     and session_user is distinct from 'postgres'
     and not public.is_admin(auth.uid()) then
    raise exception 'Only staff may change a profile role';
  end if;

  return new;
end;
$$;

drop policy if exists "profiles_update_self_or_staff" on public.profiles;

create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.is_admin(auth.uid())
)
with check (
  id = auth.uid()
  or public.is_admin(auth.uid())
);
