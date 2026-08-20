# Plan: fitbot-capability-expansion (Athena)

Covers, as one unified plan: the three-tier role model (client/staff/admin) rollout and the Fitbot capability expansion (more intents, chips, cards, and matching-tolerance rework), gated by that role model from the start.

Baseline: `main` @ `4ae4995`.

---

## Decision 1: Schema change for the admin role

### Evidence
`profiles.role text not null default 'client' check (role in ('client','staff'))` (`0001_profiles_and_roles.sql:7`), never altered through migration 0013. `is_staff(uid)` is the sole helper, used by every RLS policy that needs a staff check. `time_off_requests` (`0008_time_off_requests.sql`) has SELECT (staff) and INSERT (own+staff) policies but explicitly no UPDATE policy. `protect_profile_role()` trigger blocks any role change unless the caller is already staff, service_role, or superuser.

### Options
1. Widen the check constraint to `('client','staff','admin')`, add `is_admin(uid)` mirroring `is_staff`, and compose admin-sees-everything-staff-sees by adding a new `is_staff_or_admin(uid)` helper used everywhere `is_staff(uid)` currently gates staff-wide data, updating existing policies to call it.
2. Same constraint widening, but instead of a new composed helper, redefine `is_staff(uid)` itself to return true for both `'staff'` and `'admin'` rows, leaving all existing policy call sites unchanged.
3. Add admin as a fully separate axis (e.g., `is_admin boolean` flag column on `profiles` orthogonal to `role`) rather than a third `role` value.

### Recommendation
Option 2: redefine `is_staff(uid)` to match `role in ('staff','admin')`, and add a new `is_admin(uid)` (`role = 'admin'` only) purely for the admin-exclusive gate (time-off approval).

### Why
Every existing RLS policy across `profiles`, `bookings`, `time_off_requests` (select), `outreach_messages`, `members`, and the three `security definer` search functions calls `is_staff(auth.uid())` as their staff-wide-access gate. Since admin is a strict superset of staff for everything except approve/deny, the cheapest, lowest-blast-radius change that's also least likely to be forgotten in some policy is to make the existing "staff-wide access" predicate include admins by definition, rather than hunting down and editing every policy to add `OR is_admin(...)`. Option 1 requires touching every existing policy for identical effect — more risk of a missed call site for the same result. Option 3 is unnecessary complexity — the user explicitly asked for a third `role` value.

Naming caution: redefining `is_staff` to also mean "or admin" is a small semantic drift from its literal name — mitigated with a clear doc-comment on the function.

### Concrete migration (new file `0014_admin_role.sql`)
```sql
-- Add the admin role: a superset of staff plus admin-exclusive capabilities
-- (time-off approval). is_staff() is redefined to also match admin rows,
-- since every existing staff-wide RLS policy should also admit admins.
-- Use is_admin() for admin-exclusive gates (things staff must NOT get).

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('client', 'staff', 'admin'));

create or replace function public.is_staff(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('staff', 'admin')
  );
$$;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'admin'
  );
$$;

-- protect_profile_role() already allows staff to change roles (is_staff check);
-- that now also covers admins, which is correct — admins may promote/demote.

-- Approve/deny time-off: admin-only (staff functions stay as-is; staff has
-- no approval capability today, so this is purely additive to admin).
create policy "time_off_requests_update_admin"
on public.time_off_requests
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
```

### Approval requested
Confirm: (a) redefining `is_staff()` semantics (rather than adding a parallel `is_staff_or_admin()` helper) is acceptable; (b) time-off approve/deny is admin-only at the DB level, not staff-or-admin.

---

## Decision 2: Data migration promoting the 4 `@pursuit.org` accounts

### Evidence
Confirmed live this session: exactly 4 `staff`-role accounts exist — `wil.sheppard@pursuit.org`, `riarusso@pursuit.org`, `dikshyant.giri@pursuit.org`, `stanley.remy@pursuit.org` — no other account is `staff`-role (instructors are `client`-role with `is_instructor=true`; all 24 demo members are `client`).

### Recommendation
Hardcoded email list (not a domain wildcard), appended to `0014_admin_role.sql` after the DDL, clearly commented as a one-off data change.

### Why
A `LIKE '%@pursuit.org'` wildcard is riskier if a 5th `@pursuit.org` account is added before this runs. Hardcoding the exact 4 verified emails makes the promotion auditable — a non-matching row is a no-op, not a broadened match.

### Concrete content (appended to `0014_admin_role.sql`)
```sql
-- One-off promotion of the 4 known @pursuit.org staff accounts to admin.
-- Not idempotent DDL — a deliberate data change, run once.
update public.profiles
set role = 'admin'
where role = 'staff'
  and id in (
    select id from auth.users
    where email in (
      'wil.sheppard@pursuit.org',
      'riarusso@pursuit.org',
      'dikshyant.giri@pursuit.org',
      'stanley.remy@pursuit.org'
    )
  );
```

### Verification query (run after)
```sql
select email, p.role
from public.profiles p join auth.users u on u.id = p.id
where p.role in ('staff', 'admin')
order by p.role, email;
```
Expected: exactly 4 rows with `role='admin'`, all the emails above; zero rows with `role='staff'`.

### Approval requested
Confirm these 4 addresses are correct and this should run against the live database as part of Phase 1.

---

## Decision 3: Updating the ~9 exact-role-comparison call sites

### Evidence
Investigation section 8 (full catalog). `UserRole` is currently `"client" | "staff"`; `getSession()` collapses anything non-`"staff"` to `"client"` — an admin profile would silently be treated as an ordinary client until fixed.

### Concrete per-site changes

| Site | Current | New |
|---|---|---|
| `lib/auth/session.ts` `UserRole` | `"client" \| "staff"` | `"client" \| "staff" \| "admin"` |
| `lib/auth/session.ts` `getSession()` | `profile?.role === "staff" ? "staff" : "client"` | `profile?.role === "admin" ? "admin" : profile?.role === "staff" ? "staff" : "client"` |
| `requireRoleOrRedirect`/`requireRoleOrThrow` | `role: "staff"` param, exact `!==` check | Widen param to `role: "staff" \| "admin" \| Array<"staff"\|"admin">`; check becomes `Array.isArray(role) ? !role.includes(session.role) : session.role !== role` |
| `app/staff/page.tsx` (and any other staff-gated page) | `requireRoleOrRedirect("staff")` | `requireRoleOrRedirect(["staff","admin"])` — admins must retain staff-zone access |
| `app/dashboard/page.tsx` badge + staff-zone link | staff-only checks | Badge: `role === "admin" ? "Admin" : role === "staff" ? "Staff" : "Member"`. Link: `role === "staff" \|\| role === "admin"` |
| `app/page.tsx` homepage module grid | `session.role === "staff"` | `session.role === "staff" \|\| session.role === "admin"` |
| `app/components/nav-links.tsx` | `role === "staff" ? [...links, staffLink] : links` | `role === "staff" \|\| role === "admin" ? [...links, staffLink] : links` |
| `app/api/chat/route.ts` menu ternary (POST + GET) | `session.role === "staff" ? STAFF_MENU : CLIENT_MENU` | `session.role === "admin" ? ADMIN_MENU : session.role === "staff" ? STAFF_MENU : CLIENT_MENU` |
| `lib/chatbot/intents/help.ts` | staff/else | Third branch: `role === "admin" ? adminText : role === "staff" ? staffText : clientText`. Admin text mentions time-off approval. |
| `lib/chatbot/chips.ts` `staffOnly`/`clientOnly` | exact match | `staffOnly` becomes `(role === "staff" \|\| role === "admin")`. `clientOnly` unchanged. New `adminOnly(session)` helper added for the time-off-approval chip/intent. |
| `lib/chatbot/types.ts` `Intent.roles` | `Array<"client" \| "staff">` | `Array<"client" \| "staff" \| "admin">` |
| Every existing staff-only intent's `roles: ["staff"]` (who-is-booked, member-lookup, time-off, retention-lookup, outreach-draft, outreach-send, members-by-attribute) | `["staff"]` | `["staff", "admin"]` |
| `help.ts`, `my-appointments.ts`, `book-class.ts`, `schedule.ts`, `workout-plan.ts` roles | `["client", "staff"]` | `["client", "staff", "admin"]` |

`time-off.ts`'s own lookup path stays "own requests only" (unchanged) — the new admin approve/deny flow (Decision 5) is a separate, additional capability, not a widening of this existing "my requests" lookup.

### Approval requested
Confirm the `staffOnly()`-includes-admin default (admin automatically gets every current staff-only chip/intent, no per-item opt-out) is intended.

---

## Decision 4: Closing the chip authorization single-layer gap

### Evidence
`app/api/chat/route.ts` validates only that `chipId` is a known object key; authorization is delegated entirely to each handler's internal `staffOnly()`/`clientOnly()` call. Intents get two layers (router's `roles.includes()` check happens before `match()` even runs); chips get one.

### Recommendation
Add a `CHIP_ROLES: Record<ChipId, Array<"client"|"staff"|"admin">>` manifest to `chip-labels.ts` (client-safe, no server imports) and have `route.ts` check it before invoking the handler.

### Why
`chip-labels.ts` already exists specifically to hold client-safe role/label metadata. This gives every chip the same two-layer structural defense intents already have. Because `CHIP_ROLES` is a `Record<ChipId, ...>`, TypeScript forces every `ChipId` to have an entry — forgetting the manifest entry for a new chip becomes a compile error, not just an easy-to-skip step.

### Concrete implementation
```ts
// chip-labels.ts
export const CHIP_ROLES: Record<ChipId, Array<"client" | "staff" | "admin">> = {
  "quick-workout": ["client", "staff", "admin"],
  "plan-my-week": ["client", "staff", "admin"],
  "build-consistency": ["client", "staff", "admin"],
  "retention-outreach": ["staff", "admin"],
  "time-off-coverage": ["staff", "admin"],
  "member-lookup": ["staff", "admin"],
  "member-summary": ["staff", "admin"],
  "my-goals": ["client"],
  "my-activity": ["client"],
  "todays-schedule": ["client", "staff", "admin"],
  "my-appointments": ["client", "staff", "admin"],
  "menu": ["client", "staff", "admin"],
  // + every new chip from Decision 7, each with an explicit entry.
};
```
```ts
// app/api/chat/route.ts, before invoking chips[chipId]
if (chipId) {
  if (!Object.prototype.hasOwnProperty.call(chips, chipId)) return Response.json({ error: "Unknown chipId." }, { status: 400 });
  if (!CHIP_ROLES[chipId as ChipId].includes(session.role)) return Response.json({ error: "Forbidden." }, { status: 403 });
}
```

### Approval requested
Confirm this two-layer approach (manifest check in `route.ts` + handler's existing internal check kept as defense-in-depth) as the convention for all chips, including new ones.

---

## Decision 5: Admin time-off approve/deny capability

### Evidence
`time_off_requests` has no UPDATE RLS policy today (Decision 1 adds one, admin-only). Existing precedent for a mutating staff action: outreach's two-step draft-then-send flow.

### Recommendation
Single-step: one lookup chip (`pending-time-off`) plus one mutating intent (`time-off-review`) that requires the message to name both the person and the date — no confirmation turn required, but any ambiguity (zero or multiple matches) blocks the mutation and asks for disambiguation instead.

### Why
The user framed this as lower-stakes/internal-only relative to outreach (which is member-facing communication). Requiring both person and date already acts as a strong accidental-trigger guard structurally similar to confirmation flows, without adding conversational friction disproportionate to the actual risk (a wrongly-approved/denied request only affects internal scheduling and can be corrected with a follow-up).

### Concrete design
- New intent `time-off-review.ts`, `roles: ["admin"]`.
- Match: approve/deny/reject language combined with a resolvable requestor name + date (reuse `time-off.ts`'s `resolveRequestedDate` helper and the name-matching pattern already used in `book-class.ts`/`time-off-coverage`).
- Handle: resolve the target via `list_members_for_staff` (same pattern `time-off-coverage` chip uses to map instructor names to `time_off_requests.user_id`), find the matching *pending* row by date. Exactly one match → `update time_off_requests set status=..., reviewed_by=session.user.id, reviewed_at=now()`. Zero or multiple matches → disambiguation reply, no mutation (mirrors `book-class.ts`'s existing `resolutionReply` pattern for ambiguous class matches).
- New chip `pending-time-off` (`CHIP_ROLES: ["admin"]`) listing all pending requests with instructor + date — a discoverable entry point into the free-text-driven approve/deny flow.
- Success reply states old→new status plainly: `"Marked Sofia's time-off request for Fri, Aug 21 as approved."`

### Approval requested
Confirm single-step (name+date required, no separate confirm turn) is acceptable, and confirm "refuse to mutate on any ambiguity" (never guess the most-recent request) is the right default.

---

## Decision 6: New RichCard kinds

### Evidence
5 kinds today (`schedule`, `members`, `workout`, `time-off`, `outreach`). Gaps: time-off creation confirmation (text-only), booking success/failure (text-only), no capacity/coverage card, no instructor-profile card.

### Recommendation
Add exactly 2 new kinds: `booking` and `capacity`. Reuse `time-off` for creation-confirmation and approve/deny-result. Reuse `schedule` for instructor-profile lookups (a filtered class list).

### Why
Keeps to the established "reuse before inventing" convention while adding real new kinds where the data genuinely doesn't fit — booking outcome and capacity/fill-level aggregates are both structurally new shapes; time-off status and instructor class-lists are not.

### Concrete shapes (added to `lib/chatbot/types.ts`'s `RichCard` union)
```ts
| { kind: "booking"; className: string; date: string; time: string; instructor: string; outcome: "confirmed" | "cancelled" | "failed"; reason?: string }
| { kind: "capacity"; title?: string; rows: Array<{ className: string; instructor: string; time: string; bookedCount: number; capacity: number; fillLevel: "healthy" | "filling" | "full" }> }
```
`chat-cards.tsx` gets two new switch cases. `book-class.ts`'s success/failure replies get a `booking` card attached. Extract `fillLevel()` from `app/staff/page.tsx` into a shared helper (e.g. `lib/classes/fill-level.ts`) so the page and the new capacity intent share one implementation instead of duplicating the ratio math.

### Approval requested
Confirm reusing `time-off` (creation + approve/deny) and `schedule` (instructor lookup) rather than inventing 2 more kinds for those.

---

## Decision 7: New intents/chips

### Evidence
Untapped: capacity/fill-level classification and current/next-class detection exist only in `app/staff/page.tsx`; no instructor-profile lookup exists anywhere. Membership tier/status changes, waitlists, payments, and reviews don't exist as app functionality at all — correctly out of scope.

### Recommendation — 8 new capabilities

| # | id | role(s) | data | read/mutate | card |
|---|---|---|---|---|---|
| 1 | `time-off-review` (intent) | admin | `time_off_requests` UPDATE | mutate | `time-off` |
| 2 | `pending-time-off` (chip) | admin | `time_off_requests` SELECT (pending) | read | `time-off` |
| 3 | `studio-capacity` (intent+chip) | staff, admin | `classes`, reusing `fillLevel()` | read | `capacity` |
| 4 | `instructor-classes` (intent+chip) | client, staff, admin | `classes` filtered by instructor (from `members.is_instructor`) | read | `schedule` |
| 5 | Booking success/failure card wiring | client, staff, admin | existing `reserveBooking`/`cancelBooking` results, now carrying a `booking` card | read (formatting only) | `booking` |
| 6 | Broader cancel-lookup phrasing in `book-class.ts` | client, staff, admin | existing `bookings` | mutate (existing) | `booking` |
| 7 | `class-info` (intent) | client, staff, admin | `classes`, single-class detail by name+date | read | `schedule` |
| 8 | `roster-summary` (intent) | staff, admin | `list_members_for_staff` aggregate counts by `lifecycle_status`/`membership_tier` | read | `members` |

### Why this count
Every item traces to either (a) a confirmed admin requirement, (b) an Argus-identified data surface with no Fitbot equivalent today, or (c) a natural extension of an existing capability. Bounding at 8 keeps this sized for one implementable, reviewable phase — speculative net-new app functionality (waitlists, payments, tier changes) is correctly excluded since it doesn't exist anywhere in the app yet.

### Approval requested
Confirm this specific list of 8 — anything missing that you specifically want included?

---

## Decision 8: Matching-tolerance approach ("pass for AI" requirement)

### Evidence
Current approach: ordered intent list + fixed trigger-phrase regexes + ad hoc exclusion regexes (`timeOffShaped`, `otherIntentShaped`). The `intents/index.ts` comment itself says the exclusion list "is expected to grow" — an admission the pattern doesn't scale. Concrete failing examples: "Can you get me a spot in tomorrow's yoga class", "can you pull up Jane Smith's account", "I won't be able to work this Friday", "can you write something to win back Sarah".

### Recommendation
Confidence-scoring: each intent's `match()` returns a number (0 = no match) instead of a boolean, scored on (a) trigger-phrase-family presence and (b) required-entity presence (a name-shaped token, a class-type word, a date word), summed. `routeMessage` picks the highest score above 0, ties broken by registration order.

### Why
This solves broadened phrasing *and* collision-proneness at once — an intent only wins if it has both a plausible trigger and the entity that intent actually expects, replacing today's exclusion-regex hacks with "the correct intent scores higher because it has the right entity," not "a competitor was blocklisted." Stays 100% deterministic regex/keyword matching — no fuzzy library, no ML — satisfying the "completely through deterministic code" bar. This is the single largest-diff decision in the plan (touches all 14 existing intents' `match()` signatures), sized as its own isolated phase so a regression is attributable to this change alone.

### Concrete mechanism
```ts
// lib/chatbot/match-scoring.ts
export function scoreTriggerFamily(message: string, triggerPatterns: RegExp[]): number {
  return triggerPatterns.some((p) => p.test(message)) ? 1 : 0;
}
export function scoreEntity(message: string, entityPatterns: RegExp[]): number {
  return entityPatterns.some((p) => p.test(message)) ? 1 : 0;
}
```
`Intent.match` signature changes from `(message, session) => boolean` to `(message, session) => number`. `routeMessage` collects the highest score above 0 across intents whose `roles` include the caller's role.

### Approval requested
Confirm the scoring-based approach (touching all 14 existing intents) is worth the diff size versus a narrower synonym-preprocessing-only approach with a lower ceiling on the collision problem — this is the plan's largest single change.

---

## Decision 9: Role-appropriate UI visibility (defense-in-depth)

### Evidence
`suggestedChips` is computed fresh from the live session role on every request (both POST and GET), never cached client-side across requests — confirmed by reading `route.ts` directly. No gap exists today.

### Recommendation
Server-side freshness remains the real security boundary (already correct). Add a cheap client-side filter using the new `CHIP_ROLES` manifest (Decision 4) as defense-in-depth, since it costs almost nothing once that manifest exists.

### Approval requested
None required — confirmation of existing correct behavior plus a low-cost addition, flagged for visibility only.

---

## Phased implementation plan

**Phase 1 — Schema**: `0014_admin_role.sql` per Decisions 1–2. Run against dev DB, verify via the query above. No application code changes yet.

**Phase 2 — Role-comparison call sites + chip authorization gate**: Decisions 3–4. No new capabilities yet — makes the existing surface admin-aware and closes the chip gap.

**Phase 3 — Admin time-off approve/deny**: Decision 5. Depends on Phase 1's UPDATE policy and Phase 2's admin plumbing.

**Phase 4 — New RichCard kinds + wiring**: Decision 6. Mechanical, checked by the `never`-exhaustiveness switch.

**Phase 5 — Matching-tolerance rework**: Decision 8. Isolated — no new intents added here, only the matching mechanism for existing ones. Verify against every cataloged failing phrase plus a regression pass on every existing passing phrase.

**Phase 6 — New intents/chips**: The remaining 6 from Decision 7 (time-off ones landed in Phase 3), built using Phase 5's scoring mechanism from the start.

**Phase 7 — UI defense-in-depth + full verification pass**: Decision 9's client-side filter; end-to-end verification across all three roles per the acceptance criteria below.

---

## Acceptance criteria

**Role model**
- Exactly 4 `admin` rows (the listed emails), 0 `staff` rows remaining.
- `protect_profile_role` still blocks client self-promotion.
- Admin can: view `/staff`, see the staff nav link, get `ADMIN_MENU` chips, approve/deny a seeded pending time-off row (verified via direct SQL).
- Staff cannot approve/deny time-off (rejected at both app and RLS layers).
- Client cannot reach `/staff`, never sees a staff/admin chip label in any response, and staff-only trigger phrases return the fallback reply.

**Capability expansion**
- All 4 cataloged failing phrases now route correctly.
- Every existing intent's documented trigger phrases still match after the Phase 5 rework (no silent regressions).
- `tsc --noEmit` passes with the widened `RichCard` union and exhaustive `chat-cards.tsx` switch (7 kinds).
- Each of the 8 new intents/chips is reachable via chip and via natural language, correctly role-gated, correct card kind.
- `CHIP_ROLES` has an entry for every `ChipId` (compiler-enforced); `route.ts` rejects a disallowed chip call independent of the handler's own check.

**Process**
- This plan approved before Codex implementation begins.
- Full task artifact set (investigation/plan/review/verification/final-report) completed per this project's Standard documentation level.

Not implemented yet — stopping here for approval on the nine decisions above.
