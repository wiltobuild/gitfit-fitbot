# Verification: fitbot-intelligence-upgrade

All verification below was run against the real dev server (an existing
long-running instance discovered on port 3001 after a genuinely separate,
unrelated, long-stale clone at `../gitfit-fitbot` was found squatting on
port 3000 — see `final-report.md`'s "What was found and fixed" for that
tooling detour) and the live Supabase project. Sessions used:
`wil.sheppard@pursuit.org` (admin) and `dora.ledner@gitfit.demo` (real
seeded client member).

## Automated checks (every phase, after every fix)

- `npm run lint` — clean on every phase's final state (3 pre-existing,
  unrelated warnings only).
- `npx tsc --noEmit` — clean on every phase's final state.

## Conversation memory (Decisions 1, 5)

- "what yoga classes are today" → "who's teaching that one" correctly
  resolved to the same class (Friday Flow / Sofia Martinez) without the
  second message containing any date or class-type token — required the
  Phase 12 `schedule.ts` fix (see `review.md`); re-verified after the fix
  with a real POST/response pair showing the resolved reply.
- `chat_messages.resolved_entities` confirmed populated on the relevant
  assistant turns via the same live responses.

## Slot-filling (Decision 2)

- "book me into hiit" (no date/time) → targeted clarifying question,
  not a disambiguation list.
- "Friday at 7am" as the next message → correctly completed the original
  booking attempt (real DB write attempted, correctly reported "already
  booked" against real prior test state) — required the Phase 12
  `schedule.ts` fix; failing behavior and fix both verified live with real
  request/response pairs.
- A pending clarification was correctly dropped when the next message
  clearly matched a different intent's real trigger phrase ("look up
  member Dora Ledner") — verified the member lookup completed normally,
  then confirmed the pending row was actually gone (not just skipped) by
  sending another bare date afterward and confirming it went to the
  near-miss fallback rather than being consumed as a stale answer.

## Typo/fuzzy tolerance (Decision 3)

- "cyclng" correctly fuzzy-matched to "Cycling" and returned a real class
  (verified against a date with an actual Cycling class after an initial
  test against a date with none, which correctly returned zero results —
  not a false negative).
- "hitt" (4 characters) correctly received zero fuzzy tolerance per the
  approved length-scaled threshold (exact-match-only ≤4 chars),
  confirmed by the unfiltered class list it returned.

## The 3 new capabilities (Decision 5)

- `who-is-booked` against a real class with real bookings returned actual
  attendee names ("3 attendee(s) on record: Wil Sheppard, Cleveland
  Boyle, Stuart Kutch") with the honesty-qualified wording correctly
  applied (15 booked, 3 named → qualifier present).
- `recommend-class` (as Dora Ledner, a real client with real
  `preferred_class_types`/`goals`) returned 3 real upcoming Yoga classes
  with a reply referencing her actual goal ("Build endurance").
- `now-and-next` correctly reported "Nothing's running right now — next
  up: Friday HIIT..." against the real live schedule at test time.

## Fallback/slot-filling reconciliation (Decision 6)

- A genuinely unmatched message ("purple elephant banana question")
  correctly triggered the curated 3-4 chip fallback (not the full role
  menu, not slot-filling).
- A message matching an intent with a missing slot correctly triggered
  slot-filling (see above), never the near-miss path.

## Carried-forward items (Decisions 7, 8, 9)

- Pre-existing intents re-tested after scoring normalization
  (`my-appointments`, `my-activity`) still route and reply correctly —
  `my-activity` confirmed rendering as a `notice` card, not plain text.
- Reload persistence confirmed via a real `GET /api/chat` after a mixed
  conversation: each historical assistant message returned its own
  actually-stored `card`/`suggested_chips` (including the curated
  fallback's small chip set), not the previous unconditional full-menu
  overwrite.
- The typing-indicator spin animation confirmed live via a `MutationObserver`
  capturing real computed styles during an in-flight request:
  `animationName: "spin-arc"`, `1.1s`, `infinite`. The global
  `prefers-reduced-motion` rule (`animation-iteration-count: 1 !important`
  on `*, *::before, *::after`, pre-existing in `globals.css`) covers
  `.animate-spin-arc` via its universal selector — confirmed by reading the
  rule directly rather than emulating the media feature (not supported by
  this environment's resize tool).

## Not automated / manual-only

- No automated test suite exists for this repo (consistent with the
  project's established testing approach throughout this session) — all
  verification above is live/manual against real data and real sessions.
