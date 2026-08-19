-- Staff member lookup support.

-- Store an optional display name collected during sign-up.
alter table public.profiles add column full_name text;

-- Create the matching client profile whenever Supabase creates an auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'client', new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

-- Return a small staff-only member search result set, including auth email.
create or replace function public.search_members(search_term text)
returns table (id uuid, email text, full_name text, role text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'Only staff may search members';
  end if;

  return query
  select u.id, u.email, p.full_name, p.role, u.created_at
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.email ilike '%' || search_term || '%'
     or p.full_name ilike '%' || search_term || '%'
  order by u.created_at desc
  limit 10;
end;
$$;

grant execute on function public.search_members(text) to authenticated;
