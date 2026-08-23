# Investigation: dashboard-role-refactor (Argus)

## Verified facts

**1. Current dashboard (`app/dashboard/page.tsx`)**
- Single component for all roles (`:1-115`). Role branching is exactly:
  badge label text (`:58-60`) and a conditional "Open staff zone" link for
  staff/admin (`:96-104`). No other role-specific content.
- Only query: bookings count for the current ISO week for the logged-in
  user (`:27-41`), rendered via `MomentumRing` (`value=bookedThisWeek`,
  `target=4`, `:64`).

**`MomentumRing`** (`app/components/momentum-ring.tsx:1-84`)
- Purely generic: props `{ value, target, size?, className? }`. Animated
  circular progress ring, no domain-specific logic baked in. Fully
  reusable for any value/target pair (streak count, attendance percent,
  capacity fill) with zero changes. Client component, respects
  reduced-motion.

**2. Instructor identity linkage**
- `classes.instructor` is a plain `text` column (`0004_classes.sql:6`), not
  a foreign key.
- `members.is_instructor boolean` + `full_name` (`0011_members_table.sql:8,21`).
  Seed comment (`member-data.ts:35-38`): the 3 instructors (Sofia Martinez,
  Marcus Lee, Avery Thompson) are seeded as `members` rows specifically so
  `classes.instructor` free text has a backing record.
- Staff/admin login identity lives entirely in `profiles`
  (`0006_member_lookup.sql:4`) — a separate table from `members`.
  `time-off-review.ts:11-13` has an explicit comment confirming this: real
  staff/admin accounts are never rows in `members`.
- The 4 promoted admin accounts (`0014_admin_role.sql`) are `profiles` rows
  with `role='admin'`, not `members` rows, and are not among the 3 named
  instructors.
- **No query anywhere joins a staff/admin login to `classes.instructor`.**
  `members.auth_user_id` is never populated for the 3 instructor rows.
- **Conclusion: there is no existing linkage between a staff/admin login
  and "classes they teach."** The logged-in identity system (`profiles`)
  and the instructor identity system (`members.full_name` fuzzy-matched
  into `classes.instructor` text) are disjoint today. A literal "classes
  I'm hosting" filter for any of the 4 known admin logins would return
  zero classes, since none of them are instructors.

**3. Time-off requests**
- Schema (`0008_time_off_requests.sql:3-12`): `id`, `user_id`,
  `requested_date`, `reason`, `status` (pending/approved/denied),
  `created_at`, `reviewed_by`, `reviewed_at`.
- RLS: staff-wide select (any staff/admin sees all rows), own-row insert,
  and (since `0014_admin_role.sql`) admin-only update.
- Existing query patterns are all **scoped to one person at a time**
  (`time-off.ts`: "my own requests"; `time-off-review.ts`: resolve one
  named person + date, then approve/deny). **No existing "list all pending
  requests across everyone" query** — new code, though RLS already
  supports it with zero migration needed.

**4. Calendar/monthly-event data**
- `classes` schema (`0004_classes.sql:2-12`), RLS: any authenticated user
  can select all rows.
- Seed data (same migration, `:26-46`) is **20 rows spanning exactly one
  week**: `2026-08-17` through `2026-08-23`. No other migration/seed script
  adds more `classes` rows — `seed-members.ts` only reads existing classes
  to assign bookings, never inserts new ones.
- **A "global monthly calendar" would be mostly empty.** Today's date
  (2026-08-19/20) happens to fall inside the one seeded week, but any
  month view beyond `08-17`–`23` has zero rows. Data-population gap, not a
  code gap — the query is trivial once (if) more `classes` rows exist.

**5. Attendance vs. booking data**
- Full `bookings` schema (`0005_bookings.sql:3-9`): only `id`, `class_id`,
  `user_id`, `created_at`, unique `(class_id, user_id)`. **No `status`,
  `attended`, or `no_show` column anywhere.** A row exists on reservation,
  is deleted on cancellation — no state for "class happened, member showed
  up" vs. "no-showed."
- `members.last_visit_date` exists but is static/seeded, never derived from
  bookings by any trigger or query.
- **Conclusion: "session history" can only mean "past bookings," and
  "attendance stats" can only mean booking-fill/booking-count stats, not
  real show-up tracking.** Genuine schema limitation.

**6. Streak-tracking data**
- Grepped the entire codebase for "streak" (case-insensitive) — zero
  occurrences outside this task's own brief. No column, no helper, no
  partial implementation anywhere.
- **Any "weekly streak" must be computed live from `bookings` joined to
  `classes.class_date`** — nothing persisted to read.

**7. Reusable stats-adjacent code**
- `lib/classes/fill-level.ts` — tiny, generic, directly reusable
  (`fillLevel(bookings, capacity)`).
- `app/staff/page.tsx:33-40` — `bookedPercent`/current/next-class logic,
  inline in the page, not yet extracted.
- `lib/chatbot/intents/my-activity.ts` (`getMemberActivitySummary`) and
  `my-goals.ts` (`getMemberGoalsSummary`) — exported functions computing
  roughly what a client dashboard needs (this-week booking count, last
  visit, tier, goals, upcoming matching classes) — currently shaped for a
  chat reply string, not raw structured data; the underlying queries are
  short and directly adaptable.
- `lib/chatbot/intents/roster-summary.ts` (`getRosterSummary`) and
  `retention-lookup.ts` (`getRetentionCandidates`) — staff-facing lifecycle
  and at-risk/lapsed breakdowns, genuinely relevant "admin useful stats"
  material, computable today with zero new schema.

**8. Rotating/varying message copy precedent**
- No existing pattern anywhere in the UI for rotating/randomized display
  copy (grepped `Math.random`, array-of-messages patterns). Would be new
  code — nothing to conflict with, nothing to reuse.

**9. Existing dashboard-adjacent UI conventions** (`app/globals.css`)
- `.dashboard-card`, `.dashboard-momentum`, `.quick-actions`/`.quick-action*`,
  `.momentum-ring*` all exist and are reusable/restyleable.
- `.animate-fade-up` is the established staggered-entrance convention,
  already used on both `/dashboard` and `/staff`.
- `app/staff/page.tsx`'s `.staff-console`/`.staff-ops-band`/`.staff-fill-*`
  conventions form a parallel pattern a staff dashboard could align with.

## Inferences

- **High confidence**: the admin "requests off" panel is buildable today
  with no schema changes — RLS already permits the needed read/update;
  only new code is a "list all pending" query variant.
- **Medium confidence**: "classes they are hosting" as literally worded
  cannot be built without either (a) new schema linking a staff login to
  an instructor identity, or (b) redefining scope to studio-wide "today's
  classes" (already what `app/staff/page.tsx` shows). Given none of the 4
  known admin accounts are instructors, a literal per-instructor filter
  would show zero classes for every currently-known login — this needs an
  explicit decision, not a silent resolution.
- **Medium confidence**: a month-view calendar is trivial to query but
  will render near-empty beyond the one seeded week unless seed data is
  expanded — a data/demo-completeness concern, not a build blocker.

## Unknowns

- Whether a reusable chat-card rendering component exists that could be
  repurposed for dashboard list rendering (`roster-summary`/`retention-lookup`
  already produce `{kind:"members", members:[...]}`-shaped data) — not
  investigated in this pass.
- Whether the user wants "classes they are hosting" redefined as
  scope-fallback (studio-wide today's view) or wants new schema for true
  per-instructor login linkage — a product decision.

## Risks

- **Blocker**: "staff sees classes they are hosting" is not buildable as
  literally worded with current data — needs explicit user sign-off on
  either a workaround or new schema.
- **Data-completeness**: the monthly calendar will look sparse/broken in a
  demo with only 7 days of seeded classes — flag explicitly so it isn't
  mistaken for a bug.
- **Scope-creep**: "attendance stats" can only mean booking counts unless
  a new `attended`/`status` column (and a UI to mark it) is added — a
  materially larger addition than querying existing data.
- **Definition risk**: "streak" needs a precise definition (consecutive
  ISO weeks with ≥1 booking? does a later cancellation retroactively break
  it?) before it can be implemented consistently — no prior art to anchor
  it.
