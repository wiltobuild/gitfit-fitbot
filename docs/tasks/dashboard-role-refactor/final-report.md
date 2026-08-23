# Final report: dashboard-role-refactor

## What changed

Replaced the single generic `/dashboard` page (same content for every role
except a badge and one conditional link) with three genuinely distinct,
role-appropriate dashboards, delivered across 7 phases:

1. **Schema** — new `classes.instructor_member_id` FK, backfilled and
   linking every class to its real instructor's `members` row; every
   instructor account promoted to `staff` role.
2. **Seed-data expansion** — a new `seed-classes.ts` script generating a
   rolling 5-week window of realistic classes from whenever it's run
   (never goes stale like a fixed-date range would), safe to re-run
   repeatedly without ever touching a class that already has real bookings.
3. **Shared query extraction** — the query logic behind 4 existing chatbot
   intents and the staff console's inline stats moved into
   presentation-agnostic `lib/` functions, so the new dashboards and the
   chatbot now share one source of truth instead of risking silent drift
   between two copies of "what counts as at-risk" or "how fill rate is
   computed." Verified behavior-preserving — chat replies unchanged.
4. **Admin dashboard** — a manager's bird's-eye view: 5 real stat tiles,
   a studio-wide upcoming-sessions panel, a requests-off panel with inline
   approve/deny (each re-checking the admin role server-side, never
   trusting the page gate), and a true 7-column month-grid calendar with
   per-day class chips and a click-to-expand day detail.
5. **Staff (instructor) dashboard** — an instructor's own view: their own
   classes only (never a studio-wide fallback for a non-linked account),
   personalized upcoming/fill/current-next stats, a week-over-week
   "booking rate" trend (deliberately never called "attendance," since the
   app only tracks bookings), a 7-day outlook, and a class-type mix
   ranked by fill rate.
6. **Client dashboard** — a member's own view: current booked sessions,
   recent sessions ("Your recent sessions," not "attendance history," since
   a cancelled booking is a deleted row, not a tracked event), a weekly
   streak (completed ISO weeks only — an in-progress current week never
   retroactively reads as "broken") rendered via the existing
   `MomentumRing`, and a rotating encouraging message selected by a
   deterministic daily hash (no randomness), plus the pre-existing
   Promotions card, quick actions, and sign-out preserved exactly as they
   worked before.
7. **Full QA pass** — cross-role leakage check across 5 real accounts.

## What was verified

See `verification.md` for the full matrix. Everything was checked against
real data with real sessions across all 3 roles — including two separate
instructors and two separate clients specifically to rule out cross-role
data leakage, and one throwaway zero-booking account created solely to
verify the true "brand new member" empty state, since no existing seeded
member actually has zero bookings.

## What was found and fixed along the way

See `review.md` for full detail. Three real issues, all caught by code
review or live verification, all fixed in the same phase they were found:

1. A build-breaking error in Phase 4 (`SiteNav`, an async server
   component, imported directly into a `"use client"` file) that broke
   `/dashboard` entirely for every role, not just admin — caught
   immediately on first live check, fixed by moving `SiteNav` to render
   from the server page instead, and the lesson was carried into every
   subsequent phase's prompt to prevent a repeat (it did not recur in
   Phases 5 or 6).
2. A streak-calculation gap in Phase 6 where a class booked in advance for
   later in the current week wasn't counted as "already booked" until the
   day arrived — found during code review, fixed before live verification,
   then confirmed fixed against a real advance booking.
3. A related `hasAnyHistory` gap in Phase 6 that could show "no streak
   yet" messaging to a member who'd just taken their first action (an
   upcoming booking) — found and fixed alongside issue 2.

## Deployment status

All 7 phases are committed to local `main`. Not yet pushed to
`origin/main` as of this report — that is the immediate next step, along
with committing this closing documentation.

## What remains open

- Nothing scoped by the approved plan remains unbuilt. All 6 decisions
  were implemented as approved, with no scope reductions.
- The 439 generated classes and the live migration/promotion from Phase 1
  are real, persistent changes to the shared dev database — consistent
  with how every other live-data step has been handled throughout this
  session (real, low-stakes synthetic data, left in place).
