# Brief: Schedule queries, client + staff (Phase 5)

## Scope

First real domain intent(s) on the Phase 4 router. Read-only schedule
queries against a new canonical `classes` table (seeded from the existing
`app/appointments/data/classes.json` data — same 20 classes, Mon Aug 17
through Sun Aug 23 2026, which is the current week relative to today's
real date). Phase 6 owns booking/reservation mutations against this same
table; Phase 5 is read-only.

- `supabase/migrations/0004_classes.sql` — `classes` table (id text pk to
  match existing `class_NNN` IDs, name, type, instructor, class_date date,
  start_time time, duration_minutes int, capacity int, booked_count int),
  RLS: any authenticated user (client or staff) can SELECT — schedule
  visibility isn't a staff/client distinction, both roles need to see it.
  Seed data matching classes.json exactly.
- `lib/chatbot/intents/schedule.ts` — one deterministic intent handling:
  - Date-scoped listing: "what's on the schedule tomorrow/today/[weekday
    name]", "this week".
  - Instructor filter: "show me [instructor]'s classes" (matched against
    actual instructor names in the data — Sofia Martinez, Marcus Lee,
    Avery Thompson).
  - Class-type filter: yoga / cycling / HIIT keyword.
  - Capacity/fullness queries: "how many spots left in yoga tonight",
    "is X full".
  - All parsing is deterministic (keyword/pattern matching + real date
    arithmetic), no LLM. Combine matched filters (e.g. "Marcus's cycling
    classes this week") rather than requiring one filter at a time.
- Registered in `lib/chatbot/intents/index.ts` alongside the existing
  `help` intent — no router.ts changes (proves Phase 4's extensibility
  claim for the first time).

## Out of scope

- Booking/reservation (Phase 6) — this table is read-only from the
  chatbot's side in this phase; `lib/appointments-store.ts`'s existing
  in-memory booking logic is untouched and still what the actual
  `/appointments` iframe-embedded prototype uses (unrelated to this new
  table for now — reconciled in Phase 6).
- "Who is booked for X" (attendee-level queries) — needs booking/member
  data, Phase 6's job.
- Rich structured UI rendering of results (`IntentResult.data`) — text
  replies only, per Phase 4's deferred-to-later-phase scope.

## Acceptance criteria

1. "What's on the schedule tomorrow?" (client or staff) returns an
   accurate list of tomorrow's classes with name/type/instructor/time.
2. "Show me Marcus's classes this week" (or similar instructor-name
   phrasing) correctly filters to that instructor only.
3. "How many spots are left in yoga tonight?" (or similar) correctly
   computes `capacity - booked_count` for the matching class(es).
4. Non-schedule messages still correctly fall through to `help` or the
   fallback — the new intent's matcher isn't so broad it swallows
   unrelated conversation.
5. `npm run lint` / `npm run build` pass.
6. Existing pages/intents (help, chat persistence, appointments iframe)
   still work unchanged.

## Preflight state

Phases 1-4 complete and committed. Router/registry pattern established in
`lib/chatbot/`. No `classes` table exists in Supabase yet — this phase
creates it. Today's real date (per environment) falls inside the seeded
week, so live verification can use real "today"/"tomorrow" phrasing.
