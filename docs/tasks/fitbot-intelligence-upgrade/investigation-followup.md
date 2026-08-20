# Investigation follow-up: fitbot-intelligence-upgrade (Argus)

Focused on the scope-revision items only: conversation memory, real
slot-filling, typo/fuzzy tolerance, and the 3 newly-scoped capabilities.
Does not repeat facts already established in `investigation.md`.

## Verified facts

### 1. Per-request statelessness (`app/api/chat/route.ts:7-26`, `router.ts:5-25`)
- `POST` calls `routeMessage(message, session)` with no history/context of
  any kind fetched or passed. No cache, cookie-backed store, or in-memory
  object exists anywhere in `lib/chatbot/*` (grepped for
  `pending|clarif|awaiting|slot` — zero relevant hits). `chat_messages` rows
  are the only continuity, and are written but never read back mid-request
  today (only on `GET`).

### 2. `chat_messages` schema (`supabase/migrations/0003_chat_messages.sql:2-8`)
- Columns: `id`, `user_id` (FK `auth.users`), `role` (`user`/`assistant`),
  `content`, `created_at`. Indexed on `(user_id, created_at)` — an ordered
  "last N for this user" read is index-backed and cheap. RLS: own-row
  select/insert only. No structured/JSON column exists today.

### 3. Feasible state locations, given actual deployment shape
- No `runtime = "edge"` override, no custom server, no `vercel.json`, no
  pinned long-running-process config anywhere in the repo. `app/api/chat/
  route.ts` is a standard Next.js Route Handler, which on Vercel deploys as
  a serverless function by default — no guarantee of instance reuse between
  a user's consecutive turns.
- **DB-backed state (reading last-N `chat_messages`, or a new small
  `user_id`-keyed context table/row) is the only architecturally sound
  option** on this deployment shape. In-process memory (a module-level Map,
  etc.) is not reliably safe here — nothing in the repo contradicts the
  standard serverless model, and nothing pins this to a single process.

### 4. Slot-filling hook — confirmed absent
- `IntentResult` (`types.ts:14`) has no field for "this reply is a question
  awaiting a specific answer." `Intent.handle` takes no "answer this pending
  question" parameter. `routeMessage` has no pre-routing check for a pending
  clarification — every message goes straight through normal intent scoring.
- Existing "ask a clarifying question" behavior is always a disambiguation
  list requiring the user to restate the whole request (e.g.
  `who-is-booked.ts:30-33`, `book-class.ts:11`) — never a targeted
  single-field prompt whose next answer is consumed specially.
- Minimal shape needed: a "pending clarification" record (intent id +
  partially-filled args + the specific missing slot), checked before normal
  routing on the next turn, persisted somewhere that survives across
  requests — same statelessness constraint as #3, most naturally reusing
  whatever store gets chosen there.

### 5. Entity-extraction duplication — exact count
- **Date-parsing: 6 separate implementations.** `class-info.ts`,
  `book-class.ts`, `who-is-booked.ts` are byte-for-byte identical.
  `schedule.ts`'s `resolveDateFilter` is the same logic, reformatted.
  `studio-capacity.ts` is **subtly different**: checks `tomorrow` before
  `today`, and falls back to **today's date** instead of `undefined` when
  nothing matches — a real behavioral divergence to preserve, not just
  formatting noise. `time-off.ts`'s `resolveRequestedDate` (exported, reused
  by `time-off-review.ts`) is a 6th independent implementation.
- **Time-parsing: 3 identical implementations** (`class-info.ts`,
  `book-class.ts`, `who-is-booked.ts`), same regex, same logic.
- **Instructor name list**: 5 identical occurrences across 4 files.
- **Weekday list**: 6 files, all the same 7 values (some as separate arrays,
  same content).
- **Class-type list**: `["yoga","cycling","hiit"]` duplicated in 4 files,
  **except** `members-by-attribute.ts` has a superset (`"pilates"`,
  `"strength"`, `"cardio"`) that includes values not present in
  `classes.type`'s actual seed data (`0004_classes.sql` only ever inserts
  Yoga/Cycling/HIIT) — pre-existing drift, unrelated to this task, but the
  planner should know the "small closed set" assumption is slightly
  violated by that one intent.
- **Correction to a claim in the task prompt**: a "broken doubled-backslash
  regex" was asserted as an established finding from a prior review pass.
  Grepped the entire `lib/chatbot` tree for quadruple-backslash regex
  literals — found none; all `\\b`-style occurrences are correctly-escaped
  template-literal usage. Could not substantiate this claim from current
  repo contents — treat as unverified, not fact. (It's possible this refers
  to a bug found and already fixed earlier in the session, in the
  `fitbot-capability-expansion` task — not present in the code as it
  stands now.)

### 6. Fuzzy matching — no existing dependency
- `package.json`: no fuzzy-matching/edit-distance library present at all.
  Scale is small enough (3 instructors, 3 class types, 7 weekdays, 300
  members checked against a bounded candidate list, not arbitrary free
  text) that a ~15-line deterministic edit-distance function is plausibly
  sufficient without a new dependency.

### 7. `who-is-booked.ts`'s naming limitation — a code gap, not a schema limitation for real usage
- The existing comment is accurate for **seed data**: `classes.booked_count`
  is set independently during seeding and doesn't correspond 1:1 to real
  `bookings` rows (only ~25 of 300 seeded members hold real accounts with
  matching bookings rows).
- However, **real bookings made through the live app always insert a
  genuine `bookings` row with a real `user_id`**, joinable to a name via
  `bookings.user_id → members.auth_user_id → members.full_name` (or via
  `profiles.full_name`). A fixed `who-is-booked` **can** name real attendees
  for real bookings today.
- Wrinkle: `booked_count` will still exceed the count of *nameable*
  attendees for classes carrying seed-phantom count — a naming feature must
  not imply the named list is exhaustive, or the numbers won't add up for
  staff who notice.

### 8. Class recommendation intent — data confirmed available and well-shaped
- `members.goals`, `preferred_class_types`, `fitness_level` all exist as
  claimed. Seed format: `goals`/`preferred_class_types` are
  semicolon-space-joined strings of 1-2 picks (e.g. `"Yoga; HIIT"`), not
  arrays. `preferred_class_types` picks come from the exact same 3-value
  closed set as `classes.type`'s real values, same casing — a clean,
  low-risk match via `.split("; ")` + case-insensitive comparison, the same
  pattern already used elsewhere. `fitness_level` is a single value from a
  closed 3-value set, unconditionally populated for every member (no
  null-handling gap).

### 9. "What's happening now/next" — portability confirmed
- `app/staff/page.tsx`'s `isCurrentOrNext` (lines 13-18) takes a plain
  class-shaped object and a `Date`, with no dependency on staff-only data,
  session, or role — genuinely portable into a shared helper as-is.
- Two caveats for reuse: (a) the page only ever calls it against
  already-today-filtered classes — a shared helper must keep that
  precondition or take the date explicitly; (b) the page's separate "next"
  computation is less reusable — it only returns a next class if nothing
  remains later *today*, with no fallback to tomorrow's first class if the
  day's schedule is exhausted. A general-purpose "what's next" intent needs
  that gap decided/extended, not just extracted verbatim.

## Inferences

- **High confidence:** DB-backed conversation memory is the only
  architecturally sound choice — nothing in the repo suggests any
  deployment guarantee that would make in-process memory safe.
- **Medium confidence:** a structured pending-clarification store is
  preferable to re-parsing raw message history specifically for
  slot-filling (needs an explicit machine-readable marker), while
  plain last-N-message lookback for pronoun resolution ("that one") could
  reasonably use a simpler read-only history query. These may end up being
  two different mechanisms for two different sub-features even though the
  brief frames them together — the planner should decide whether to unify
  them into one store or keep them separate.
- **Medium confidence:** centralizing date/weekday/instructor/class-type
  lists is low-risk for 5 of 6 date-parsers (near-identical) but
  `studio-capacity.ts`'s different fallback behavior must be preserved as
  an explicit parameter, not silently normalized away.

## Unknowns

- Whether conversation-memory and slot-filling should share one store or
  use two — a design decision, not something investigation can resolve.
- Whether staff/admin sessions should see attendee names sourced via
  `profiles` (staff/admin accounts) as well as `members` (client accounts)
  for `who-is-booked` — both join paths exist and are populated, but a
  booking's `user_id` could in principle belong to a staff/admin account
  too (RLS doesn't prevent staff from booking classes).
- No repo-visible confirmation of actual Vercel deployment settings
  (dashboard config isn't in-repo) — the serverless conclusion is inferred
  from absence of contrary configuration, not a positive artifact.

## Risks

- Any new context/pending-clarification store needs its own RLS policy
  (own-row read/write), mirroring `chat_messages`' pattern — a naive
  implementation that forgets RLS either blocks legitimate access or leaks
  cross-user state.
- `route.ts:34`'s existing bug (unconditionally overwrites historical
  `suggestedChips` with the full role menu on GET) sits in the exact file
  this task's memory work will touch — worth double-checking it isn't
  accidentally worsened.
- A `who-is-booked` naming feature must not imply completeness for classes
  where `booked_count` includes unattributable seed padding.
- Six independent date-parsers is real duplication risk for any future
  date-format expansion — each would need updating in up to 6 places today.
