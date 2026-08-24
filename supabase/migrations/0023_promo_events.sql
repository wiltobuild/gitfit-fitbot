-- Phase D (reduced scope, user-decided 2026-08-23): just log promotion
-- events -- no outreach-sending, no cert editor. A record of who promoted
-- a class and when, admin-only end to end since promotion itself is
-- admin-only (0022).

create table public.promo_events (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(id) on delete cascade,
  promoted_by uuid not null references auth.users(id),
  sent_to_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.promo_events enable row level security;

create policy "promo_events_select_admin"
on public.promo_events
for select
to authenticated
using (public.is_admin(auth.uid()));

create policy "promo_events_insert_admin"
on public.promo_events
for insert
to authenticated
with check (public.is_admin(auth.uid()) and promoted_by = auth.uid());
