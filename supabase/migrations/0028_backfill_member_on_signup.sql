-- A real sign-up only ever created a public.profiles row. search_members
-- was retargeted in 0012 to query public.members instead of auth.users/
-- profiles (so staff could also find prospective members who don't have an
-- Auth account yet), but nothing populates members for someone who *does*
-- sign up for a real account -- they're invisible to staff search (and any
-- other members-backed feature) indefinitely.
--
-- Extend handle_new_user to also create the matching members row. If a
-- members row already exists for this email (a staff-curated prospective
-- member signing up for real), link it to the new auth account instead of
-- erroring on the unique email constraint -- letting this insert fail would
-- roll back the whole signup, not just the members row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'client', new.raw_user_meta_data->>'full_name');

  insert into public.members (email, full_name, auth_user_id, join_date)
  values (new.email, new.raw_user_meta_data->>'full_name', new.id, current_date)
  on conflict (email) do update set auth_user_id = excluded.auth_user_id;

  return new;
end;
$$;

-- One-off backfill for real accounts already stuck in this gap (signed up
-- before this fix existed) -- idempotent via the same NOT EXISTS / ON
-- CONFLICT guards, safe to leave in place if this migration ever re-runs.
insert into public.members (email, full_name, auth_user_id, join_date)
select u.email, p.full_name, u.id, u.created_at::date
from auth.users u
join public.profiles p on p.id = u.id
where not exists (select 1 from public.members m where m.auth_user_id = u.id)
on conflict (email) do update set auth_user_id = excluded.auth_user_id;
