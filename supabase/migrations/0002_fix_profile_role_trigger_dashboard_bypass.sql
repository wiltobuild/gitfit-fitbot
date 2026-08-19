-- Fix: protect_profile_role() (from 0001) only exempted auth.role() = 'service_role',
-- a session GUC that PostgREST sets when a request is authenticated with the
-- service-role key. Supabase Studio's own Table Editor (the "manually flip a
-- row to staff" workflow this project's decisions.md and plan.md approved for
-- Phase 1 staff provisioning) connects as the `postgres` superuser directly,
-- not through PostgREST, so auth.role() is never 'service_role' there either
-- — the original trigger would have blocked the intended dashboard workflow.
-- Run this file manually in the Supabase SQL Editor, after 0001.

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
     and not public.is_staff(auth.uid()) then
    raise exception 'Only staff may change a profile role';
  end if;

  return new;
end;
$$;
