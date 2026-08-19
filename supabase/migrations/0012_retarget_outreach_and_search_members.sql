-- Outreach targets are shared member records, while the staff author remains
-- an authenticated user.
alter table public.outreach_messages
drop constraint outreach_messages_target_user_id_fkey;

alter table public.outreach_messages
rename column target_user_id to target_member_id;

alter table public.outreach_messages
add constraint outreach_messages_target_member_id_fkey
foreign key (target_member_id) references public.members(id) on delete cascade;

-- Search all member records, including members who do not have an Auth account.
drop function public.search_members(text);

create function public.search_members(search_term text)
returns table (id uuid, email text, full_name text, auth_user_id uuid, lifecycle_status text, is_staff boolean, created_at timestamptz)
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
  select m.id, m.email, m.full_name, m.auth_user_id, m.lifecycle_status,
    coalesce(p.role = 'staff', false), m.created_at
  from public.members m
  left join auth.users u on u.id = m.auth_user_id
  left join public.profiles p on p.id = u.id
  where m.email ilike '%' || escaped_term || '%'
     or m.full_name ilike '%' || escaped_term || '%'
  order by m.created_at desc
  limit 10;
end;
$$;

grant execute on function public.search_members(text) to authenticated;

-- List the full member set for staff workflows that must not be capped at ten.
create function public.list_members_for_staff()
returns table (id uuid, email text, full_name text, auth_user_id uuid, lifecycle_status text, is_staff boolean, created_at timestamptz)
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
    coalesce(p.role = 'staff', false), m.created_at
  from public.members m
  left join auth.users u on u.id = m.auth_user_id
  left join public.profiles p on p.id = u.id
  order by m.created_at desc;
end;
$$;

grant execute on function public.list_members_for_staff() to authenticated;
