# Plan: dashboard-role-refactor (Athena)

Baseline: `main` @ `8693b35`. Covers three role-specific dashboards
(admin/staff/client) replacing today's single generic `/dashboard`.

The brief's four blocking questions are **settled inputs**, not decisions
in this plan: (1) real instructor-login linkage must be built, no
studio-wide fallback; (2) attendance = booking data only; (3) seed data
must cover a full month; (4) streak = consecutive ISO weeks with ≥1
booking, breaks on any zero-booking week. Everything below designs how,
not whether.

Nothing in this plan is pre-approved. All 6 decisions need explicit
sign-off before Codex implementation begins.

---

## Decision 1: Instructor-login linkage schema

### Evidence
- `classes.instructor` is free `text` (`0004_classes.sql:6`), not a FK.
- `members` has `auth_user_id uuid unique references auth.users(id)`
  (`0011_members_table.sql:11`) and `is_instructor boolean`
  (`:21`) — already the sanctioned "this login is this member" link,
  used everywhere else (`getMemberForUser(supabase, authUserId)` in
  `lib/members/queries.ts:18-20`; RLS policy `members_select_own` using
  `auth_user_id = auth.uid()`).
- `member-data.ts:141,157` already marks the 3 named instructors
  (`EXISTING_INSTRUCTORS`) as `is_instructor: true` **and**
  `has_account: true` (instructors are unioned into the account-holder
  set: `hasAccount = isInstructor || accountHolderIndices.has(i)`).
  `seed-members.ts:87-108` provisions a real Supabase Auth account (email
  `firstname.lastname@gitfit.demo`, password `Welcome!`, same demo
  password as the 4 staff accounts) and writes `members.auth_user_id` for
  **every** account holder, instructors included, whenever it runs.
- Despite that, investigation confirmed `auth_user_id` is currently
  unpopulated for the 3 instructor rows in the live DB — meaning
  `seed-members.ts` has not been (re)run against live since this
  instructor-account logic landed, not a code gap.
- The signup trigger (`0001_profiles_and_roles.sql:83-94`) always creates
  a `profiles` row with `role='client'`. So even once `seed-members.ts`
  runs, the 3 instructor logins would be `client`-role — they still
  couldn't reach `/staff` or a staff dashboard without a role promotion,
  exactly like the 4 `@pursuit.org` accounts needed in `0014_admin_role.sql`.
- No column anywhere maps a `classes` row to a specific `members` row.
  `lib/chatbot/intents/instructor-classes.ts:5-7` does the closest thing
  today — free-text `ilike` matching a spoken instructor name against
  `classes.instructor` — but that's request-time fuzzy matching for
  *any* instructor by name, not an identity-scoped "classes I teach"
  query, and it's fragile (substring/`ilike` collisions across similarly
  named instructors).

### Options
1. **Runtime text match**: staff dashboard looks up the caller's `members`
   row via `auth_user_id`, then does `classes.instructor ILIKE member.full_name`
   at query time — no schema change, reuses the exact pattern from
   `instructor-classes.ts`.
2. **New FK column**: add `classes.instructor_member_id uuid references
   members(id)`, backfill once by matching existing `instructor` text to
   `members.full_name`, and require the seed-data-expansion script
   (Decision 5) to always populate it for new rows going forward. "My
   classes" becomes a direct FK join, not text matching.
3. Redefine scope to studio-wide "today's classes" (already what
   `app/staff/page.tsx` shows) instead of a true per-instructor filter.

### Recommendation
Option 2, layered on top of the already-working `members.auth_user_id`
identity link (i.e., not a replacement for that link — an addition to it).
Option 3 is explicitly excluded — the resolved blocker says no
studio-wide fallback.

### Why
Option 1 is the least schema-invasive but pushes fuzzy text matching into
a security/data-scoping path ("show me only *my* classes"), where a
false-positive substring match (e.g. two instructors sharing a first
name, or a typo introduced by the seed-data expansion in Decision 5) is a
data-leak bug, not just a wrong reply in a chat window. Option 2 makes
that match a one-time backfill decision instead of a per-request risk,
and pays for itself immediately in Decision 5 (expanded seed data can set
the FK directly at insert time instead of re-deriving it by text every
time). The FK stays nullable — not every conceivable future `classes` row
needs an instructor — but the seed-expansion script must always set it.

### Concrete migration (new file `0016_instructor_class_link.sql`)
```sql
-- Direct FK from a class to the members row that teaches it, so a staff
-- dashboard can query "classes I'm hosting" by identity (auth_user_id ->
-- members.id -> classes.instructor_member_id) instead of matching
-- classes.instructor text at request time. classes.instructor stays as
-- the display string; the FK is the authoritative link going forward.

alter table public.classes
  add column instructor_member_id uuid references public.members(id);

-- One-time backfill: match today's 20 seed rows' free-text instructor
-- name to the corresponding members row (exact match — the 3 seeded
-- instructor full_name values are exactly the strings classes.instructor
-- already uses).
update public.classes c
set instructor_member_id = m.id
from public.members m
where c.instructor_member_id is null
  and m.is_instructor
  and m.full_name = c.instructor;

-- One-off promotion: the 3 instructor logins become staff so they can
-- reach a staff dashboard. Requires seed-members.ts to have already run
-- against this database (auth_user_id populated) — see Decision 1's
-- Phase 1 ordering note.
update public.profiles p
set role = 'staff'
from public.members m
where p.id = m.auth_user_id
  and m.is_instructor
  and p.role = 'client';
```

### Verification query (run after)
```sql
select c.id, c.instructor, m.full_name, m.auth_user_id, p.role
from public.classes c
left join public.members m on m.id = c.instructor_member_id
left join public.profiles p on p.id = m.auth_user_id
order by c.class_date, c.start_time;
```
Expected: all 20 (soon more, per Decision 5) rows have a non-null
`instructor_member_id` and `full_name` matching `instructor`; all 3
`auth_user_id`s are non-null; all 3 `role` values are `staff`.

### QA-testability sub-decision
Investigation flagged that none of the 4 known admin accounts are
instructors, so a literal "classes I'm hosting" filter is currently
unverifiable with any known login.

**Recommendation: do not turn an admin into a fake instructor.** Instead,
reuse the 3 already-seeded, already-demo-flagged instructor accounts
(`sofia.martinez@gitfit.demo` / `marcus.lee@gitfit.demo` /
`avery.thompson@gitfit.demo`, password `Welcome!`, domain explicitly
"obviously-synthetic — never a real domain" per `member-data.ts:11`) and
promote their `profiles.role` to `staff` (the migration above). This
gives QA a real, logically-correct staff-console login that is genuinely
an instructor, with zero new identity fabrication — just finishing the
promotion the existing seed logic already implies but never executed at
the `profiles` layer.

### Approval requested
Confirm: (a) the FK-column approach (Option 2) over runtime text
matching; (b) promoting all 3 instructor accounts to `staff` role (not
just one) so every instructor can independently be QA'd; (c) this
migration's ordering dependency on `seed-members.ts` having been run
live first (Phase 1 below sequences this explicitly).

---

## Decision 2: Admin dashboard

### Evidence
- `time_off_requests` (`0008_time_off_requests.sql`) has staff-wide SELECT
  and admin-only UPDATE (`0014_admin_role.sql:42-47`) already in place —
  zero migration needed. No existing query lists *all* pending requests
  across everyone (`time-off.ts` = own requests only; `time-off-review.ts`
  = resolve-one-person-by-name-and-date, then mutate).
- `classes` is readable studio-wide by any authenticated user
  (`0004_classes.sql:17-21`).
- `getRosterSummary` (`roster-summary.ts:6`) and `getRetentionCandidates`
  (`retention-lookup.ts:7`) already compute lifecycle/tier breakdowns from
  `listMembersForStaff` — zero new schema, currently wrapped in a
  chat-reply string + card, not raw data (Decision 6 addresses unwrapping
  this).
- No calendar component exists anywhere in the codebase (grepped) — this
  is genuinely new UI, not a reuse case.
- The user explicitly declined a standalone time-off panel earlier in
  favor of this broader dashboard — building "requests off" here, as part
  of the admin dashboard, is the agreed-upon place for that capability.

### Concrete design

**Upcoming sessions (studio-wide)** — new function
`getUpcomingClasses(supabase, { from, to })` (studio-wide, no user
filter) sourced from `classes`, sorted by date/time, grouped by day for
display; reuses `fillLevel()` per row exactly like `app/staff/page.tsx`
already does for "today."

**Requests-off panel** — new function `listPendingTimeOffRequests(supabase)`:
```sql
select r.id, r.requested_date, r.reason, r.created_at, p.full_name, u.email
from time_off_requests r
join auth.users u on u.id = r.user_id
left join profiles p on p.id = r.user_id
where r.status = 'pending'
order by r.requested_date asc;
```
RLS already permits this for any staff/admin reader (`is_staff` covers
admin since `0014`); no new policy needed. **Recommendation: inline
approve/deny actions directly on the dashboard** (two small Next.js
server actions, `approveTimeOffRequest(id)` / `denyTimeOffRequest(id)`,
each re-checking `requireRoleOrThrow("admin")` internally — never trust
the page-level gate alone — then doing the same `update ... set
status=..., reviewed_by=session.user.id, reviewed_at=now()` the chatbot's
`time-off-review.ts` already does). This is preferred over linking out to
the chatbot flow: the user explicitly reframed this as part of the
broader dashboard build (not the standalone panel they declined), and a
manager's bird's-eye view is exactly the context where "see it, act on
it, no context switch" is the point — sending an admin to go type a
free-text chat command to approve something they can already see the
name and date of adds friction the dashboard already resolved.

**Monthly calendar — grid, not list.** Recommendation: build a true
7-column month grid (one cell per day), each cell showing up to 3 class
"chips" (time + short name, color/badge by `fillLevel`) with a "+N more"
overflow that expands a same-page day-detail panel on click; sourced from
one `getClassesForMonth(supabase, year, month)` query. **Why grid over a
day-by-day agenda list**: the brief's literal wording is "a global
calendar for the month with all events listed on it" — a grid is the
unambiguous reading of "calendar for the month," and a list-agenda risks
reading as just a longer version of the "upcoming sessions" panel
directly above it, undermining the point of having two separate admin
panels. The added complexity (overflow handling, day-detail expansion) is
bounded to one new client component and reuses existing badge/card CSS
(`.dashboard-card`, `.badge-*`) rather than inventing a new visual
language.

**Useful stats — concrete candidates (5), not "TBD":**
1. Studio-wide fill rate for the current week (aggregate `booked_count`/
   `capacity` across all classes in the week, same math as
   `app/staff/page.tsx:35`'s `bookedPercent`, scoped studio-wide instead
   of today-only).
2. Member lifecycle breakdown (active / at_risk / lapsed counts) — reuse
   `getRosterSummary`'s underlying breakdown (extracted per Decision 6).
3. Membership tier breakdown (basic / premium counts) — same source.
4. At-risk + lapsed count needing re-engagement — reuse
   `getRetentionCandidates`'s count (extracted per Decision 6).
5. Pending time-off request count — a one-line stat tile that doubles as
   the requests-off panel's badge count.

All five require zero new schema and reuse data already surfaced
elsewhere in the app, per investigation's finding.

### Approval requested
Confirm: (a) inline approve/deny actions on the dashboard, not a chatbot
link-out; (b) grid calendar over list/agenda view; (c) these exact 5
stats as the "useful stats" scope for this task (not a larger stats
suite).

---

## Decision 3: Staff dashboard

### Evidence
- `fillLevel(bookings, capacity)` (`lib/classes/fill-level.ts:1`) is
  already generic and directly reusable, confirmed by investigation.
- `app/staff/page.tsx:33-40` has inline `bookedPercent`/current-class/
  next-class logic, not yet extracted into a shared helper — needed again
  here for "personalized upcoming-class stats," so Decision 6 extends to
  extracting this too.
- Attendance data is booking-based only (blocker #2, settled) — no
  `attended`/`no_show` column exists (`0005_bookings.sql`).

### Concrete design
- **My classes**: `getClassesForInstructor(supabase, authUserId)` —
  `getMemberForUser(supabase, authUserId)` (existing function) to resolve
  the caller's `members` row, then `classes.where(instructor_member_id =
  member.id)` (Decision 1's FK), ordered by date/time. If the caller has
  no linked `members` row, or is linked but `is_instructor` is false: show
  an explicit empty state ("You're not linked to an instructor profile —
  ask an admin to link your account") — **never** a studio-wide fallback,
  per the resolved blocker.
- **Fill rates**: `fillLevel()` per class row from "my classes," same
  `staff-fill-*` badge convention `app/staff/page.tsx` already
  establishes (healthy/filling/full).
- **Personalized upcoming-class stats**: count of the instructor's own
  upcoming classes this week/month; aggregate booked/capacity across only
  their classes; current/next-class detection reusing the extracted
  `isCurrentOrNext` helper, scoped to their own list instead of
  studio-wide.
- **Attendance/booking stats** (booking-based only, per blocker #2): total
  bookings across their own classes this week; their own average fill %
  this week vs. last week (a real trend, computable from `class_date`
  history, no new schema). UI copy must say "booking rate," not
  "attendance rate" — avoids implying real show-up tracking that doesn't
  exist.
- **Anything else an instructor might value — concrete recommendation,
  grounded in what's queryable**: (a) an "upcoming week outlook" list —
  their next N classes across the coming 7 days, same shape as the
  calendar's day-detail panel but pre-filtered to their own
  `instructor_member_id`; (b) a "class-type mix" breakdown — which of
  their own class `type`s (Yoga/Cycling/HIIT) fill fastest, computed
  purely from their own rows' `booked_count`/`capacity` by `type`. Both
  reuse data already on the `classes` row; nothing invented.

### Approval requested
Confirm the "no linked instructor profile → explicit empty state, never
studio-wide fallback" behavior, and confirm "booking rate" (not
"attendance rate") as the required UI copy framing for the attendance
section.

---

## Decision 4: Client dashboard

### Evidence
- `my-appointments.ts` (`:38-45`) queries upcoming bookings joined to
  `classes`; `getMemberActivitySummary` (`my-activity.ts:3`) computes
  this-week booking count, last visit, tier, join date — both currently
  return chat-reply strings/cards, not raw data (Decision 6 unwraps them).
- `bookings` has no `status`/soft-delete — a cancelled booking is a
  **deleted row** (`0005_bookings.sql`). "Session history" is therefore
  "past bookings still present in the table," not an immutable log — a
  genuine, small data-shape caveat worth surfacing in the UI copy (e.g. a
  history section subtly framed as "sessions you attended," never
  claiming to track true no-shows).
- Zero existing precedent anywhere for rotating/randomized display copy
  (grepped `Math.random`, message-array patterns) — new code.
- `fitbot-capability-expansion`'s own plan (Decision 8) established this
  project's explicit preference for deterministic, non-random logic
  ("completely through deterministic code" bar) over anything ML/random —
  a real convention to follow here, not just a stylistic guess.

### Concrete design

**Current booked sessions**: adapt `my-appointments.ts`'s exact query
shape into a shared function (Decision 6) — bookings joined to `classes`,
`class_date >= today`, ordered by date/time.

**Session history**: same join, inverted (`class_date < today`), most
recent first, capped (e.g. last 20) to bound the query. UI copy avoids
overclaiming ("Your recent sessions" rather than "Attendance history").

**Weekly streak** — exact computation, per blocker #4:
1. Pull the member's full booking history (`bookings` joined to
   `classes.class_date`), capped to a 26-week lookback window (bounds
   query cost; a break inside that window is what matters, and any
   realistic active streak is far shorter).
2. Group by ISO week (Monday–Sunday), using the same week-boundary math
   already in `app/dashboard/page.tsx:19-25`.
3. Split into **completed weeks** (strictly before the current ISO week)
   and the **in-progress current week**. Only completed weeks count
   toward streak length — an empty current week must not retroactively
   read as "streak broken" while the week isn't over yet.
4. Walk backward from the most recent completed week: count consecutive
   completed weeks with ≥1 booking; stop at the first zero-booking
   completed week (or the lookback boundary).
5. **Cancellations**: since a cancelled booking is a deleted row, it
   simply isn't counted for its week — no special-case logic needed, the
   row-deletion model already produces the correct effect.
6. **Brand-new member with zero history**: `streakWeeks = 0`, rendered
   with explicit "no streak yet — book your first class" framing (a
   distinct UI state), never "0-week broken streak" phrasing.
7. Separately surface the **current week's own status** (booked ≥1
   already vs. not yet) alongside the completed-week streak count, so the
   UI can distinguish "streak active, this week already secured" from
   "streak active, this week still needs a booking to continue it."

**Rendering via `MomentumRing`** (confirmed reusable, per instruction):
`value = streakWeeks`, `target = 8` (an ~2-month milestone framing).
`MomentumRing`'s displayed number tracks `value` directly and its ring
fill is separately clamped to `[0,1]` (`momentum-ring.tsx:17`), so a
streak past 8 weeks still shows the true count with a visually "full"
ring — no component change needed, `target` is just a milestone anchor,
not a hard cap.

**Rotating encouraging messages** — concrete pool + deterministic
rotation (no `Math.random`, per the project's established convention):
- 4 message categories, each with 4–5 variants: `no-streak-yet` (first
  booking encouragement), `streak-active-this-week-booked` (celebratory,
  streak continuing), `streak-active-this-week-not-yet-booked`
  (gentle reminder — streak is "at risk" until they book this week),
  `streak-just-broken` (encouraging restart framing, not guilt-driven).
- Rotation key: `hashString(userId + isoDateString(today)) % pool.length`
  — stable for a given user on a given day (no flicker across reloads
  within the same day), changes daily, fully deterministic and testable
  (a known `userId`+date pair always yields the same message in a test).

### Approval requested
Confirm: (a) the completed-week-vs-current-week split for streak
computation (current week never retroactively breaks the streak); (b)
`target=8` as `MomentumRing`'s milestone anchor for the streak ring; (c)
the 4-category/date-keyed-deterministic-hash rotation mechanism for
encouraging messages.

---

## Decision 5: Calendar seed-data expansion

### Evidence
- `0004_classes.sql:26-46` seeds exactly 20 rows, one week,
  `2026-08-17`–`2026-08-23`. No other migration or script adds `classes`
  rows; `seed-members.ts` only ever *reads* `classes` to assign bookings.
- Ship date is Aug 28, 2026; "today" in this session has already moved
  from Aug 19 to Aug 20 mid-task. By the time this dashboard is actually
  demoed, "today" will likely already be past the currently-seeded
  window — a hardcoded fixed calendar month (e.g. "August 2026") goes
  stale the same way the current 1-week seed already has, just on a
  longer fuse.

### Concrete design
- **New script, not an extension of `seed-members.ts`**:
  `supabase/seed/seed-classes.ts`. `seed-members.ts`'s own design is
  explicitly member/booking/account-centric (upsert-by-email,
  idempotent-by-email semantics) and, per investigation, is deliberately
  scoped to never write `classes`. Classes are keyed by sequential `id`
  text (`class_001`...), not email — a different idempotency shape that
  doesn't map cleanly onto `seed-members.ts`'s upsert pattern. Keeping
  class-generation in its own script keeps both scripts single-purpose
  and independently re-runnable, matching the existing
  `member-data.ts`/`seed-members.ts` split (shared generation logic vs.
  the script that writes it).
- **Date range — rolling, not fixed-calendar-month**: generate from the
  Monday of the week containing the script's run date, forward 5 full
  weeks (35 days). This guarantees "a full month has real classes"
  relative to whenever the script actually runs (dev testing today,
  a pre-demo refresh later, etc.) rather than baking in "August 2026"
  and going stale again after Sept 1 — directly addressing the same
  staleness risk investigation flagged for the current 1-week seed, just
  solved structurally instead of by picking a slightly bigger fixed
  range.
- **Recurrence pattern**: reuse the existing per-week shape from
  `0004_classes.sql` (3 instructors × Yoga/Cycling/HIIT mix, ~4 slots/day
  weekdays, lighter weekend coverage) as the base cadence, but generate
  with a small amount of seeded variance (fixed `faker.seed()`, matching
  `member-data.ts`'s reproducibility convention) in (a) which slots exist
  on which days (occasional skipped slot, not every day identical), and
  (b) `booked_count` values, so the resulting month doesn't look
  mechanically identical week-to-week — this also directly benefits
  Decision 2's admin stats, which are more meaningful with realistic fill
  variance than with a robotic repeating pattern.
- **`instructor_member_id`**: every generated row sets this directly
  (Decision 1's FK) — no text-matching backfill needed for new rows,
  since the script already knows which `members` row each instructor is.
- **Idempotency / safety**: generated rows use a distinguishable ID
  scheme (e.g. `class_gen_<YYYYMMDD>_<slot>`) never overlapping the 20
  hand-seeded `class_001`–`class_020` rows. Re-running the script deletes
  and regenerates rows only within its own generated-ID namespace for the
  target date range — but **refuses to delete any generated row that
  already has `booked_count > 0`**, erroring out for manual review
  instead of silently destroying real booking data tied to it. This is
  the load-bearing safety property: it must be safe to re-run this script
  repeatedly as "today" advances without ever touching a class someone
  has actually booked into.
- **Live-DB run is a separate, explicit approval gate** from code review,
  consistent with how `seed-members.ts` has been treated earlier this
  session — flagged clearly in the phased plan below, not bundled into
  the "please review this code" approval.

### Approval requested
Confirm: (a) new script (`seed-classes.ts`) rather than extending
`seed-members.ts`; (b) rolling 5-week window from run-date rather than a
fixed calendar month; (c) the booked-count-guard-on-regeneration safety
rule; (d) that running this against the **live** database is a distinct
approval step, separate from approving the script's code.

---

## Decision 6: Card/data-reuse architecture

### Evidence
- Chat "cards" (`RichCard` union, `lib/chatbot/types.ts:5-12`) are
  explicitly chat-message-width shapes (`schedule`, `members`, `workout`,
  `time-off`, `outreach`, `booking`, `capacity`) rendered by a
  chat-specific renderer — no generic "dashboard section" shape exists,
  and dashboard layout needs (grid cells, stat tiles, multi-column
  panels) are structurally different from a single chat bubble's card.
- Every chatbot intent that computes something a dashboard also needs
  (`getRosterSummary`, `getRetentionCandidates`, `getMemberActivitySummary`,
  `my-appointments.ts`'s inline query, `app/staff/page.tsx`'s inline
  `bookedPercent`/current-next logic) currently has its **query logic**
  fused directly into a chat-reply-string-producing function — the data
  and its chat-string/card presentation are not separated today.

### Recommendation
Dashboard sections get their own **purpose-built components** — not a
reuse of chat card components. But the **underlying query logic**
(everything except the chat-reply-string and `RichCard` wrapper) gets
extracted into plain, presentation-agnostic functions in `lib/`, callable
from both the chatbot intent (unchanged behavior) and the new dashboard
pages (new callers).

Concretely, for each existing intent whose data a dashboard also needs:
extract e.g. `getRosterSummary()`'s query into
`getMemberLifecycleBreakdown(supabase)` (returns
`{active, at_risk, lapsed, tierCounts}`), and have the existing intent
call it and format the *same* reply string it produces today — a
behavior-preserving refactor, verified by confirming chat replies are
byte-identical before/after for a fixed set of test prompts. Same pattern
for `getRetentionCandidates`, `getMemberActivitySummary`,
`my-appointments.ts`'s query, and `app/staff/page.tsx`'s inline
`bookedPercent`/`isCurrentOrNext` logic (the last one isn't chatbot code,
but the same "extract once, call from both places" principle applies
since both the staff dashboard and `/staff` need it).

### Why
Building dashboard UI out of chat cards would fight the layout the whole
way — chat cards were never designed for a grid cell or a stat tile, and
forcing that reuse would mean either warping the card component with
dashboard-specific props (defeating its "one clear shape per chat
message" purpose) or wrapping it in enough dashboard-specific CSS
overrides that the "reuse" saves little real work. Splitting query logic
out, though, avoids the alternative failure mode — two independently
maintained copies of "what counts as an at-risk member" or "how do I
compute this week's bookings" silently drifting apart over time. This is
the single largest cross-cutting decision in the plan since it touches
files nominally owned by "the chatbot" (explicitly out of scope for
*behavior/feature* changes per the brief) — the scope boundary here is
narrow and explicit: **extracting a query into a shared function with an
identical resulting chat reply is in scope; any change to what the
chatbot says, matches, or does is not.**

### Approval requested
Confirm: (a) dashboard sections use new purpose-built components, not
reused chat cards; (b) the specific behavior-preserving-refactor scope
boundary above for touching chatbot intent files (extract-only, verified
by identical replies) — since the brief listed "any change to the
chatbot itself" as out of scope and this is the one place this plan
touches those files.

---

## Phased implementation plan

Sized for independent review — nothing below starts until all 6
decisions above are approved.

**Phase 1 — Schema/linkage (Decision 1).**
1a. Confirm/run `seed-members.ts` live (idempotent — safe to re-run) so
    the 3 instructor `members` rows get `auth_user_id` populated. This is
    a live-data-affecting step requiring its own explicit go-ahead, even
    though the script is already reviewed/existing.
1b. Apply `0016_instructor_class_link.sql` (FK column + backfill +
    3-account staff-role promotion) — run against live DB, own approval
    checkpoint on the exact SQL, verified via the query in Decision 1.
- **Acceptance**: verification query returns all 20 existing classes with
  a correct `instructor_member_id`; the 3 instructor logins can
  authenticate and have `profiles.role='staff'`.

**Phase 2 — Seed-data expansion (Decision 5).**
2a. Build `supabase/seed/seed-classes.ts` (code review, no live writes).
2b. Separate explicit approval to run it against the live DB (per the
    established seed-script-run convention).
- **Acceptance**: a rolling ~5-week window of classes exists with correct
  `instructor_member_id`s set; re-running the script is a no-op or safely
  regenerates non-booked rows only; no existing bookings are affected.

**Phase 3 — Shared query extraction (Decision 6).**
Extract the query functions listed in Decision 6; refactor existing
intents to call them with no reply-text changes.
- **Acceptance**: for a fixed set of test prompts covering
  `roster-summary`, `retention-lookup`, `my-activity`, `my-appointments`,
  chat replies are identical to pre-refactor output; `tsc --noEmit` passes.

**Phase 4 — Admin dashboard (Decision 2).**
Upcoming sessions panel, requests-off panel with inline approve/deny,
month grid calendar, 5 stat tiles.
- **Acceptance**: admin sees studio-wide upcoming sessions; can approve/
  deny a seeded pending time-off request from the dashboard itself
  (verified via a direct SQL check afterward); calendar grid renders the
  full seeded window with correct per-day class chips and working
  overflow; all 5 stats render with real, non-placeholder values.

**Phase 5 — Staff dashboard (Decision 3).**
Depends on Phase 1 (linkage) and Phase 3 (extracted fill/current-next
helpers).
- **Acceptance**: each of the 3 promoted instructor logins sees only its
  own classes (verified as 3 distinct, non-overlapping, non-empty
  results); a non-instructor staff/admin login sees the explicit
  "not linked" empty state, never a studio-wide fallback; fill-rate
  badges match `fillLevel()`'s existing thresholds.

**Phase 6 — Client dashboard (Decision 4).**
Depends on Phase 3 (extracted booking-query functions).
- **Acceptance**: current bookings and history both render correctly for
  a seeded account with existing bookings; streak computation matches
  hand-calculated expected values for at least 3 constructed test cases
  (active streak, broken streak, brand-new member with zero bookings);
  the encouraging message changes day-to-day for the same user
  (deterministic, verified by checking two different dates yield
  different pool entries) and is state-appropriate (new/active/at-risk/
  broken) for each of the 3 test cases above.

**Phase 7 — Full QA pass, all 3 roles.**
End-to-end walk-through as: (a) a client account with real booking
history, (b) a promoted instructor/staff account, (c) an existing
`@pursuit.org` admin account. Confirm no cross-role data leakage (a
client dashboard never shows another client's bookings; a staff
dashboard never shows another instructor's classes; only admin sees the
requests-off panel and can mutate).

---

## Overall acceptance criteria

- All 6 decisions above have explicit user sign-off before any Codex
  implementation phase begins.
- `/dashboard` (or its role-branched successor routes) renders visibly
  distinct content per role — no more "same page, different badge."
- Every new stat/panel is backed by a real query against existing schema
  (plus Decision 1's one new FK column) — nothing hardcoded or
  placeholder in the delivered UI.
- No chatbot reply text or matching behavior changes as a side effect of
  Decision 6's extraction (verified per Phase 3's acceptance criteria).
- Live-DB-affecting steps (Phase 1's seed re-run and role promotion,
  Phase 2's class-seed generation) each got their own explicit approval,
  distinct from code-review approval, before running.
- Full task artifact set completed per this project's Standard
  documentation level (`review.md`, `verification.md`, `final-report.md`
  after implementation).

Not implemented yet — stopping here for approval on the six decisions
above.

### Critical Files for Implementation

- `C:\Users\Wil\Documents\Codex\fitbot\app\dashboard\page.tsx` — current single generic dashboard, root of the refactor.
- `C:\Users\Wil\Documents\Codex\fitbot\app\staff\page.tsx` — source of reusable `fillLevel`/current-next/staff-console UI conventions.
- `C:\Users\Wil\Documents\Codex\fitbot\lib\members\queries.ts` — `getMemberForUser`, the existing auth-identity-to-instructor-identity link this plan builds on.
- `C:\Users\Wil\Documents\Codex\fitbot\supabase\migrations\0011_members_table.sql` and `0014_admin_role.sql` — schema/precedent for the new `0016_instructor_class_link.sql` migration.
- `C:\Users\Wil\Documents\Codex\fitbot\supabase\seed\member-data.ts` and `seed-members.ts` — precedent and dependency for the new `seed-classes.ts` script.
- `C:\Users\Wil\Documents\Codex\fitbot\lib\chatbot\intents\roster-summary.ts`, `retention-lookup.ts`, `my-activity.ts`, `my-appointments.ts` — targets of Decision 6's query extraction.
