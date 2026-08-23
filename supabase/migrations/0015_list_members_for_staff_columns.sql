-- list_members_for_staff() previously returned only (id, email, full_name,
-- auth_user_id, lifecycle_status, is_staff, created_at), silently omitting
-- is_instructor and membership_tier. Two Fitbot capabilities added in the
-- capability-expansion build depend on these columns and were quietly
-- degrading as a result: instructor-classes could never resolve any
-- instructor by name (is_instructor was always undefined client-side, so
-- the is_instructor filter always excluded every row), and roster-summary's
-- membership-tier breakdown always reported every member as "not set".
-- Widen the return table to include both columns; no caller-visible
-- behavior changes for the columns that already existed.

drop function public.list_members_for_staff();

create function public.list_members_for_staff()
returns table (id uuid, email text, full_name text, auth_user_id uuid, lifecycle_status text, is_staff boolean, is_instructor boolean, membership_tier text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'Only staff may list members';
  end if;

  return query
  select m.id, m.email, m.full_name, m.auth_user_id, m.lifecycle_status,
    coalesce(p.role = 'staff', false), m.is_instructor, m.membership_tier, m.created_at
  from public.members m
  left join auth.users u on u.id = m.auth_user_id
  left join public.profiles p on p.id = u.id
  order by m.created_at desc;
end;
$$;

grant execute on function public.list_members_for_staff() to authenticated;
