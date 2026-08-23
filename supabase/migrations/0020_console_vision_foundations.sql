-- Foundations for the staff/manager console content expansion:
-- 1. Trainer certification tier on members (instructors are members rows).
-- 2. class_change_requests: a trainer's own swap/cancel request for a class
--    they teach, resolved by a manager. Distinct shape from time_off_requests
--    (references a specific class_id, not just a date).
-- 3. Narrow time_off_requests SELECT to own-rows-for-staff / all-for-admin --
--    today any staff can see every trainer's requests, which Product B's
--    trainer/manager scoping model never intended.

alter table public.members
  add column cert_tier text check (cert_tier in ('bronze', 'silver', 'gold'));

create table public.class_change_requests (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('swap', 'cancel')),
  swap_with_member_id uuid references public.members(id),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);

alter table public.class_change_requests enable row level security;

create policy "class_change_requests_select_own_or_admin"
on public.class_change_requests
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
);

-- A trainer may only request a swap/cancel for a class they actually teach --
-- checked via classes.instructor_member_id -> members.auth_user_id, the same
-- link 0019 established for "classes I'm hosting" queries.
create policy "class_change_requests_insert_own_class"
on public.class_change_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_staff(auth.uid())
  and exists (
    select 1 from public.classes c
    join public.members m on m.id = c.instructor_member_id
    where c.id = class_change_requests.class_id
      and m.auth_user_id = auth.uid()
  )
);

create policy "class_change_requests_update_admin"
on public.class_change_requests
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy "time_off_requests_select_staff" on public.time_off_requests;

create policy "time_off_requests_select_own_or_admin"
on public.time_off_requests
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin(auth.uid())
);
