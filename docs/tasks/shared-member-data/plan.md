# Plan: Shared member data (schema + 300-member seed + spreadsheet export)

## Addendum (2026-08-19): fields added after team review + access layer

The team reviewed a generated preview of the 300-row dataset
(`supabase/seed/generate-members-preview.ts`) and requested two additions
beyond this plan's original field list:

- `first_name`, `last_name` — split out alongside `full_name`.
- `birthdate` — ages 18-68.

Both are added to the `members` table in Phase A below. No other field
changes.

Additionally, per user request, Phase B/D now include a shared access
layer (`lib/members/queries.ts`) — `getMemberForUser`, `getMemberById`,
`searchMembers`, `listMembersForStaff` — so every product reads members
through one module instead of each re-writing raw Supabase queries (the
root cause of the `MemberRow` duplication Argus flagged across 5 files).
The 5 existing call sites are migrated to use this layer as part of
Phase B's rewrite, rather than just renamed in place.

**Execution note**: this repo has no Supabase CLI / direct Postgres
connection configured (confirmed: no `psql`, no `DATABASE_URL` in
`.env.local`) — consistent with the existing convention that all 10 prior
migrations were applied by pasting into the Supabase SQL Editor. Migration
SQL will be written to `supabase/migrations/` as usual; the user runs it
in the SQL Editor, and each phase is verified afterward via the Supabase
REST API (the same approach used to verify the 4 staff accounts and the
RLS policies earlier this session).


## Decision: `search_members()` return shape and the `role` field replacement

### Evidence
`search_members()` currently returns `profiles.role`, duplicated as a hard `MemberRow` type in 5 call sites. The new `members` table has no `role` — it has `lifecycle_status`/`membership_status`/`is_instructor`. `retention-lookup.ts:42` branches on `member.role === "client"`; other intents display `member.role` in chat replies.

A second problem: `member-lookup.ts:81-86` queries `bookings.user_id = id` using the `id` `search_members` returns. Today that's `auth.users.id`. Once `search_members` searches `members` and returns `members.id`, that's no longer the same value as `auth.users.id` — `bookings.user_id` still references `auth.users(id)` (unchanged). Left as-is, `member-lookup.ts`'s booking lookup would silently return zero bookings for everyone, including account holders with real bookings.

### Options
1. Touch only SQL, leave all 5 TS call sites as-is — synthesize a `role`-shaped value in SQL. Satisfies the letter of "schema only" but leaves the booking join silently broken.
2. Expand `search_members()`'s return shape (add `auth_user_id`, `lifecycle_status`; keep `role` as a computed staff/client flag) and make the minimal corresponding edits to the 5 call sites — swap booking/outreach joins to `member.auth_user_id` where account-bound, swap `role === "client"` checks to `lifecycle_status` where that's really what's being asked. Narrow, mechanical, no new intent logic.
3. SQL only, document the 5 files as a known-broken follow-up.

### Recommendation
Option 2.

### Why
Option 1 ships a change that makes `member-lookup.ts` return wrong data for every staff query, silently. Option 3 leaves 5 files broken indefinitely. Option 2's edits are property renames plus one join-key swap — no new capability, existing capability kept working.

### Approval requested
Confirm Option 2, and that touching the 5 TS files (rename-only) stays in this task's scope.

---

## Decision: `search_members("")` returning only 10 of 300 rows (retention-lookup.ts)

### Evidence
`retention-lookup.ts:31` calls `search_members("")` to enumerate all clients, then filters locally. The function has a hard `limit 10`. At 300 members this silently returns 10 arbitrary rows, and retention will report near-empty results almost every time — directly undermining this task's own purpose.

### Options
1. Fix now: add `public.list_members_for_staff()` (no search term, no limit), `retention-lookup.ts` calls it instead. Small, additive SQL; one-line TS change.
2. Defer: leave as-is, flag as a follow-up, record in `decisions.md`.

### Recommendation
Option 1.

### Why
This bug's severity is a direct consequence of this task's own acceptance criteria (300 real members). The fix is small, additive, and doesn't change any existing call site's behavior.

### Approval requested
Confirm including the `list_members_for_staff()` fix, or defer with a recorded follow-up.

---

## Decision: `outreach_messages` two-FK-tables asymmetry

### Evidence
`target_user_id` retargets to `members(id)`; `staff_user_id` stays `auth.users(id)` (staff are always account holders). Both intent files already treat `member.id` as an opaque id from `search_members` — under Decision 1 Option 2, no additional code change is needed for the insert/query themselves.

### Options
1. Pure SQL retarget, no column rename.
2. Also rename `target_user_id` → `target_member_id` for clarity, updating both intent files' column names.

### Recommendation
Option 2.

### Why
Leaving the column named `target_user_id` while it points at `members(id)` is a persistent foot-gun for the next editor (this investigation itself nearly mis-scoped it). The rename is two key edits, no behavior change.

### Approval requested
Confirm the column rename `target_user_id` → `target_member_id`.

---

## Decision: library choices for seed script and xlsx export

### Evidence
No `xlsx`/`exceljs`, no faker-family package, no `tsx`/`ts-node` in `package.json`.

### Recommendation
`tsx` (script runner) + `@faker-js/faker` (deterministic synthetic data, `faker.seed(n)`) + `exceljs` (styled xlsx export — the free `xlsx`/SheetJS package can't do styled headers/column widths without the paid build). All three devDependencies only, never imported by the Next app.

### Approval requested
Approve adding `tsx`, `@faker-js/faker`, `exceljs` as devDependencies.

---

## Decision: demo password for provisioned Auth accounts

### Evidence
The 4 existing staff accounts use a fixed password (`Welcome!`) via the Admin API with `email_confirm: true`, provisioned ad-hoc this session.

### Recommendation
Reuse `Welcome!` for the ~20-30 seeded member accounts too — one password for the whole team to remember, documented in this task's docs (not `.env`, not committed as a "secret" — it's a shared non-production demo credential).

### Approval requested
Confirm reusing `Welcome!`, and that documenting it in `docs/tasks/shared-member-data/` is fine.

---

## Decision: migration file structure

### Recommendation
Split into two files: `0011_members_table.sql` (new table + RLS only) and `0012_retarget_outreach_and_search_members.sql` (the riskier FK retarget + function rewrite + optional `list_members_for_staff()`). Matches the existing "run manually, verify, then move on" convention and keeps each file independently reviewable.

### Approval requested
Confirm the two-file split and numbering `0011`/`0012`.

---

## Decision: `members` RLS — UPDATE policy scope

### Evidence
The brief specifies only staff-read-all and client-read-own-row. No UPDATE policy for anyone is specified — table is written only via the service-role seed script (RLS-bypassing) in this task.

### Recommendation
SELECT-only RLS in this task (staff-all, client-own-row). No UPDATE/INSERT/DELETE policy for clients or staff yet — trivial to add later when a staff-console UI needs it. No tamper-guard trigger needed since no client-writable path exists.

### Approval requested
Confirm SELECT-only RLS for now, staff UPDATE deferred to the future staff-console task.

---

## Phased plan

**Phase A — `members` table migration (SQL only)**
`0011_members_table.sql`: create `public.members` with all brief-specified fields, RLS enabled, staff-all-select + client-own-row-select policies via `is_staff()`. Apply manually in the SQL Editor; verify with a plain select and an RLS check. No app-code changes.

**Phase B — Retarget `outreach_messages` + rewrite `search_members()` + optional `list_members_for_staff()` + TS edits**
`0012_retarget_outreach_and_search_members.sql`: retarget/rename `outreach_messages.target_user_id` → `target_member_id` referencing `members(id)`; rewrite `search_members()` per Decision 1; add `list_members_for_staff()` per Decision 2. Apply manually; spot-check with 2-3 manually inserted test rows before the full seed exists. Update `app/api/staff/members/route.ts` and the 4 chatbot intent files to match. `npm run lint` + manual chatbot smoke test.

**Phase C — Seed script**
Add `tsx`, `@faker-js/faker`, `exceljs` as devDependencies. `supabase/seed/seed-members.ts`: service-role client, `faker.seed(<fixed>)`, 300 members with the specified lifecycle distribution/join-date spread/fake email domain, upsert on `email`. Provision ~20-30 Auth accounts (Admin API, `email_confirm: true`, `Welcome!`), linking `auth_user_id`. For the account-holding subset: capacity-respecting bookings, a few chat_messages, a handful of outreach_messages drafts targeting at_risk/lapsed members. Run against the live project; verify count = 300 and idempotency on re-run.

**Phase D — Spreadsheet export**
`supabase/seed/export-members.ts`: query all 300 rows, exclude `staff_notes` and any non-shareable field, write a styled `.xlsx` (bold header, readable column widths) into the repo. Open to confirm it renders cleanly.

## Acceptance criteria

1. `0011`/`0012` both apply cleanly against the live Supabase project, in order.
2. `members` has all brief-specified fields/constraints, RLS enabled, staff-all-select + client-own-row-select verified.
3. `outreach_messages.target_member_id` FKs to `members(id)`; `staff_user_id` unchanged.
4. `search_members()` returns account-less members too; an unbounded staff query returns more than 10 rows once 300 exist.
5. `bookings`/`chat_messages`/`time_off_requests`/`classes` and their RLS/triggers unchanged, smoke-tested.
6. `npm run lint` clean; manual smoke tests of lookup/retention/draft/send all return correct, non-empty results.
7. Seed run results in exactly 300 rows, lifecycle distribution ~55/25/20, join_date spread ~2 years, all emails on a clearly-synthetic domain.
8. Re-running the seed leaves the count at exactly 300 (no duplicates).
9. 20-30 members have non-null `auth_user_id`; a seeded login works end-to-end.
10. Correlated bookings/chat_messages/outreach_messages exist for the account-holding subset, no capacity violations.
11. `.xlsx` with all 300 members' non-sensitive fields exists, opens cleanly, styled header, readable columns.
12. `docs/agent/decisions.md` gets an entry recording each approved decision above.

Not implemented yet — stopping here for approval on the seven decisions above.
