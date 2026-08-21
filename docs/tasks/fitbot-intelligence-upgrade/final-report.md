# Final report: fitbot-intelligence-upgrade

## What changed

Made FitBot "foundationally smarter" per the approved plan, delivered
across 12 phases:

1. **Schema** — `chat_messages` gains `card`/`suggested_chips`/
   `resolved_entities`; new `chat_pending_clarifications` table (RLS,
   one-open-question-per-user) for slot-filling.
2. **Entity-extraction centralization** — one shared
   `lib/chatbot/entity-extraction.ts` for date/time/instructor/class-type/
   weekday resolution, replacing 6+ duplicated parsers; fixed a real drift
   bug (`members-by-attribute.ts` offered class-type filters that could
   never match real seed data).
3. **Typo/fuzzy tolerance** — in-house Levenshtein matching, no new
   dependency, length-scaled thresholds to avoid false positives on short
   strings.
4. **Real slot-filling** — a targeted follow-up question and a
   consume-the-answer mechanism, replacing "restate your whole request"
   dead ends, for `book-class`/`class-info`/`who-is-booked`.
5. **Conversation memory** — pronoun/shorthand resolution ("who's
   teaching that one") via a read-only lookback over recent structured
   entity metadata.
6. **Three new capabilities** — `who-is-booked` now names real attendees
   (with honesty-qualified wording when the count doesn't fully resolve);
   new `recommend-class` (client-facing "what should I book?"); new
   `now-and-next` ("what's happening now/next", with a tomorrow-fallback
   for late-night asks).
7. **Universal polished output** — new `disambiguation`/`notice` RichCard
   kinds, migrating 8 text-blob multi-match replies and 2 all-text intents
   to real interactive cards.
8. **Scoring normalization** — 8 intents that bypassed the shared
   confidence-scoring formula now use it consistently.
9. **Near-miss fallback-as-suggestions** — a genuinely unmatched message
   now offers a small set of relevant clickable suggestions instead of
   generic dead-end prose, distinct from slot-filling and disambiguation.
10. **Reload persistence** — cards and chips now survive a page reload
    instead of every historical message being overwritten with the full
    menu.
11. **Thinking animation** — a CSS-only spin on the bot avatar while a
    request is in flight, with a minimum-visible-duration floor.
12. **Full QA pass** — see below.

## What was verified

See `verification.md` for the full matrix. Everything was checked against
real data with real sessions (admin and a real client member), not static
reasoning: pronoun resolution, a complete slot-filling exchange, fuzzy-typo
matching, real attendee names, both new capabilities, fallback
reconciliation, reload persistence, and the animation's actual computed
styles during a real in-flight request.

## What was found and fixed along the way

See `review.md` for full detail. Two real bugs, both caught only by live
end-to-end testing during Phase 12 against the plan's own acceptance
criteria — not by reading the code:

1. Pronoun resolution failed for the single most natural phrasing
   ("what yoga classes are today" → "who's teaching that one") because
   `scheduleIntent` — the intent that actually answers that kind of
   question — was left out of Phase 5's entity-tracking population.
2. Slot-filling never actually completed a booking, because
   `scheduleIntent`'s loose "any bare date" fallback match always
   outscored the pending clarification's own reconciliation check.

Both are fixed and re-verified live.

One tooling detour, not a code bug: Phase 11's browser verification
initially produced bizarre, inconsistent results (200s with malformed
response shapes, 400s for valid requests) that took real investigation to
resolve — a completely separate, long-stale local clone of this repo at
`../gitfit-fitbot` (2 commits, no relation to this session's work) was
squatting on port 3000 and matched this project's dev-server launch config
by name, so the preview tooling had been silently serving that unrelated,
outdated code the entire time. Fixed by renaming the launch config to a
unique name and pointing verification at the actual project's already-running
server on port 3001.

## Deployment status

All 12 phases are committed to local `main`. Not yet pushed to
`origin/main` as of this report — that is the immediate next step.

## What remains open

- Staff-facing "recommend a class for this member" (Decision 5b) is
  explicitly out of scope for this version, per the approved plan.
- A formal multi-slot dialogue state machine was explicitly rejected in
  favor of the simpler single-slot mechanism actually needed.
- No automated test suite exists for this repo; all verification here and
  throughout the project has been live/manual, consistent with the
  project's established approach.
