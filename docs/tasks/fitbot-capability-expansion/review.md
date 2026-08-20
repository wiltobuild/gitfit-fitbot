# Review: fitbot-capability-expansion

Each phase's Codex diff was reviewed manually (not by trusting the implementer's
self-report) before commit. Findings below are what survived that review —
issues caught and fixed are marked as such; nothing was deferred.

## Phase 4 (admin time-off approve/deny)

- **Fixed — identity resolution bug (confirmed functional-blocking):**
  `time-off-review.ts` and the `pending-time-off` chip resolved staff/admin
  identity via `listMembersForStaff()` (the `members` table), but real
  staff/admin accounts are never rows there (it only holds the 300 synthetic
  gym members + 3 client-role instructor accounts). The filter could never
  match anyone, so approve/deny was completely non-functional. Rewrote both
  to resolve via `profiles` instead. Also backfilled `full_name` on the 4
  admin profiles (created via the raw Admin API with no user metadata).
- **Fixed — scope regression:** `CHIP_ROLES["my-activity"]` was widened to
  `["client","staff","admin"]` without being asked, contradicting the
  approved plan's explicit client-only decision. Reverted.

## Phase 5 (new cards, 4 new capabilities)

- **Fixed — broken regex:** `book-class.ts`'s `resolveTime()` used a regex
  *literal* with doubled backslashes (`/\\b(\\d{1,2}).../`), which in a
  literal means "match a literal backslash character" rather than a word
  boundary/digit escape — silently broke all time-of-day filtering (e.g.
  "3pm"). Fixed to single backslashes.
- **Fixed — wrong enum value:** `roster-summary.ts` filtered
  `lifecycle_status` against `"at-risk"` (hyphen); the actual DB/app-wide
  value is `"at_risk"` (underscore, confirmed against `retention-lookup.ts`
  and the seed data). At-risk members were silently excluded from the
  "needing attention" card — only lapsed members ever appeared.
- **Fixed — missing filters:** `class-info.ts` only filtered by class type,
  ignoring date/time/instructor despite the plan calling for the same
  filter set as `book-class.ts`'s `findClasses`. Added date/time/instructor
  filtering so "tell me about the 3pm yoga class" actually narrows instead
  of always listing every yoga class.

## Phase 6 (intent-matching confidence scoring)

- **Fixed — additive-scoring regression (3 files, confirmed via live
  testing, not just static reasoning):** `member-lookup.ts`,
  `outreach-draft.ts`, and `workout-plan.ts` summed
  `scoreTriggerFamily(...) + scoreEntity(...)` instead of gating the entity
  bonus on the trigger firing (`trigger * (1 + entity)`, the safe pattern
  used correctly elsewhere). Each intent's entity pattern was broad enough
  (any two consecutive words; "for X"/"back X"; common planning verbs like
  "quick"/"plan"/"give me") to score 1 with **zero trigger match**, which
  then won ties by registration order against the actually-correct intent.
  Live-confirmed hijacked messages: "what's on the schedule today" →
  wrongly routed to member-lookup instead of schedule; "can you write
  something to win back Sarah" → wrongly routed to member-lookup instead of
  outreach-draft. Fixed by switching all three to the multiplicative gate.
- **Fixed — extraction not updated alongside broadened trigger (2 files):**
  after Phase 6 broadened `member-lookup.ts`'s trigger to catch "pull up
  ... account" phrasing and `outreach-draft.ts`'s to catch "write something
  to win back X", neither file's `extractSearchTerm()` stripped the new
  trigger phrase, so the search term was the entire original message and
  every such request returned "no members found" even for real members.
  Fixed both extraction functions.
- **Fixed — pre-existing database gap, unrelated to this build's own
  changes but discovered while live-testing Phase 6's routing fixes:**
  `list_members_for_staff()` (defined in migration 0012, long before this
  build) never returned `is_instructor` or `membership_tier`. This silently
  broke two Phase 5 capabilities: `instructor-classes` could never resolve
  any instructor by name (its `is_instructor` filter was always comparing
  against `undefined`), and `roster-summary`'s tier breakdown always read
  "300 not set". Migration 0015 widens the function's return columns;
  applied live and verified against real data (Sofia Martinez: previously
  unresolvable, now resolves with `is_instructor: true`,
  `membership_tier: "basic"`).

## Phase 7 (defense-in-depth chip filter)

No findings — mechanical addition, verified live that chips still render
correctly and the filter doesn't strip any role-appropriate chip.
