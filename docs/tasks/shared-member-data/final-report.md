# Final report: Shared member data

## What changed

**Schema** (`supabase/migrations/0011_members_table.sql`,
`0012_retarget_outreach_and_search_members.sql`, applied to the live
Supabase project):
- New `public.members` table — one row per person, decoupled from
  `auth.users`, with `email` required/unique and `auth_user_id` nullable.
  RLS: staff read all, a signed-in client reads only their own row.
- `outreach_messages.target_user_id` → `target_member_id`, now referencing
  `members(id)` instead of `auth.users(id)`.
- `search_members()` rewritten to search `members` (left-joined to
  `auth.users`/`profiles`), so it finds people with or without a login.
- New `list_members_for_staff()` — fixes a real pre-existing bug where
  `retention-lookup.ts` called `search_members('')` expecting to enumerate
  all clients but silently got capped at 10.

**Shared access layer** (`lib/members/queries.ts`): `getMemberForUser`,
`getMemberById`, `searchMembers`, `listMembersForStaff`, and a single
`MemberRow` type — replaces the same type hand-duplicated across 5 files.
The 5 call sites (`app/api/staff/members/route.ts`,
`app/staff/member-search.tsx`, and the 4 chatbot intents) were migrated to
use it; `member-lookup.ts`'s booking query now correctly uses
`auth_user_id` instead of the member's own id; `retention-lookup.ts` now
filters on real `lifecycle_status` instead of the old "has no bookings"
proxy, which mislabeled brand-new members.

**Data** (`supabase/seed/`):
- `member-data.ts` — shared, deterministic generator (fixed `faker.seed`)
  used by both the preview and the real seed, so what's live is
  byte-identical to what the team reviewed.
- `seed-members.ts` — writes 300 members to Supabase, provisions 27 real
  Auth accounts (24 demo + 3 instructors, password `Welcome!`),
  correlated bookings/chat/outreach for the account-holding subset. Idempotent
  (verified via two clean back-to-back runs producing zero new rows).
- `export-members.ts` — exports the live 300 rows to a styled `.xlsx`.
- `generate-members-preview.ts` — unchanged in purpose, refactored to
  share `member-data.ts`.

## Bugs found and fixed during this task (not in the original plan)

1. **`search_members` escaping regression** — Codex's rewrite used
   `'\\%'`/`'\\_'` instead of the established single-backslash convention
   from migration `0010`. Caught in diff review, fixed before anything
   touched the live database.
2. **`faker.date.birthdate` non-determinism** — used the real current
   time as its reference point, not the seed, so re-running the generator
   at a different moment shifted a handful of birthdates by a day. Fixed
   with a pinned `refDate`, verified with two runs producing an identical
   file hash.
3. **Booking idempotency bug** — the seed script's booking logic checked
   "not already booked for this exact class" but not "does this member
   already have enough bookings," so re-running kept adding new bookings
   (72 extra across 2 runs) instead of staying flat. Fixed to skip any
   member who already has bookings from a prior run; verified with two
   clean runs producing zero new bookings.
4. **4 pre-existing junk `outreach_messages` rows** (targeting the
   `Jordan Smith`/`Design Test User` test accounts flagged in the earlier
   product audit) blocked `0012`'s new FK constraint. Inspected via REST,
   confirmed as pure test artifacts with zero real value, removed.

## Verified

- `npm run lint`: 0 errors, 2 pre-existing unrelated warnings.
- Live REST checks: `members` = 300 rows, 27 with `auth_user_id` set,
  `outreach_messages.target_member_id` correctly FK'd.
- Live chat smoke test as staff: "who needs re-engagement" → 132 real
  candidates (75 at_risk + 57 lapsed, exact match); "look up member
  Sofia" → correct real record; "draft outreach for jordane cronin" →
  real draft created against a real at-risk member.
- Seed idempotency: two clean runs after the fix produced 0 new members,
  0 new auth accounts, 0 new bookings, 0 new chat rows, 0 new outreach
  rows on the second pass.

## What remains open (not part of this task's scope)

- No UI yet surfaces `members` data beyond the existing staff
  search/chatbot intents already wired to it — a richer staff-console
  member view is future work.
- The flat-tier-vs-consumable-class-pass fork (raised by the teammate's
  appointments mockup) is still undecided.
- `members` RLS is SELECT-only by design (per the approved plan) — no
  staff-facing edit UI exists yet.
