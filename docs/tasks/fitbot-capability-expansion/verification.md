# Verification: fitbot-capability-expansion

All verification below was run against the real dev server + live Supabase
project (no separate test DB exists for this repo), using real sessions
signed in as `wil.sheppard@pursuit.org` (admin) and
`sofia.martinez@gitfit.demo` (client).

## Automated checks (every phase, after every fix)

- `npm run lint` — clean on every phase's final state (2 pre-existing,
  unrelated warnings only: `<img>` usage, an anonymous default export).
- `npx tsc --noEmit` — clean on every phase's final state.

## Role model acceptance criteria

- Exactly 4 `admin` rows (the 4 named `@pursuit.org` emails), 0 `staff`
  rows remaining — confirmed via direct SQL after Phase 1.
- Admin can view `/staff`, sees the staff nav link and "Admin" badge, gets
  `ADMIN_MENU` chips — confirmed live.
- Admin can approve/deny a real pending time-off row — confirmed live
  end-to-end (approve mutation verified via direct REST query showing
  `status: "approved"`, `reviewed_by` set, `reviewed_at` timestamped).
- Client cannot reach the `time-off-review` intent via free text (falls
  through to the generic fallback reply, confirmed live) or the
  `pending-time-off` chip (403 Forbidden, confirmed live) — tested signed
  in as sofia.martinez@gitfit.demo.
- Client's `menu` chip returns `CLIENT_MENU` only — no staff/admin chip
  ever appeared in a client session's suggestedChips, confirmed live.

## Capability expansion acceptance criteria

- `tsc --noEmit` passes with the widened `RichCard` union (7 kinds) and
  exhaustive `chat-cards.tsx` switch.
- Each of the 8 planned new intents/chips (`time-off-review`,
  `pending-time-off`, `studio-capacity`, `instructor-classes`, booking-card
  wiring, broadened cancel phrasing, `class-info`, `roster-summary`) is
  reachable via natural language and (where applicable) via chip, correctly
  role-gated, and attaches the correct card kind — confirmed live for each.
- `CHIP_ROLES` has a compiler-enforced entry for every `ChipId`; a
  disallowed chip call is rejected independent of the handler's own check
  (confirmed live: client → `pending-time-off` → 403 before the handler
  ever runs).
- Live routing regression matrix (post-Phase-6 fixes), all confirmed
  correct via real `/api/chat` calls:

  | Message | Intent that won |
  |---|---|
  | "Can you get me a spot in tomorrow's yoga class" | book-class |
  | "can you pull up Jane Smith's account" | member-lookup (extracts "Jane Smith" correctly) |
  | "can you write something to win back Sarah" | outreach-draft (extracts "Sarah" correctly; full draft tested end-to-end against a real at-risk member) |
  | "who teaches yoga" | class-info (correct disambiguation, no name entity present) |
  | "what classes does Sofia Martinez teach" | instructor-classes (resolves correctly post-migration-0015) |
  | "help me plan my week" / "I need a quick workout" | workout-plan |
  | "what's on the schedule today" | schedule (previously hijacked by the member-lookup regression; fixed) |
  | "show me the roster summary" | roster-summary (real tier breakdown post-migration-0015) |
  | "what's the capacity like today" | studio-capacity |
  | "tell me about the yoga class" | class-info |
  | "who is booked for the 12pm yoga class" | who-is-booked |
  | "cancel my booking for the 12pm yoga class" | book-class (booking card attached) |

## Not verified / known gaps

- The duplicate pending time-off rows created for Wil Sheppard during this
  session's testing (3x "Fri, Aug 21") were left in place — cosmetic test
  data only, not cleaned up, does not affect correctness.
- No automated test suite exists for this repo; all verification above is
  manual/live, consistent with the project's existing testing approach.
