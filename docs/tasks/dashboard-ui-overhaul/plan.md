# Plan: dashboard-ui-overhaul

Baseline: `main`, all of `dashboard-role-refactor`'s 7 phases shipped and
live. Full audit of `app/dashboard/admin-dashboard.tsx`,
`staff-dashboard.tsx`, `client-dashboard.tsx`, and their CSS in
`app/globals.css`.

---

## Audit findings

### Admin dashboard

1. **Upcoming-sessions panel is unbounded and dominates the page.** It
   renders every class across the next 7 days with no cap — in live testing
   this ran to 40+ rows across 7 day-groups. It sits directly under the
   stat tiles, at full column width alongside the Requests-off panel, so an
   admin has to scroll past a wall of read-only schedule data before
   reaching their one real action item (approve/deny) or the calendar.
2. **The calendar is functionally the better view of the same data** (the
   user's own observation, and correct — a month grid is denser and shows
   fill-level at a glance via chip color) but sits last, below two other
   full-width sections.
3. **Requests-off — the only actionable panel on this dashboard — is
   visually equal-weight with a read-only list**, side by side in a plain
   `.surface-card`. Nothing distinguishes "you can act on this" from
   "this is FYI."
4. **The calendar is visually generic**: a plain white 7-column grid,
   fill-colored chips, no highlight for "today," no use of this app's
   actual brand identity (`--gradient-brand`, the teal→violet→magenta
   gradient used throughout the chat UI, landing page, and buttons) —
   despite being the dashboard's single most information-dense, glanceable
   view, it looks the same as every other flat white card on the page.
5. **5 stat tiles carry equal visual weight** regardless of urgency —
   "Pending time off" (actionable, time-sensitive) reads identically to
   "Weekly fill rate" (ambient/informational). Nothing signals "this one
   needs you."
6. **Day-detail panel is disconnected from the calendar grid** — it renders
   below the entire 7-row grid, requiring a scroll down and back up to
   correlate a clicked day with its detail.

### Staff (instructor) dashboard

7. **"My classes" is unbounded** — 66 rows for a real instructor in live
   testing, same problem as admin's upcoming-sessions panel, and it's the
   first, most prominent panel on the page.
8. **Real redundancy between "My classes" and "Upcoming week outlook."**
   The outlook panel is a strict subset (next 7 days) of the same data
   already in the (unbounded) "My classes" list, re-grouped by day. An
   instructor sees the same upcoming classes twice, in two different
   shapes, once above the fold and once below.
9. **"Current or next" — the single most time-sensitive fact on this whole
   page ("what am I doing right now")** — is a small sidebar card, visually
   subordinate to the much larger "My classes" list next to it.
10. **No calendar/month view for staff at all**, despite the admin
    dashboard establishing that pattern is useful for exactly this kind of
    schedule data.

### Client dashboard

11. Already the best-organized of the three (streak card first, bookings
    grid, promotions last) — smallest audit surface.
12. The streak card's encouraging message is plain static text next to the
    ring — no visual reinforcement (color/tone) tied to streak state, so a
    "your streak is at risk" message and a "great job" message look
    identical.
13. `upcomingBookings`/`bookingHistory` are naturally short lists for most
    members (few active bookings, capped history) so the unbounded-list
    problem is much lower-severity here — not a priority fix.

### Cross-cutting

14. **No brand identity anywhere in any dashboard.** All three use flat
    `.surface-card` white boxes with a plain border — zero use of
    `--gradient-brand` or the teal/violet/magenta palette that defines this
    app's visual identity everywhere else (chat, landing, buttons). The
    dashboards currently read as a generic admin panel bolted onto a
    consumer-facing brand.
15. **No consistent visual language for "actionable" vs. "informational"
    vs. "urgent."** Every panel is the same white card regardless of
    whether it's a stat, a list, or something requiring a decision.
16. **Inconsistent list-capping strategy.** Client's history is capped at
    20 with no expand; admin/staff's lists are fully unbounded. No shared
    "show N, expand for more" pattern exists anywhere to reuse.

---

## Decision 1: Admin dashboard — reorder + cap upcoming sessions

### Recommendation
New page order: Header → 5 stat tiles → **Calendar (promoted, redesigned
per Decision 2)** → **Requests-off** (promoted directly under the calendar,
full width) → **Upcoming sessions**, capped to the next 10 classes with a
"Show more" expand control (client-side `useState`, no new fetch — the
7-day window is already fully fetched server-side, so expanding just lifts
the existing cap).

### Why
Puts the two panels an admin actually needs first — the calendar (the
better view of the schedule, per the user's own read) and the one
actionable panel (requests-off) — ahead of what is fundamentally a
secondary, more granular restatement of schedule data already visible in
the calendar. Capping upcoming sessions at 10 removes the scroll-wall
without deleting the ability to see everything (expand still shows it all).

### Approval requested
Confirm: (a) this exact new order (calendar → requests-off → upcoming
sessions); (b) cap of 10 with expand (vs. a different number, or pagination
instead of a flat expand).

---

## Decision 2: Admin calendar — visual redesign ("flashier," more distinctive)

### Recommendation
Concrete visual changes, all built from existing design tokens (no new
colors invented):
- **Header band**: the calendar's heading area gets a subtle
  `--gradient-brand` accent (e.g. a gradient underline/top border on the
  panel, or a gradient-tinted background on the month-name heading) so it
  reads as the dashboard's centerpiece, not another plain card.
- **Today highlight**: the current day's grid cell gets a distinct
  treatment (gradient border-ring or filled accent background) so "today"
  is instantly findable — currently every cell looks the same regardless
  of date.
- **Richer day cells**: slightly larger cells, a small dot/bar indicator
  showing overall fill-density for the day (not just per-class chips) so a
  glance at the whole month shows which weeks are busiest.
- **Hover/interaction polish**: smoother hover states on day cells
  (subtle lift/scale, matching the `--ease-out` transitions already used
  elsewhere in this app's chat UI) instead of the current flat
  background-color swap.
- **Day-detail panel**: move it to render as an inline expansion directly
  under the clicked week-row (or a slide-over anchored near the grid)
  instead of a separate block below the entire grid, so the detail stays
  visually connected to what was clicked.

### Why
"Flashier" and "more distinctive" are directional, not exact — grounding
every change in tokens already in this app's design system (gradient,
easing, existing badge colors) keeps it cohesive with the rest of GitFit
rather than inventing a new visual language just for this one panel.

### Approval requested
Confirm the direction above (gradient accents + today highlight + richer
day cells + connected day-detail) is what "flashier and more distinctive"
means to you, or flag anything you want done differently/more boldly.

---

## Decision 3: Staff dashboard — de-duplicate, promote current/next, cap classes

### Recommendation
- **Drop "Upcoming week outlook"** as a separate panel — it's a strict
  subset of "My classes" (same data, same shape, just re-grouped by day).
  Keeping both means real redundancy for no added information.
- **Cap "My classes" at 10 with the same expand pattern as Decision 1**,
  reusing the exact same capped-list component/pattern for consistency
  across the app.
- **Promote "Current or next" to the top of the page**, directly under the
  stat tiles, full-width or prominently sized — this is the single most
  time-sensitive fact for an instructor ("what am I doing right now") and
  should not be a small sidebar card competing with a long list.
- Booking-rate trend and class-type mix stay as-is structurally (both
  already reasonably positioned), but visually pick up the same "connect to
  brand" treatment as the admin calendar where relevant (e.g. the
  booking-rate trend badge could use gradient accent on an "up" trend).

### Why
Removes a genuine redundancy rather than just visually de-emphasizing it,
and fixes the priority inversion where the most urgent single fact on the
page is the smallest element on it.

### Approval requested
Confirm: (a) dropping the "Upcoming week outlook" panel entirely (vs.
keeping it but de-emphasizing it); (b) promoting "Current or next" to a
full-width top position; (c) reusing the same capped-list-with-expand
pattern from Decision 1.

---

## Decision 4: Client dashboard — streak visual polish (lower priority)

### Recommendation
Smallest change of the three: give the encouraging-message text a tone-
matched color/accent based on message category (e.g. `streak-active-
this-week-booked` gets a success/teal accent, `streak-active-this-week-
not-yet-booked` a warm/warning accent, `streak-just-broken` a neutral/violet
restart-framed accent) so the ring and message visually agree on the
state, not just the copy. No structural reordering needed — this
dashboard's hierarchy already tested well in the prior task's QA.

### Approval requested
Confirm this scope is right-sized (vs. wanting more/less change here).

---

## Decision 5: Cross-cutting — shared "capped list + expand" component and brand-accent pass

### Recommendation
- Build ONE shared client component (e.g.
  `app/components/expandable-list.tsx`) implementing "show first N, Show
  more/Show less toggle" — used by admin's upcoming-sessions, staff's my-
  classes, and available for client's history if it ever needs it. One
  implementation instead of three copies of the same interaction.
- Apply a small, consistent set of brand-accent touches across all three
  dashboards' headers/most-important panels (gradient accents, not a full
  re-skin) so the dashboards read as part of GitFit rather than a bolted-on
  generic admin panel — scoped deliberately small (header bands, the
  calendar, priority-panel borders) rather than repainting every card,
  which would risk looking busy/over-designed for a data-dense screen.

### Why
Consistency and reuse — the same interaction pattern (capped list) and the
same brand language (gradient accents used sparingly) tie all three
dashboards together as one coherent redesign rather than three independent
patches.

### Approval requested
Confirm: (a) building one shared expandable-list component now rather than
three separate implementations; (b) the "small, deliberate brand-accent
touches, not a full re-skin" scope for the visual identity pass.

---

## Phased implementation plan

**Phase 1 — Shared expandable-list component + admin dashboard reorder/cap
(Decisions 1, 5a).** Build the shared component; reorder admin dashboard
sections; cap upcoming-sessions at 10 with expand.

**Phase 2 — Admin calendar visual redesign (Decision 2).** Gradient header
accent, today highlight, richer day cells, connected day-detail, hover
polish.

**Phase 3 — Staff dashboard restructure (Decision 3).** Drop the outlook
panel, promote current/next, cap my-classes via the shared component.

**Phase 4 — Client dashboard polish + cross-cutting brand pass (Decisions
4, 5b).** Tone-matched streak message accents; small brand-accent touches
across all three dashboards' headers/priority panels.

**Phase 5 — Full visual QA pass, all 3 roles.** Live check as a real admin,
instructor, and client account; responsive check at mobile width; confirm
no regression to any already-verified functionality (approve/deny, day
click, streak logic, etc. — this task changes presentation only, not data
or behavior).

## Acceptance criteria

- Admin dashboard order is calendar → requests-off → upcoming sessions
  (capped at 10, expandable).
- Calendar has a visibly distinct "today" highlight and gradient accent
  treatment not present anywhere else on the page before this change.
- Staff dashboard has no duplicate schedule panel; current/next class is
  the most visually prominent element after the stat tiles.
- One shared expandable-list component is used by both admin and staff
  (not two separate implementations).
- No data/query changes — `npx tsc --noEmit` and `npm run lint` pass with
  no new errors, and every dashboard's existing functional behavior
  (approve/deny mutation, day-click detail, streak state, promotions)
  still works identically after the visual changes.

Not implemented yet — stopping here for approval on Decisions 1–5.
