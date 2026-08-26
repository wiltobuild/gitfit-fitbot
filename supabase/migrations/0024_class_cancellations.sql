-- Durable audit log for class cancellations. class_id is deliberately plain
-- text with NO foreign key to classes: the classes row is hard-deleted right
-- after cancellation (step 6), so this table snapshots everything needed to
-- read the log after the class is gone -- label fields, who canceled it, and
-- the roster that was booked at cancellation time. Admin-only end to end,
-- mirroring promo_events (0023), since cancellation itself is admin-only.

create table public.class_cancellations (
  id uuid primary key default gen_random_uuid(),
  class_id text not null,
  class_name text not null,
  class_date date not null,
  start_time time not null,
  canceled_by uuid not null references auth.users(id),
  booked_count int not null,
  roster jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.class_cancellations enable row level security;

create policy "class_cancellations_select_admin"
on public.class_cancellations
for select
to authenticated
using (public.is_admin(auth.uid()));

create policy "class_cancellations_insert_admin"
on public.class_cancellations
for insert
to authenticated
with check (public.is_admin(auth.uid()) and canceled_by = auth.uid());
