# Brief: dashboard-ui-overhaul

## Scope (in the user's own words)

"for the admin dashboard the upcoming appointments takes up a huge amount
of screen, and then has important information after it. The calaender
underneath it shows the same data a lot cleaner. Move he clanendear higher
up, make it a flashier claender with moer distinctive design, and make the
upcoming classes show the next 10 classes with an option to expand the list
out further. Review the visual hierarchy, usefulness and how the dashboard
serves each of its users for the user type. Do a full UI UX audit for
specifically the dashboard phase, and find other ways it can be visually
improved and improve the user experience and use it to inform a plan to
overhaul the dashboard UI with it's findings and my suggestions."

## Context

Follows directly from `dashboard-role-refactor` (shipped, all 3 role
dashboards live and functionally correct — see that task's final-report.md).
This task is UI/UX only: no new data, no new queries, no behavior changes
beyond what's needed to support the redesign (e.g. capping + expand needs
client state, not new fetches). Scope is all 3 role dashboards
(`app/dashboard/admin-dashboard.tsx`, `staff-dashboard.tsx`,
`client-dashboard.tsx`) plus their shared CSS in `app/globals.css`.

## Explicit user asks (admin dashboard)

1. Upcoming-sessions panel currently renders every class across the next 7
   days ungrouped-by-limit — can run to 40+ rows, pushing everything below
   it (including the Requests-off panel, the admin's one real action item)
   far down the page.
2. The calendar below it shows overlapping information more compactly and
   should move higher in the page order.
3. The calendar should get a more distinctive, "flashier" visual design,
   not just be promoted in position.
4. Upcoming sessions should cap at 10 with an expand affordance for more.

## Acceptance criteria for this GUIDE/COORDINATE pass

- Full UI/UX audit across all 3 dashboards: visual hierarchy, information
  density, redundancy, and how well each screen actually serves its role's
  real day-to-day need.
- A concrete, decision-structured plan addressing the audit findings plus
  the user's explicit admin-dashboard asks.
- No implementation until the user approves the plan's decisions.
