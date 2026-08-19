# Investigation: shared-member-data (Argus)

## Verified facts

**Schema (all 10 migrations read in full)**
- `public.profiles`: `id uuid primary key references auth.users(id) on delete cascade`, `role text check in ('client','staff')`, `created_at`, `full_name` (added in 0006). RLS: self-or-staff select/update (`supabase/migrations/0001_profiles_and_roles.sql:5-56`).
- `public.is_staff(uid)` — `security definer` helper reading `profiles`, used throughout as the staff-check pattern (`0001_profiles_and_roles.sql:16-29`).
- `protect_profile_role()` trigger blocks non-staff/non-service-role/non-`postgres` role changes; extended in 0002 to exempt `session_user = 'postgres'` for Supabase Studio Table Editor direct connections (`0002_fix_profile_role_trigger_dashboard_bypass.sql:20-36`).
- `handle_new_user()` trigger on `auth.users` insert auto-creates a `profiles` row defaulting to `role='client'`, pulling `full_name` from `raw_user_meta_data` since 0006 (`0006_member_lookup.sql:6-18`).
- `public.chat_messages`: `user_id uuid not null references auth.users(id) on delete cascade`; RLS select/insert own only (`0003_chat_messages.sql:2-22`). Brief keeps this FK unchanged (out of scope).
- `public.classes`: no FK to identity; seeded with 20 rows, dates `2026-08-17` through `2026-08-23` (`0004_classes.sql`).
- `public.bookings`: `user_id uuid not null references auth.users(id) on delete cascade`, unique `(class_id, user_id)`; RLS select-own-or-staff, insert/delete own; capacity enforced via `ensure_class_has_capacity()` (row-locked with `FOR UPDATE` since 0010 fix) plus `sync_class_booked_count()` triggers. Out of scope, unchanged.
- `public.time_off_requests`: `user_id`/`reviewed_by uuid references auth.users(id)`; RLS staff-only select, insert-own-staff; no UPDATE policy yet. Not touched.
- `public.search_members(search_term text)`: `security definer`, staff-gated (in-function `is_staff` check, not GRANT — GRANT is to `authenticated` broadly), queries `auth.users u join public.profiles p on p.id = u.id`, ILIKE on `u.email`/`p.full_name`, `limit 10`, `order by u.created_at desc`. Returns `table(id uuid, email text, full_name text, role text, created_at timestamptz)`.
- `public.outreach_messages`: `target_user_id uuid not null references auth.users(id) on delete cascade`, `staff_user_id uuid not null references auth.users(id) on delete cascade`, `status text check in ('draft','sent')`. Staff-only RLS, no delete policy, no client-facing policy.

## Application code referencing affected surfaces

- `app/api/staff/members/route.ts:33` — staff-gated POST calling `supabase.rpc("search_members", ...)`, returns result verbatim.
- `lib/chatbot/intents/member-lookup.ts:59,81-86` — calls `search_members`, then queries `bookings` `eq("user_id", member.id)`.
- `lib/chatbot/intents/outreach-draft.ts:36,54-59` — calls `search_members`, inserts `outreach_messages` with `target_user_id: member.id, staff_user_id: session.user.id`.
- `lib/chatbot/intents/outreach-send.ts:38,54-61,73-78` — calls `search_members`, queries/updates `outreach_messages` by `target_user_id`.
- `lib/chatbot/intents/retention-lookup.ts:31-42` — calls `search_members("")` expecting to enumerate all clients, joins `bookings.user_id` client-side, filters `member.role === "client"`.
- All 5 call sites share an identical hard-typed `MemberRow` shape depending on `search_members`'s exact current return columns.
- No other file in `app/` or `lib/` references `profiles`, `auth.users`, `search_members`, or `outreach_messages`.

## Staff account provisioning

No in-repo script exists. Process is manual (Supabase Studio Table Editor / Admin API run ad-hoc) per `docs/agent/decisions.md:104-138` — "dashboard-only staff provisioning," no invite-code or in-app admin UI.

## Environment / dependencies

- `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. No existing code constructs a service-role client — both `lib/supabase/client.ts` and `lib/supabase/server.ts` only use the anon key.
- No `xlsx`/`exceljs`, no faker/random-data library, no `tsx`/`ts-node` in `package.json`. All would be new dev dependencies.
- No Supabase CLI convention (`config.toml` absent) — every migration says "run manually in the Supabase SQL Editor."

## RLS/trigger patterns to stay consistent with

- `is_staff(auth.uid())` staff-gate pattern.
- `security definer` + `set search_path = public` for cross-RLS functions.
- `<fk column> = auth.uid()` client-owns-own-row pattern.
- No existing table has a nullable FK to `auth.users` — `members.auth_user_id` nullable+unique is new.

## outreach_messages emptiness

No seed/bulk-insert path exists; only reachable via staff chatbot draft flow. Inference (medium-high confidence, not independently verified against the live DB): effectively empty or near-empty in production.

## Risks

1. **`retention-lookup.ts:31` calls `search_members("")`** relying on the hard `limit 10` to enumerate all clients — pre-existing bug, becomes far more consequential at 300 members (returns 10 of 300, silently).
2. **5 call sites hard-depend on `search_members`'s exact return shape** via a duplicated `MemberRow` type. Any column change breaks or silently degrades all 5.
3. **`outreach_messages` will have two FK columns pointing at different tables post-migration** — `target_user_id → members(id)`, `staff_user_id → auth.users(id)` stays. Both intent files currently treat these as the same identity space.
4. **No Supabase CLI/migration tracking** — no drift detection, no transaction-wrapping precedent.
5. **`role` column semantics collision**: `search_members` returns `profiles.role`; new `members` table has no `role` field. `retention-lookup.ts:42` branches on `member.role === "client"`; other intents display `member.role` in chat replies. Biggest open planning gap — resolved in plan.md.

## Unknowns

- Actual row counts of `outreach_messages`/`profiles`/`bookings` in the live project (static repo inspection only, no live DB access during investigation).
- Whether any throwaway staff-provisioning script from earlier this session left a trace (none found — not committed, not present).
- `.env` contents (gitignored, not inspected).
- Live Postgres/Supabase extension versions (inferred available from unqualified `gen_random_uuid()` usage, not independently verified).
