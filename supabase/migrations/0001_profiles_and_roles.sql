-- GitFit profile and role foundation.
-- Run this file manually in the Supabase SQL Editor. It does not require a CLI.

-- Store each authenticated user's application role. New users default to client.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'staff')),
  created_at timestamptz not null default now()
);

-- Enforce access through the policies below for ordinary authenticated requests.
alter table public.profiles enable row level security;

-- This helper reads profiles as its definer, avoiding recursive RLS evaluation
-- when a policy needs to determine whether the requesting user is staff.
create or replace function public.is_staff(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = uid
      and role = 'staff'
  );
$$;

-- A user can read their own profile. Staff can read all profiles for later
-- member-lookup features. The helper above prevents RLS recursion.
create policy "profiles_select_self_or_staff"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_staff(auth.uid())
);

-- A user may update their own profile; staff may update any profile. The role
-- value itself is protected by the trigger below because an RLS WITH CHECK
-- expression only sees the proposed row and cannot compare OLD.role to NEW.role.
create policy "profiles_update_self_or_staff"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.is_staff(auth.uid())
)
with check (
  id = auth.uid()
  or public.is_staff(auth.uid())
);

-- Prevent ordinary clients from promoting themselves (or changing any role).
-- Requests authenticated with Supabase's service_role bypass this guard; staff
-- users may change roles through a later admin flow.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
     and auth.role() is distinct from 'service_role'
     and not public.is_staff(auth.uid()) then
    raise exception 'Only staff may change a profile role';
  end if;

  return new;
end;
$$;

create trigger protect_profile_role_before_update
before update on public.profiles
for each row execute function public.protect_profile_role();

-- Create the matching client profile whenever Supabase creates an auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'client');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
