# Brief: Time-off request workflow (Phase 9)

## Scope

Staff-only: request specific days off through the chatbot, and check
their own pending/past requests. A new data domain with an
approval-workflow shape (status field), even though an approval UI isn't
built yet — that's a natural future extension, not this phase's job.

- `supabase/migrations/0008_time_off_requests.sql` — `time_off_requests`
  table (id uuid, user_id references auth.users, requested_date date,
  reason text nullable, status text default 'pending' check in
  ('pending','approved','denied'), created_at, reviewed_by uuid nullable
  references auth.users, reviewed_at timestamptz nullable). RLS: staff can
  insert their own requests; staff can SELECT all requests (internal
  operational visibility among staff, not private client data — same
  reasoning as Phase 6's staff-read-all bookings policy). No approve/deny
  action from chat this phase — `status` stays 'pending' from every
  chat-submitted request; `reviewed_by`/`reviewed_at` exist for a future
  phase to use.
- `lib/chatbot/intents/time-off.ts` — staff-only. "Request Friday off",
  "I need next Monday off", "request time off for [date]" — deterministic
  date parsing (today/tomorrow/weekday name — reuse the same approach as
  schedule.ts), optional reason (anything after the date reference, or a
  simple "because ..."/"for ..." pattern), inserts a pending request,
  confirms submission. Also handles "my time off requests" / "what time
  off have I requested" — lists the asking staff member's own requests
  with status.

## Out of scope

- Approving/denying requests via chat or any UI (future phase).
- Multi-day ranges (a single `requested_date` per request — "request
  Friday and Monday off" isn't parsed as one request; out of scope for
  this pass, staff can ask twice).
- Conflict detection against existing schedules/shifts — no staff
  scheduling/shift table exists in this app to conflict against.

## Acceptance criteria

1. "Request Friday off" (staff) creates a pending `time_off_requests` row
   for the correct upcoming Friday, confirmed in the reply.
2. A reason, if included in the phrasing, is captured; if absent, the
   request still succeeds with a null reason.
3. "What time off have I requested?" lists only the asking staff member's
   own requests (not other staff's) with status.
4. A client-role user cannot trigger this intent.
5. `npm run lint` / `npm run build` pass; existing intents unaffected —
   specifically verify this doesn't collide with schedule.ts's date-word
   matching the way workout-plan did in Phase 8 (this intent also deals in
   weekday/today/tomorrow terms).

## Preflight state

Phases 1-8 complete and committed. No staff-operations data (time off,
shifts) exists anywhere yet. Apply the same "strong vs. weak keyword"
matcher-specificity lesson from Phase 8 when writing this intent's
`match()` to avoid the same class of collision.
