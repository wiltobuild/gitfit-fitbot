# GitFit — Product B (Operations Dashboard) — Context Summary for Claude Code

*Handoff doc for an agentic coding tool. This is not a spec to build blindly from — it's a starting understanding that needs to be checked against the real project before anything else happens.*

---

## 0. Task for Claude Code — do this first, before writing or changing any code

This is a prototyping project. The project you have access to already contains real decisions — a theme/config, possibly an existing prototype, possibly partial schema — that may have moved on from what's written below. **Treat the actual project as ground truth. Treat this document as a prior draft that needs to be checked, not a source of truth to defend.**

Steps, in order:

1. **Scan the project you have access to** — the existing prototype code, any theme/design-token config, any `package.json`/dependency list, any Supabase schema, migrations, or `.sql` files, any README or existing docs in the repo. Build an actual picture of what exists today.
2. **Reconcile every section below against what you find.** For each section (Roles & Permissions, Design System, Technical Architecture, What Already Exists), note whether the project matches, has diverged, or has gone further than what's described here.
3. **Update this document in place.** Correct anything that's out of date. Fill in real specifics (actual theme tokens, actual current schema, actual current feature list) where this doc was intentionally left generic pending discovery. Don't silently discard the sections that turn out to be accurate — only revise what's changed.
4. **Log what you found and changed**, briefly, in the Reconciliation Log at the bottom — this is what lets a human (or the next agent session) understand *why* the doc looks the way it does after your pass, not just what it says now.
5. **Only after reconciling, produce/update Section 7 (Plan Ahead)** — the forward build plan should be based on the real current state you just confirmed, not on the assumptions this draft started with.

**If something below conflicts with what you find and it's not obvious which is right, stop and ask rather than guessing** — silently picking one silently discards the other person's decision.

**This will happen again.** This is a prototype, not a finished product — expect another round of "reconcile against reality" every time real building happens between now and whenever this doc is next opened. Each pass should leave the doc closer to reality and the plan more specific, not just longer.

---

## 1. Business & suite context

**GitFit** is a suite of 4 products for a single-location boutique fitness studio (yoga, cycling, HIIT classes, membership-based). Four people are each building one product, sharing one backend/identity system:

- **Product A** — Member Booking App (members view schedule, reserve spots)
- **Product B** — Operations Dashboard *(this product)* — schedule, staff, and member-risk visibility for Manager + Trainers
- **Product C** — Member Support Chatbot
- **Product D** — Member Re-engagement Tool (flags lapsing members, drafts outreach)

Teammates are building A, C, D alongside this one — not finished yet, so Product B's external dependencies are currently stubbed/mocked, designed to match a documented contract so real integration later is a swap, not a rewrite.

*Reconcile: has this changed — are A/C/D further along, does a shared backend/service already exist that changes the "stubbed" assumption?*

## 2. What Product B is

The studio's operations command center. One login, one dataset, two views based on role:

- **Manager** — sees and controls the whole studio
- **Trainer** — sees and controls only their own week

Not yet named as a final product (working title "Operations Dashboard"; naming candidates discussed: Crew, Cadence — unresolved, doesn't block building).

*Reconcile: check if the project's package name, repo name, or any branding already settled this.*

---

## 3. Roles & permissions — prior decision, verify against real usage

Three roles total in the system: `member`, `trainer`, `manager`. This product only concerns `trainer` and `manager`; `member` belongs to Product A.

**Manager — full admin-level access:**

| Can do |
|---|
| View the full studio schedule — every class, every trainer |
| Create, edit, and cancel classes (schedule management) |
| View every trainer's roster and every class's capacity |
| Promote an underbooked class to members |
| Approve or deny any trainer's time-off / shift-swap request |
| Add, edit, or remove trainer profiles (hire/offboard) |
| View and manage trainer certifications, incl. expiry |
| View at-risk member flags across all classes |
| View the full cross-suite activity feed |

**Trainer — scoped to their own world:**

| Can do | Cannot do |
|---|---|
| View their own schedule only | Cannot view other trainers' schedules or requests |
| View roster for their own classes (with at-risk tags) | Cannot promote a class — only flag it to the Manager |
| Submit a time-off / shift-swap request | Cannot approve or deny any request, including their own |
| View their own notifications | Cannot create, edit, or cancel classes |
| View/update their own profile & cert info | Cannot see suite-wide activity, only what's relevant to them |

**Enforcement rule (non-negotiable, should hold regardless of what else changes):** role-based restrictions must be enforced server-side (Supabase Row Level Security), never only hidden in the UI. A Trainer's client should be technically incapable of resolving a request or promoting a class, not just visually prevented from it.

**Still unresolved — ask rather than assume:**
- Can a Trainer edit their own submitted request before it's resolved, or only submit/withdraw?

*Reconcile: if real usage or the actual codebase has already answered either open question above, update this section with the real answer and remove it from "unresolved."*

**Resolved 2026-08-19, superseded 2026-08-20**: `manager`/`trainer` are
separate, mutually exclusive access tiers — but not a bespoke pair of DB
values. A parallel task (unrelated to this one) merged `role = 'admin'`
into the existing `client | staff` enum before this product's own
manager/trainer split was implemented. Rather than add a redundant
`is_manager` boolean (built once, then reverted the same session — see
`docs/agent/decisions.md`, 2026-08-20), **Manager = `role = 'admin'`,
Trainer = `role = 'staff'`**. Every "manager can / trainer can only"
statement in the table above still holds — only the underlying DB value
changed. Helpers `is_staff(uid)` (staff-or-admin) and `is_admin(uid)`
(admin-only) already exist (`0014_admin_role.sql`) and are what every new
manager-only policy below should call. See Reconciliation Log below.

---

## 4. Design system

**Do not introduce new design tokens.** The theme (colors, typography, layout, component styling) lives in the project's existing format/config — that's the source of truth, not this document.

*Reconcile: locate the actual theme/token source in the project (config file, CSS variables, design-system package — whatever form it takes) and replace this section with a short pointer to exactly where it lives, plus a one-line note on anything Product B does that's a deliberate deviation from it, if any.*

The one thing worth preserving regardless of which theme implements it: the capacity indicator (dots/gauge per class) should communicate both class type and booking-health status at a glance — that's a product decision, not a styling one.

---

## 5. Technical architecture

**Stack:** Supabase (Postgres + Auth + Row Level Security). Assumed one shared Supabase project across the whole 4-product suite, not four separate projects.

*Reconcile first, before anything else in this section: is the shared-project assumption still true? Check for an existing Supabase project/connection in the codebase. This is the single assumption everything else here depends on — if it's wrong, the schema and RLS approach below need to be revisited, not just patched.*

**Schema — this product owns (verify against any migrations/schema already in the project — this may already be built, partially built, or changed):**
```sql
requests (
  id uuid primary key,
  trainer_id uuid references profiles(id),
  type text check (type in ('time_off','shift_swap')),
  details text,
  status text default 'pending' check (status in ('pending','approved','denied')),
  created_at timestamptz default now(),
  resolved_at timestamptz
)

promo_events (
  id uuid primary key,
  class_id uuid references classes(id),
  promoted_by uuid references profiles(id),
  sent_to_count int,
  created_at timestamptz default now()
)
```

**Schema — shared across the suite, this product reads (and for `classes`, possibly writes temporarily — see Section 8):**
```sql
profiles (
  id uuid primary key references auth.users(id),
  full_name text,
  role text check (role in ('manager','trainer','member')),
  spec text,
  cert_name text,
  cert_expiry date
)

classes (
  id uuid primary key,
  class_date date,
  start_time time,
  type text check (type in ('yoga','cycling','hiit')),
  name text,
  trainer_id uuid references profiles(id),
  capacity int,
  promoted boolean default false
)

bookings (id, class_id, member_id, status)       -- owned by Product A
at_risk_flags (id, member_id, reason, flagged_at) -- owned by Product D
```

**RLS pattern (example — replicate for every write):**
```sql
create policy "only managers resolve requests"
  on requests for update
  using (exists (
    select 1 from profiles where id = auth.uid() and role = 'manager'
  ));
```

**Auth:** Supabase Auth, role read from `profiles.role` server-side after login. No client-side role selection in production.

**Graceful degradation requirement:** if `at_risk_flags` or `bookings` data is unavailable, the relevant UI element should degrade to "unknown" or hide — never break the rest of the page.

*Reconcile: does the real schema in the project match the above? Note every difference explicitly rather than silently adopting whichever version is newer.*

---

## 6. What already exists — reconciled 2026-08-20

Live Next.js + Supabase app, one `/staff` route (`app/staff/page.tsx`),
gated `requireRoleOrRedirect(["staff", "admin"])`. **No Manager/Trainer
view split exists yet** — every `staff` and `admin` account sees the
exact same page today. That's the biggest gap versus this doc's Section
2/3 model (two views based on role) and isn't captured by Phases B–D
below, which are schema/RLS-focused, not UI-focused. Concretely, the page
has three panels, all suite-wide (not scoped to "my own week"):

- **Live register** — today's classes studio-wide, capacity/fill-level
  bars, no create/edit/cancel affordance (`classes` has no mutation path
  for anyone — Phase C).
- **Member directory search** — staff-wide member lookup, no
  trainer-vs-manager distinction.
- **Ask FitBot tiles** — links into the chatbot (owned by a teammate,
  out of scope for this product's own UI work).

No request-approval UI (`time_off_requests` submission exists via a
chatbot intent, but nothing resolves `status`), no schedule-management
UI, no cert UI, no promote-class action, no at-risk visibility, no
activity feed. Schema-wise: `time_off_requests` already has an
admin-only UPDATE policy (`time_off_requests_update_admin`, added
incidentally by the admin-role merge) but no `type` column for
`shift_swap` and no narrowed SELECT (`is_staff`, not
own-rows-for-trainers, sees everything). `classes` has no `trainer_id`/
`promoted`. No `promo_events`. No `spec`/`cert_name`/`cert_expiry` on
`profiles`. No `at_risk_flags` — `lib/chatbot/intents/retention-lookup.ts`
computes an ad-hoc notion of "worth re-engaging" but it isn't a table and
isn't manager-visible outside chat.

---

## 7. Plan ahead — rebuilt 2026-08-20 against real current state

Full schema-level detail lives in `docs/tasks/operations-dashboard/
investigation.md` (Phases A–E) — this section is the product-workflow
view of the same plan, phrased around what a Manager or Trainer actually
needs to be able to do, per Section 3's tables.

**0. Manager/Trainer view split** — not one of the lettered phases below
but a prerequisite for all of them mattering: today's single shared
`/staff` page needs to branch on `session.role === "admin"` (Manager) vs
`"staff"` (Trainer) so the UI itself stops offering actions/visibility a
Trainer shouldn't have, on top of the RLS enforcement each phase below
adds server-side. Without this, Phases B–D's new server-side permissions
have no UI to attach to.

**A. Done** — `role='admin'` = Manager, `role='staff'` = Trainer. No
further schema work.

**B. Request resolution + trainer scoping** — `time_off_requests.type`
column; verify/extend the existing admin-only UPDATE policy; narrow
SELECT so Trainer sees only their own requests. UI: an "Approve/Deny"
affordance in the Manager view; Trainer view shows only their own
submissions (view 0 dependency).

**C. Class ownership** — `classes.trainer_id`, `classes.promoted`;
admin-only INSERT/UPDATE/DELETE policies (none exist today). UI: Manager
gets create/edit/cancel + "Promote" on underbooked classes; Trainer view
scopes the register to `trainer_id = auth.uid()`.

**D. Promotion events + certifications** — `promo_events` table
(admin-only INSERT); `profiles.spec`/`cert_name`/`cert_expiry` (Trainer
self-editable, Manager can edit anyone's — RLS already covers this via
the existing `is_staff`-based UPDATE policy widened by the admin-role
merge). UI: Manager gets a trainer roster/cert view; Trainer gets a
"flag to manager" affordance instead of a real promote action.

**E. At-risk visibility — needs its own investigation pass first.**
Whether to add an `at_risk_flags` table or surface
`retention-lookup.ts`'s existing logic to the Manager view directly is
still an open question (see `investigation.md` Phase E). Don't plan this
one in detail until that investigation happens.

**Communication / notifications (user-decided 2026-08-20):** no dedicated
notifications table or delivery mechanism — "notifications" are derived
from existing state, not a new subsystem. Trainer's "My requests" panel
always shows current status (pending/approved/denied) — that status
change *is* the notification, no unread tracking. Manager's "Requests
inbox" shows a live pending count. Same pattern would apply to a future
class-flag feature (Phase D) if built. Section 3's "view their own
notifications" / "cross-suite activity feed" language is satisfied by
this derived-state approach for now; revisit only if a real
push/unread-badge experience becomes a stated requirement.

Suggested order: **0 → B → C → D**, with E scoped separately once there's
room. 0 is small (branch the existing page, no new schema) and unblocks
every other phase's UI; B is the smallest schema lift and has partial
groundwork already in place from the admin-role merge.

---

## 8. Suite-wide agreements this product must respect

(From the team's shared alignment contract — the minimum floor, regardless of how each product is built internally. Less likely to have changed than Sections 4–7, but worth a quick check if the team has revisited it.)

- One `memberId`/`trainerId`/`managerId` — all just `profiles.id` — never invent a separate local ID.
- Product A owns `classes` as source of truth long-term; until A exists, this product may need to seed/maintain it temporarily — flag this explicitly with the team, don't assume silently.
- Shared vocabulary: "underbooked" = booked ÷ capacity < 45%; "at-risk" = member flagged by Product D based on recent attendance drop; "booked" ≠ "attended" (no check-in system yet, treated as equivalent for now).
- One login for the whole suite, no product builds its own auth.
- Degrade gracefully on a missing dependency — never crash the whole page.

## 9. Explicitly out of scope for this build

- Revenue, payroll dollar amounts, per-trainer profitability
- Multi-location support
- Predictive scheduling, automated marketing, internal chatbot assistant, studio health score — documented separately as visionary roadmap ideas, not committed features

*Reconcile: has the team decided to pull any of these in? Move them out of this list if so, don't leave them contradicted by the plan above.*

---

## Reconciliation Log

*Filled in by whoever (or whichever agent session) last reconciled this doc against the real project. What was checked, what matched, what didn't, what was updated. Newest first.*

- **2026-08-20 — second reconciliation pass (Claude Code).** Triggered by
  a teammate's parallel merge (`0014_admin_role.sql`, unrelated task) that
  added `role = 'admin'` while this product's own manager/trainer work was
  in flight. Section 3: replaced the `is_manager` boolean plan with
  `role = 'admin'` = Manager / `role = 'staff'` = Trainer — the boolean
  was actually built and approved, then reverted the same session once
  the redundancy was noticed (full sequence in `docs/agent/decisions.md`).
  Section 6: rewritten — confirmed the single biggest gap versus this
  doc's own Section 2/3 model is structural, not just missing schema: one
  shared `/staff` page renders identically for every `staff`/`admin`
  account today, no Manager-view/Trainer-view branch exists at all.
  Section 7: rebuilt as a workflow-phased plan (0: view split, then
  B→C→D→E) cross-referenced to `docs/tasks/operations-dashboard/
  investigation.md`'s schema-level Phase breakdown, instead of the
  generic 7-step scaffold this doc started with.

- **2026-08-19 — first reconciliation pass (Claude Code).** The premise in
  Section 1 (four teammates building four separate products against a
  shared-but-external Supabase project, this product's dependencies
  stubbed pending real integration) is **superseded**, not just stale: a
  2026-08-18 architecture pivot (recorded in `docs/agent/decisions.md` in
  this repo) means this repo now owns all suite data directly — there is
  one app, not four apps meeting at a contract. So "Product B" isn't
  something to integrate via a swapped API; it's a feature set (schedule
  management, request approval, trainer/manager scoping, certs, class
  promotion, at-risk visibility) to fold into this repo's existing Staff
  Console.
  - **Section 3 (roles)**: real schema has only `client`/`staff`
    (`supabase/migrations/0001_profiles_and_roles.sql`) — no
    `member`/`trainer`/`manager` split exists anywhere in code or DB. User
    confirmed (2026-08-19): distinguish manager-level staff from
    trainer-level staff, enforced via RLS, matching this section's
    permission model — but as a boolean `is_manager` flag on the existing
    `staff` role rather than a third `role` value (simpler, touches far
    less code, since `role` itself never changes). "Manager" = `role =
    'staff' and is_manager = true`; "trainer" = `role = 'staff' and
    is_manager = false`. Existing `staff` rows backfill `is_manager =
    true` to preserve current access. See
    `docs/tasks/operations-dashboard/plan.md` for the full design.
  - **Section 5 (schema)**: shared-Supabase-project assumption holds
    (trivially — it's one app). `classes` (`0004`) exists but is
    read-only/seeded, no `trainer_id` or `promoted` column, no staff
    mutation path. `time_off_requests` (`0008`) exists but has no UPDATE
    policy — approve/deny isn't wired for anyone yet, and `type` doesn't
    yet support `shift_swap`. No `promo_events`, no `at_risk_flags`, no
    cert columns (`spec`/`cert_name`/`cert_expiry`) on `profiles`.
    `outreach_messages` (`0009`) is a staff-only, confirmation-gated
    analog to Product D's re-engagement idea but isn't the same shape as
    `at_risk_flags`.
  - **Section 6 (what exists)**: the believed-existing static prototype
    (mock `Api` object, demo role switcher) is not present in this repo —
    disregard entirely. What exists instead is a live Next.js +
    Supabase app with a working Staff Console (live register, member
    lookup, time-off *submission* only, retention/outreach) and a
    deterministic chatbot layered over the same data.
  - **Section 7 (plan)**: rebuilt as a phased plan in this repo's task
    conventions rather than in this document — see
    `docs/agent/decisions.md` and (once created) `docs/tasks/` for the
    live version, since duplicating a long-form plan here would create a
    second source of truth that drifts.

## Changelog

*Substantive content changes, distinct from reconciliation passes above. Newest first.*

- **v1.2** — Restructured around a reconcile-then-plan workflow: added Section 0 tasking Claude Code to check this doc against the real project before building, added a Reconciliation Log, reframed Sections 4–7 as "verify, don't assume."
- **v1.1** — Removed specific design tokens from Section 4; project's existing theme is the source of truth.
- **v1** — Initial handoff doc. Manager/Trainer permission split decided; shared-Supabase-project assumption flagged for confirmation; two role questions flagged as unresolved.
