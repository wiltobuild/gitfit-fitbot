# Plan

STATUS: COMPLETE
TASK: Fix Fitbot class-type + UTC-date bugs — batch 3 of 4 from the
full-app audit (2026-08-24/25). Implemented directly by the orchestrator
(no chuck/cas/dean subagent loop this batch, per explicit user instruction
to conserve session budget after batch 3's planner stalled).

## Steps

- [x] 1. Add missing class types (Boxing, Pilates, Strength) to
      lib/chatbot/entity-extraction.ts's CLASS_TYPES
  - Do: CLASS_TYPES only lists yoga/cycling/hiit; real class types also
    include Boxing, Pilates, Strength (seed data 0004_classes.sql,
    appointments UI). Add the three missing types so resolveClassType
    matches them.
  - Done when: resolveClassType("book me into a pilates class") === "pilates",
    same for boxing/strength; existing yoga/cycling/hiit matches unaffected.
    npm test, build, lint clean.
  - Touches: lib/chatbot/entity-extraction.ts.

- [x] 2. Fix UTC-vs-local date bug in getMemberWeeklyActivity
  - Do: lib/members/queries.ts's getMemberWeeklyActivity used
    `.toISOString().slice(0,10)` (UTC) for week boundaries instead of the
    file's own local-date formatDateForQuery() helper (already used
    correctly by getMemberStreak). Switch to formatDateForQuery.
  - Done when: build/lint/test clean; code reads local date, matching every
    other date computation in the file.
  - Touches: lib/members/queries.ts.

- [x] 3. Fix UTC-vs-local date bug in recommend-class.ts, my-goals.ts,
      instructor-classes.ts
  - Do: same UTC .toISOString() pattern for "today"/date-range boundaries
    in these three chatbot intent handlers. Replace with local-date
    construction matching the pattern in app/api/appointments/classes/route.ts
    / lib/members/queries.ts's todayDate()/formatDateForQuery().
  - Done when: build/lint/test clean; no remaining `.toISOString().slice(0,10)`
    (or equivalent UTC-serialization) used for local "today" comparisons in
    these three files.
  - Touches: lib/chatbot/intents/recommend-class.ts,
    lib/chatbot/intents/my-goals.ts, lib/chatbot/intents/instructor-classes.ts.

## Notes
- No chuck/cas/dean loop this batch — implemented directly, verified by
  build/lint/test run by the orchestrator. User explicitly authorized this
  deviation to conserve session budget.
- Also updated 4 hardcoded yoga|cycling|hiit scoring regexes (class-info.ts,
  members-by-attribute.ts, book-class.ts, who-is-booked.ts) to include the
  3 new class types — same root cause as step 1, needed for the fix to be
  complete end-to-end (these gate intent-routing confidence scores).
- getMemberWeeklyActivity fixed via reusing formatDateForQuery (already
  exported/local in the same file). recommend-class.ts/my-goals.ts/
  instructor-classes.ts fixed by exporting and reusing todayDate() from
  lib/members/queries.ts instead of duplicating local-date construction.
- Confirmed via grep: zero remaining `toISOString().slice` UTC-date
  patterns anywhere in lib/ or app/.
- Requirement test: tests/agent_requirements/resolve-class-type.test.ts (GREEN)
