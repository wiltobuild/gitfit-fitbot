# Brief: Appointment lookup + scheduling workflows (Phase 6)

## Scope

Real, per-user bookings against the Phase 5 `classes` table (replacing
`lib/appointments-store.ts`'s hardcoded-`member_001` in-memory model), and
chatbot intents for looking up and making/canceling bookings.

- `supabase/migrations/0005_bookings.sql` — `bookings` table (id uuid pk,
  class_id text references classes, user_id uuid references auth.users,
  created_at). RLS: a user can select/insert/delete only their own rows;
  staff can select all rows (for "who's booked for X"). Triggers to keep
  `classes.booked_count` in sync on insert/delete (increment/decrement),
  so Phase 5's schedule intent keeps working correctly without changes. A
  unique constraint on `(class_id, user_id)` prevents double-booking; a
  capacity check (trigger or constraint) prevents booking a full class.
- `lib/chatbot/intents/my-appointments.ts` — "what appointments do I
  have" / "my bookings" (client + staff, since staff can also be members)
  — lists the current user's own upcoming bookings.
- `lib/chatbot/intents/book-class.ts` — "book me into [description]" /
  "reserve [description]" — reuses the same deterministic date/instructor/
  type filtering approach as the Phase 5 schedule intent to resolve a
  single class; if the filters resolve to exactly one class, books it
  (respecting capacity/double-booking); if zero or multiple matches,
  responds asking for a more specific description (still deterministic —
  no LLM, just an honest "which one did you mean" with the candidates
  listed). Also handles cancellation ("cancel my [description] booking").
- `lib/chatbot/intents/who-is-booked.ts` — staff-only: "who is booked for
  the 6pm cycling class" — resolves a class via time + type/name, lists
  the booked users' emails (no separate display-name field exists yet, so
  email is the identifier — consistent with the rest of the app).
- **Resolves the Phase 2-deferred `pulse-studio-prototype` decision**:
  `/appointments` (currently an iframe of the teammate's static prototype)
  is replaced with a native page reading/writing the same `classes` +
  `bookings` tables the chatbot intents use — one system of record, not
  two. `lib/appointments-store.ts` and its in-memory JSON-seeded model are
  deleted; `app/api/appointments/*` routes are rewritten against Supabase.

## Out of scope

- Visual redesign of `/appointments` beyond making it correctly wired to
  real data (Phase 12 owns polish).
- Staff modifying/canceling bookings on a member's behalf via chat — only
  lookup ("who's booked") this phase; staff-initiated changes aren't in
  the brief's explicit staff capability list for this phase.
- Waitlisting — not in the original prototype's scope either, skip.

## Decision: resolving `pulse-studio-prototype`

Per the Phase 2-deferred decision, this phase replaces the iframe embed
with the native implementation, now backed by real per-user data instead
of a single hardcoded demo member. The `pulse-studio-prototype` submodule
itself is left in place (still a valid git submodule, read-only,
unrelated repos shouldn't be deleted casually) but no longer referenced
by any page.

## Acceptance criteria

1. "What appointments do I have?" correctly lists only the asking user's
   own bookings (verify with two different test users — no cross-user
   leakage).
2. "Book me into [a schedule-intent-resolvable description]" books
   exactly one class when unambiguous, increments `booked_count`,
   respects capacity (rejects if full) and prevents double-booking.
3. "Who is booked for the 6pm cycling class?" (staff) correctly lists
   booked users; a client-role user cannot trigger this intent (role
   gating, same pattern as Phase 1's staff fixture).
4. `/appointments` renders real schedule/booking data from Supabase (not
   the static prototype), reserve/cancel works through the UI, and is
   gated to authenticated users (`requireUserOrRedirect`).
5. `npm run lint` / `npm run build` pass.
6. Existing intents (help, schedule) and other pages unaffected.

## Preflight state

Phases 1-5 complete and committed. `classes` table exists (Phase 5,
read-only so far). `lib/appointments-store.ts` currently powers
`app/api/appointments/*` with hardcoded `member_001` — being replaced.
`app/appointments/page.tsx` is currently an iframe to
`/appointments-prototype.html` (static asset) — being replaced with a
native page.
