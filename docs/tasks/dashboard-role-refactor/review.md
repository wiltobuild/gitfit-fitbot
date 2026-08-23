# Review: dashboard-role-refactor

Each phase's Codex diff was reviewed manually and verified live before commit.
Findings below are what survived that review — every issue was caught and
fixed in the same phase it was found, nothing was deferred.

## Phase 1 (instructor-class FK link)

No findings. The plan's investigation was written when the seed data had 3
instructors and 20 classes; live data had already grown to 6 instructors and
29 classes (a second seed script, `seed-new-instructors.ts`, had been added
in an earlier session). The migration's backfill logic is generic (matches
by `full_name`, not a hardcoded list) so it handled the larger real dataset
correctly with no changes needed. Verified live: all 29 classes linked, all
6 instructor accounts confirmed `staff` role (3 were already staff from the
earlier script; the migration correctly left those alone and only promoted
the 3 still at the default `client` role).

## Phase 2 (seed-classes.ts)

No findings on the script itself. Generated 439 classes across a real
5-week rolling window (Aug 17 – Sep 20) with realistic fill/skip variance,
all correctly linked via `instructor_member_id` — verified via direct query
after the live run.

## Phase 3 (shared query extraction)

No findings — behavior-preserving refactor verified live: `roster summary`
and `who needs re-engagement` chat replies matched the pre-refactor query
shape exactly (real counts: 171 active / 75 at_risk / 57 lapsed).

## Phase 4 (admin dashboard)

- **Fixed — build-breaking error, caught immediately on live verification:**
  `admin-dashboard.tsx` (a `"use client"` component) imported `SiteNav`
  directly. `SiteNav` is an async server component; importing it into a
  client file pulled its whole module graph (including
  `lib/supabase/server.ts`, which uses `next/headers`) into the client
  bundle, breaking the build entirely (`/dashboard` rendered a blank page
  for every role, not just admin). Fixed by moving `<SiteNav />` to render
  from `app/dashboard/page.tsx` (the server component) as a sibling of
  `AdminDashboard`, matching the pattern every other page in this app
  already uses (`staff/page.tsx`, `appointments/page.tsx`,
  `retention/page.tsx` all render `SiteNav` from their server page, never
  import it into a client component). This lesson was carried forward
  explicitly into the Phase 5 and 6 prompts to prevent a repeat.
- Verified live post-fix: all 5 stats real, upcoming sessions grouped
  correctly, month calendar rendered all 31 days with correct overflow
  counts, and the inline Approve action was confirmed to write a real DB
  update (`reviewed_by`/`reviewed_at` matching the live admin session), not
  just an optimistic UI change.

## Phase 5 (staff/instructor dashboard)

No findings — correctly avoided the Phase 4 `SiteNav` mistake from the
start (kept in `page.tsx`). Verified live as a real instructor (Sofia
Martinez): 66 upcoming classes, all Yoga, all her own; current/next
detection correct; "booking rate" wording used consistently, "attendance"
never appears anywhere in this section per the plan's explicit requirement.

## Phase 6 (client dashboard)

- **Fixed — streak query's upper date bound excluded advance bookings:**
  `getMemberStreak`'s query capped at `today` instead of the end of the
  current ISO week, so a class booked in advance for later in the current
  week wouldn't count toward `currentWeekBooked` until the day of the class
  arrived — a member who'd already secured their week would incorrectly
  see "not yet booked." Fixed by extending the upper bound to the current
  week's Sunday. Verified live against a real account (Dora Ledner) with a
  real Sunday booking made mid-week: "This week: booked" now shows
  correctly ahead of the class date.
- **Fixed — `hasAnyHistory` only checked past bookings:** a member whose
  only activity was a single upcoming (not-yet-happened) booking would see
  "no streak yet" messaging despite having just taken action, since
  `hasAnyHistory` was derived from `bookingHistory.length` (past only).
  Broadened to also account for upcoming bookings and any existing streak
  state. Both fixes were found during code review, before the live
  verification pass, and confirmed together against Dora Ledner's real
  account state.
- Verified live with a genuinely zero-booking account (created and deleted
  for this purpose, since no existing seeded member has zero bookings):
  correct "no streak yet" copy, "not yet booked" status, and real empty
  states for both session lists, with the Promotions card correctly absent
  (no linked `members` row).

## Phase 7 (full QA pass)

No cross-role data leakage found. Verified live with 5 real accounts across
all 3 roles: two instructors (Sofia Martinez / Marcus Lee — confirmed
completely disjoint class lists, correct per-instructor class types), two
clients (Dora Ledner / Stuart Kutch — confirmed disjoint bookings and
correctly personalized promotions), and the admin account (confirmed the
requests-off panel and inline mutations are admin-only by construction,
since only the `role === "admin"` branch renders them at all).
