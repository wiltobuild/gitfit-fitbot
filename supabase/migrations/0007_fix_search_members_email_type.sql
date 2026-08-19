-- Fix: search_members() (from 0006) declared its return column `email text`,
-- but auth.users.email is actually `character varying(255)`, not `text`.
-- Postgres's function-return-type checking is strict about this mismatch
-- ("structure of query does not match function result type") even though
-- varchar and text are usually interchangeable in expressions — an explicit
-- cast in the SELECT list is required when the function signature promises
-- `text`. Found via live testing: every call failed with error 42804.

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
  select u.id, u.email::text, p.full_name, p.role, u.created_at
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.email ilike '%' || search_term || '%'
     or p.full_name ilike '%' || search_term || '%'
  order by u.created_at desc
  limit 10;
end;
$$;
