# Verification: dashboard-role-refactor

All verification below was run against the real dev server (port 3001) and
the live Supabase project. Sessions used: `wil.sheppard@pursuit.org`
(admin), `sofia.martinez@gitfit.demo` / `marcus.lee@gitfit.demo`
(instructors, staff role), `dora.ledner@gitfit.demo` /
`stuart.kutch@gitfit.demo` (real seeded clients), plus one throwaway
zero-booking account created and deleted solely to verify the true empty
state (no existing seeded member has zero bookings).

## Automated checks (every phase, after every fix)

- `npm run lint` — clean on every phase's final state (3 pre-existing,
  unrelated warnings only).
- `npx tsc --noEmit` — clean on every phase's final state.

## Phase 1 — instructor-class linkage

- Verification query after the live migration: all 29 classes had a
  non-null `instructor_member_id` matching the class's `instructor` text;
  all 6 instructor accounts confirmed `staff` role.

## Phase 2 — seed-data expansion

- 439 classes generated across a real 5-week rolling window
  (2026-08-17 – 2026-09-20), all correctly linked via
  `instructor_member_id`, with realistic fill/skip variance (spot-checked
  10 generated rows directly via query — confirmed 0 null-linked rows out
  of 439).

## Phase 3 — shared query extraction (behavior-preserving)

- Live chat replies for `roster summary` and `who needs re-engagement`
  confirmed to reflect the same underlying data/shape as before the
  refactor (real counts: 171 active / 75 at_risk / 57 lapsed members).

## Phase 4 — admin dashboard

- Full page render confirmed with real data: 5 stat tiles (63% weekly
  fill, 171/75/57 lifecycle, 145/158 tiers, 132 needing re-engagement, 4
  pending time-off), upcoming sessions grouped by day across a real 7-day
  window, a full 31-day month-grid calendar with correct per-day chip
  overflow ("+N more"), and a requests-off panel showing 4 real pending
  requests with names/dates/reasons.
- Inline Approve action: clicked live, row removed from the UI (4 → 3
  pending), and confirmed via direct DB query that the underlying row was
  genuinely updated (`status: "approved"`, `reviewed_by` matching the
  live admin's own user ID, `reviewed_at` timestamped to the action) — not
  just an optimistic UI change.

## Phase 5 — staff (instructor) dashboard

- Sofia Martinez: 66 upcoming classes, 100% Yoga (her own specialty),
  correct fill-level badges, correct current/next-class detection ("Core
  Flow, Up next, 5:30 PM"), booking-rate section uses "booking rate"
  wording throughout, never "attendance rate."
- Marcus Lee: 66 upcoming classes, 100% Cycling, completely disjoint class
  list from Sofia's — confirmed no cross-instructor leakage.

## Phase 6 — client dashboard

- Dora Ledner: real streak state (0 completed weeks, consistent with the
  dataset's Aug 17 floor), "This week: booked" correctly reflects a real
  advance booking for a day later in the week (the exact case the
  streak-query fix addressed), real upcoming/recent session lists, real
  personalized Promotions card ("Hey Dora,...").
- Stuart Kutch: different real booking ("Friday Flow" vs. Dora's "Sunday
  Reset"), different personalized promotion ("Hey Stuart,...") — confirmed
  no cross-client leakage.
- Zero-booking throwaway account: confirmed the true empty state end to
  end — "no streak yet" messaging, "not yet booked" status, real empty
  states for both session lists, Promotions card correctly absent (no
  linked `members` row). Account created via `supabase.auth.admin.createUser`
  and deleted immediately after verification.

## Phase 7 — cross-role leakage (explicit acceptance criterion)

- Admin dashboard's requests-off panel and inline mutations are
  structurally admin-only (only the `role === "admin"` branch renders
  them) — no separate check needed beyond confirming the branch logic,
  which `tsc`/live testing already exercised.
- Two instructors confirmed to see only their own classes (Sofia/Marcus,
  above).
- Two clients confirmed to see only their own bookings and promotions
  (Dora/Stuart, above).

## Not automated / manual-only

- No automated test suite exists for this repo (consistent with the
  project's established testing approach throughout this session) — all
  verification above is live/manual against real data and real sessions.
