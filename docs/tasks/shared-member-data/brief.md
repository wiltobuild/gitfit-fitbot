# Brief: Shared member data (schema + 300-member seed + spreadsheet export)

## Scope

Give the GitFit suite a shared "member" identity that every module can
reference regardless of whether the person has a Supabase Auth login, then
populate it with realistic demo data.

1. **Schema**: new `public.members` table, decoupled from `auth.users`.
   - Fields: `id`, `email` (required, unique), `full_name`, `phone`,
     `auth_user_id` (nullable, unique FK to `auth.users(id)`), `join_date`,
     `membership_tier`, `membership_status`, `last_visit_date`,
     `lifecycle_status` (`active`/`at_risk`/`lapsed`), `goals`,
     `preferred_class_types`, `fitness_level`, `staff_notes` (staff-only
     visibility), `is_instructor`.
   - RLS: staff read all; a signed-in client reads only the row where
     `auth_user_id = auth.uid()`; service role bypasses.
   - Retarget `outreach_messages.target_user_id` from `auth.users(id)` to
     `members(id)` — outreach needs to reach people without accounts.
   - Rewrite `search_members()` to search `members` (left-joined to
     `auth.users`/`profiles` when an account exists) instead of only
     `auth.users`, so staff lookup finds all 300, not just account
     holders.
   - New numbered migration file in `supabase/migrations/`, matching the
     existing style (see `0001`–`0010`).
2. **Seed data**: a reproducible (fixed-seed), idempotent (upsert-by-email)
   script that generates and inserts 300 synthetic members, run against
   the live Supabase project (not just written).
   - `join_date` spread over ~2 years; `lifecycle_status` skewed roughly
     55% active / 25% at_risk / 20% lapsed; varied `membership_tier` and
     fitness-profile fields.
   - Emails on an obviously-fake/synthetic domain — never a real domain,
     since this data may later sit behind an outreach "send."
   - ~20–30 of the 300 also get real Supabase Auth accounts (admin API,
     `email_confirm: true`, fixed demo password), matching the pattern
     already used for the 4 staff accounts.
   - For the account-holding subset: a few `bookings` against existing
     `classes` rows (capacity-respecting), a few `chat_messages` history
     rows, and a handful of `outreach_messages` drafts targeting
     at_risk/lapsed members.
   - Script lives under `supabase/seed/`, separate from
     `supabase/migrations/`.
3. **Spreadsheet export**: after seeding, export the full 300-row
   `members` dataset to a formatted `.xlsx` file for sharing with the
   other 3 capstone teammates — readable column widths, a styled header
   row, no sensitive fields (no passwords/secrets).

## Out of scope

- Any change to `bookings` or `chat_messages`'s existing FK to
  `auth.users` — those stay account-bound as-is (you must be logged in to
  book/chat today; no change needed).
- Building any new UI to surface `members` data — this task is schema +
  data + export only. Wiring the Staff Console/Fitbot/outreach UI to
  actually *use* the new table is future work.
- LLM integration (explicitly out of scope suite-wide until Phase 11 per
  `docs/tasks/gitfit-suite-buildout/brief.md`).
- Real outbound email sending — outreach stays confirmation-gated and this
  task does not touch that gate.

## Acceptance criteria

1. `supabase/migrations/0011_*.sql` (or next free number) creates
   `members` with the fields above, correct RLS, and successfully applies
   against the live Supabase project.
2. `outreach_messages.target_user_id` references `members(id)`;
   `search_members()` returns results for members without accounts.
3. Existing tables/policies (`bookings`, `chat_messages`,
   `time_off_requests`, `classes`) are unaffected — no regressions.
4. Running the seed script against the live project results in exactly
   300 rows in `members`, with the specified distribution and a fake
   email domain; re-running it does not create duplicates.
5. ~20–30 members have real, working Supabase Auth logins (fixed demo
   password), verifiable by signing in as one.
6. Correlated `bookings`/`chat_messages`/`outreach_messages` rows exist
   for the account-holding subset, without violating capacity or other
   existing constraints/triggers.
7. An `.xlsx` file with all 300 members and all non-sensitive fields
   exists in the repo, opens cleanly, and is easy to skim (reasonable
   column widths, styled header).

## Preflight state

- Branch: `main`, working tree clean aside from unrelated local dev-only
  files (`.claude/launch.json`, `.gitignore` tweaks — not part of this
  task).
- Relevant existing behavior: `profiles`/`auth.users` is currently the
  only identity model (see `supabase/migrations/0001`–`0010`). No
  `members` table, no synthetic dataset, no spreadsheet export exists yet.
  Plan basis: `docs/tasks/shared-member-data/` artifact shared with the
  team at https://claude.ai/code/artifact/ac18cde2-167b-4024-aa08-35c79d4ec78b
  (already reviewed/discussed with the user in this session).
- Workflow row: **Database/migration** per `docs/agent/workflow.md` —
  Argus (+ data-integrity check) → Athena → **approval** → Codex → Apollo.
