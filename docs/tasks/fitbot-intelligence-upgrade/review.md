# Review: fitbot-intelligence-upgrade

Each phase's Codex diff was reviewed manually and verified live (not just
read) before commit. Findings below are what survived that review — every
issue was caught and fixed in the same phase it was found or during the
Phase 12 QA pass, nothing was deferred.

## Phases 1–3 (schema, entity centralization, fuzzy tolerance)

No findings — migration applied cleanly, `studio-capacity.ts`'s
tomorrow-before-today divergence preserved correctly via the explicit
`fallbackToToday` option, `members-by-attribute.ts`'s
pilates/strength/cardio/boxing drift removed, fuzzy matching's length-scaled
thresholds implemented exactly as specified.

## Phase 4 (slot-filling mechanism)

No findings on review — the pending-clarification pre-routing check, the
re-score-first reconciliation rule, and the three initial slot-filling-aware
intents (`book-class`, `class-info`, `who-is-booked`) all matched spec.
(A real interaction bug between this mechanism and `schedule.ts`'s matching
was later caught live in Phase 12 — see below.)

## Phase 5 (conversation memory)

No findings on review. (The `resolvedEntities` population gap in
`schedule.ts` was also only caught live in Phase 12, not during this
phase's own review — `class-info`/`who-is-booked`/`book-class`/
`member-lookup` were populated correctly per spec, but `schedule.ts` — the
intent that actually answers "what classes are today"-style questions —
was not in scope and turned out to be the one users would hit first.)

## Phases 6–11

No findings — real attendee names with honesty-qualified wording, the two
new intents, disambiguation/notice card migration, scoring normalization,
near-miss fallback, reload persistence, and the thinking animation all
matched spec and passed lint/tsc on first implementation.

## Phase 12 (full QA pass) — 2 real bugs found and fixed, both via live testing

- **Fixed — pronoun resolution silently failed for the most common
  phrasing:** the plan's own acceptance-criteria example
  ("what yoga classes are today" → "who's teaching that one") was tested
  live and failed — the second message returned an unrelated 8-option
  disambiguation card instead of resolving to the class from the first
  turn. Root cause: `scheduleIntent` (which handles "what classes are
  today"-shaped questions — the natural way to ask this) was never
  included in Phase 5's `resolvedEntities` population; only
  `class-info`/`who-is-booked`/`book-class`/`member-lookup` were. Fixed by
  adding `id` to `schedule.ts`'s query and setting `resolvedEntities` when
  it resolves to exactly one class.
- **Fixed — slot-filling never actually completed a booking:** also
  directly from the plan's acceptance criteria ("book me into yoga" →
  "Tuesday at 6pm" should complete the booking). Live testing showed the
  second message ("Friday at 7am") always got routed to `scheduleIntent`
  instead of completing the pending `book-class` clarification. Root
  cause: `scheduleIntent` had a standalone fallback that matched ANY bare
  date/weekday-shaped message at score 1, even with zero other
  schedule-shaped wording — which meant the router's "did a different
  intent win" reconciliation check (Decision 2) always saw a non-`book-class`
  winner for exactly the shape of message a slot-filling answer takes,
  discarding the pending clarification every time. Removed that fallback —
  a bare date with nothing else schedule-shaped is exactly the shape of a
  slot-filling answer, not a fresh schedule query. Verified live: the same
  exchange now correctly attempts the booking (and correctly reports
  "already booked" against the real DB state from prior test runs).
- **Verified correct, initially suspected as a bug:** a bare-name lookup
  ("who is Dora Ledner") was consumed as an answer to a pending
  clarification instead of being recognized as a member lookup — but
  `member-lookup`'s actual trigger patterns require "who is the member" or
  "look up member", not a bare name, so this is a pre-existing
  message-recognition gap unrelated to this task's routing logic, not a
  bug introduced here. Retested with `"look up member Dora Ledner"` (a
  real trigger match) and confirmed the pending clarification was dropped
  correctly.
- **Verified correct, initially suspected as a bug:** `who-is-booked`
  against a Cycling-typo query returned no results — turned out there was
  genuinely no Cycling class on that date in seed data. Retested against a
  date with a real Cycling class and confirmed the "cyclng" → "Cycling"
  fuzzy match worked correctly. Also confirmed "hitt" (4 chars) correctly
  got zero fuzzy tolerance per the approved length-scaled threshold policy
  (exact-match-only ≤4 chars) — not a false negative, working as designed.

## What was not built

Staff-facing "recommend for this member" (Decision 5b, explicitly scoped
out for v1) and a formal multi-slot dialogue state machine (Decision 2,
explicitly rejected as over-engineering for this app's actual need) remain
out of scope, per the approved plan.
