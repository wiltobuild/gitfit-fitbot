# Brief: Staff member lookup (Phase 7)

## Scope

Staff can look up member info and see their booking/attendance summary,
via chat. This surfaces a real gap: the app currently has no name field
anywhere (only email) — "look up member Jordan Smith" is meaningless
without one. This phase adds a minimal `full_name` field (collected at
signup) to make name-based lookup real, not add a broader profile system.

- `supabase/migrations/0006_member_lookup.sql`:
  - `full_name text` column on `profiles` (nullable — existing users have
    none).
  - `handle_new_user()` trigger (from 0001) updated to also set
    `full_name` from `new.raw_user_meta_data->>'full_name'` if present —
    Supabase's `signUp({ options: { data: { full_name } } })` puts it
    there, no service-role key or app-side profile update needed, and it
    works regardless of email-confirmation timing since the trigger fires
    on `auth.users` insert immediately.
  - `search_members(search_term text)` — a `security definer` function
    that itself checks `is_staff(auth.uid())` and raises if not staff
    (defense in depth alongside the intent's own role gating), then
    returns `id, email, full_name, role, created_at` for users whose
    email or full_name matches. This avoids wiring the service-role key
    into app code (auth.users.email isn't otherwise queryable via the
    client SDK) — centralizes the staff-only check in the database
    itself, consistent with the RLS-first pattern established in Phase 1.
- Sign-up form gets one additional field: "Full name" (optional — a user
  can still sign up without one, lookup by email always works).
- `lib/chatbot/intents/member-lookup.ts` — staff-only: "look up member
  [name/email]", "find member", "member info for [x]". Resolves via
  `search_members`; if exactly one match, shows their profile info (name,
  email, role, joined date) plus their upcoming bookings (staff can
  already read all bookings per Phase 6's RLS policy). If multiple
  matches, lists candidates. If zero, says so.

## Out of scope

- A full member-management UI/page — chat-only for this phase, per the
  brief's "access operational information without navigating through
  multiple screens" framing.
- Editing member info, changing another user's role via this intent
  (that's a separate future admin flow, not this phase).
- Attendance history beyond bookings (no separate attendance-tracking
  table exists yet — bookings are the closest proxy available).

## Acceptance criteria

1. Signing up with a full name stores it correctly (verify via DB query).
2. Signing up without one still works (nullable, no regression).
3. "Look up member [full or partial name]" (staff) returns the correct
   single match with profile + booking info, or a disambiguation list.
4. "Look up member [email substring]" also works.
5. A client-role user cannot trigger this intent (role gating, same
   pattern verified in Phases 1 and 6).
6. `search_members` itself rejects non-staff callers even if the app-side
   role check were somehow bypassed (defense in depth — verify by calling
   the RPC directly as a client-role session).
7. `npm run lint` / `npm run build` pass; existing intents/pages
   unaffected.

## Preflight state

Phases 1-6 complete and committed. `profiles` has `id`, `role`,
`created_at` only. No name field anywhere. `is_staff()` helper exists
from migration 0001, reusable here.
