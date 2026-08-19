-- Staff time-off requests, with approval fields reserved for a future workflow.

create table public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);

-- Time-off is internal staff-operational data. Staff can view all requests,
-- while requests may only be created by the staff member they belong to.
alter table public.time_off_requests enable row level security;

create policy "time_off_requests_select_staff"
on public.time_off_requests
for select
to authenticated
using (public.is_staff(auth.uid()));

create policy "time_off_requests_insert_own_staff"
on public.time_off_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_staff(auth.uid())
);

-- No UPDATE policy is intentionally defined. Approval and denial are a future
-- workflow, so status and review fields cannot yet be changed through the app.
