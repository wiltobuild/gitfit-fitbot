-- class_creation_requests: a trainer's own proposal for a brand-new class,
-- resolved by a manager. Distinct from class_change_requests (which always
-- points at an existing classes row) -- a proposal carries the full class
-- shape itself and only becomes a real public.classes row on approval, via
-- the same createClass() path admins already use. Kept as a staging table
-- (not a status column on classes) so a pending proposal is invisible to
-- members and to the classes RLS/query surface until approved.

create table public.class_creation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instructor_member_id uuid not null references public.members(id),
  name text not null,
  type text not null,
  class_date date not null,
  start_time time not null,
  duration_minutes int not null,
  capacity int not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_class_id text references public.classes(id)
);

alter table public.class_creation_requests enable row level security;

create policy "class_creation_requests_select_own_or_admin"
on public.class_creation_requests
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
);

-- A trainer may only propose a class under their own instructor identity --
-- checked via members.auth_user_id, the same ownership check
-- class_change_requests_insert_own_class uses via classes.instructor_member_id.
create policy "class_creation_requests_insert_own"
on public.class_creation_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_staff(auth.uid())
  and exists (
    select 1 from public.members m
    where m.id = class_creation_requests.instructor_member_id
      and m.auth_user_id = auth.uid()
  )
);

create policy "class_creation_requests_update_admin"
on public.class_creation_requests
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
