# Brief: dashboard-role-refactor

## Scope (in the user's own words)

"Let's refactor the Dashboard for the different roles we have now. Admin
should be for the managers, a useful birds eyes view of upcoming sessions,
requests off, a global calendar for the month with all event listed on it,
and useful stats. Staff should be able to see what classes they are
hosting, how full they [are] and their own personalized stats about their
upcoming classes, stats about attendance, and anything else an instructor
might value. For the clients, it should show all the current sessions they
have booked, there session history, and some mechanisms to encourage the
user to attend more sessions, with weekly streaks, ecouraging messages that
change."

## Context that led here

The user asked whether the staff console had more admin-specific features.
Investigation found it doesn't — the only role-differentiated content
anywhere in the staff console is a header badge and one FitBot shortcut
tile (both just fixed in a prior turn — see the `8693b35` commit). Offered
to build a native time-off-approval panel on the staff console; the user
declined that narrower fix in favor of this much larger ask: `/dashboard`
(`app/dashboard/page.tsx`) is currently **one single generic page for every
role** — same content for client/staff/admin except a badge and a
conditional "Open staff zone" link (confirmed by reading the file in full).
The user wants three genuinely distinct, role-appropriate dashboards.

## Broken into three role-specific work streams

**Admin dashboard** — manager's bird's-eye view:
- Upcoming sessions (studio-wide, not just the user's own).
- Time-off requests (presumably pending ones needing action — the one
  admin-exclusive capability in the app today).
- A global monthly calendar showing all events.
- "Useful stats" (unspecified — investigation should surface what's
  actually computable from existing data: booking trends, capacity
  trends, member lifecycle breakdown, etc., and the plan should propose
  concrete candidates rather than leaving this vague).

**Staff dashboard** — instructor's own view:
- Classes they are hosting (i.e., filtered to `classes.instructor` matching
  the logged-in staff member, if that link exists — investigation must
  confirm whether a staff/admin account is linkable to `classes.instructor`
  today, since instructors are modeled as `members` rows per
  `fitbot-capability-expansion`'s investigation, not necessarily 1:1 with
  staff/admin auth accounts).
- How full their classes are.
- Personalized stats about their upcoming classes.
- Attendance stats.
- "Anything else an instructor might value" — plan should propose concrete
  candidates, not leave this open-ended.

**Client dashboard** — member's own view:
- All current booked sessions.
- Session history (past attended/booked classes).
- Engagement mechanisms: weekly streaks, and *rotating* encouraging
  messages (explicitly "messages that change," not a single static string).

## Explicitly out of scope for this task (unless investigation finds otherwise)

- The native time-off approval panel the user just declined in favor of
  this broader ask — do not build it as a standalone feature; if it
  naturally becomes part of the admin dashboard's "requests off" section,
  that's in scope as part of *this* task, not a separate one.
- The `fitbot-intelligence-upgrade` task (conversation memory, slot-filling,
  etc.) — still pending the user's review, untouched by this task.
- Any change to the chatbot itself.

## Preflight state

- Repo: `C:\Users\Wil\Documents\Codex\fitbot`, branch `main`, last commit
  `8693b35` (staff console role-display fix, pushed).
- Current `app/dashboard/page.tsx`: single component, no role branching
  except a badge label and one conditional link. Computes only one stat
  today (`bookedThisWeek`, via a `bookings` count query against the
  current week, rendered in a `MomentumRing`).

## Acceptance criteria for this GUIDE/COORDINATE pass

- Argus investigates: current dashboard implementation in full; what data
  is actually available to build each role's requested features (calendar
  events, instructor-class linkage, attendance history vs. bookings,
  streak-tracking data or lack thereof, time-off request query patterns
  already used elsewhere in the app); any existing calendar/stats
  components already built (e.g. `MomentumRing`, staff page's capacity
  stat) that should be reused rather than rebuilt.
- Athena produces a concrete, decision-structured plan covering all three
  role dashboards, phased for independent review, with explicit acceptance
  criteria — no implementation begins until the user approves.
