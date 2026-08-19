-- Internal staff-only outreach staging. No client-facing access is provided:
-- drafts and sent markers are available only to staff tooling.

create table public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.outreach_messages enable row level security;

create policy "outreach_messages_select_staff"
on public.outreach_messages
for select
to authenticated
using (public.is_staff(auth.uid()));

create policy "outreach_messages_insert_own_staff"
on public.outreach_messages
for insert
to authenticated
with check (
  staff_user_id = auth.uid()
  and public.is_staff(auth.uid())
);

create policy "outreach_messages_update_staff"
on public.outreach_messages
for update
to authenticated
using (public.is_staff(auth.uid()))
with check (public.is_staff(auth.uid()));
