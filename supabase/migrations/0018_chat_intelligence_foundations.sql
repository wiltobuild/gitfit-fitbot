-- Conversation-memory and slot-filling foundations for fitbot-intelligence-upgrade
-- (Decisions 1, 8, 10). Combined into one migration since none of these
-- additive changes are independently revertible in practice.

-- Persist rich cards, suggested chips, and structured resolved-entity
-- metadata on assistant turns so a reload preserves interactive state
-- instead of a full-menu overwrite, and so pronoun/shorthand resolution has
-- a machine-readable "what did the last reply resolve" signal.
alter table public.chat_messages add column card jsonb;
alter table public.chat_messages add column suggested_chips jsonb;
alter table public.chat_messages add column resolved_entities jsonb;

-- One open slot-filling question per user at a time: a specific
-- clarifying-question record that is atomically present-or-absent and
-- explicitly expires, distinct from the read-only, best-effort chat_messages
-- lookback used for pronoun resolution.
create table public.chat_pending_clarifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent_id text not null,
  partial_args jsonb not null default '{}'::jsonb,
  missing_slot text not null,
  prompt text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

alter table public.chat_pending_clarifications enable row level security;

create policy "chat_pending_clarifications_select_own"
on public.chat_pending_clarifications
for select
to authenticated
using (user_id = auth.uid());

create policy "chat_pending_clarifications_insert_own"
on public.chat_pending_clarifications
for insert
to authenticated
with check (user_id = auth.uid());

create policy "chat_pending_clarifications_delete_own"
on public.chat_pending_clarifications
for delete
to authenticated
using (user_id = auth.uid());

-- Enforces "at most one open clarification per user" at the DB level; a new
-- pending question upserts and replaces an old one rather than erroring.
create unique index chat_pending_clarifications_user_id_idx
on public.chat_pending_clarifications (user_id);
