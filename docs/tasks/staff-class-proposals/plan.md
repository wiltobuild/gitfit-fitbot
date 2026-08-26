# Staff-proposed classes, pending admin approval

## Context

Today only admins can create classes (`app/api/staff/classes/create/route.ts` is
`admin`-only), and a created class is live to members immediately — `classes`
has no status column and the member appointments query
(`app/api/appointments/classes/route.ts`) applies no status filter.

The ask: let a trainer (staff) propose a new class themselves. It should sit in
a pending state, an admin reviews and approves/denies it, and only on approval
does it become a real class — visible live to members, same as today.

The codebase already has this exact shape built twice: `time_off_requests` and
`class_change_requests` (trainer submits → manager resolves, `pending` /
`approved` / `denied`, `reviewed_by`/`reviewed_at`, realtime-pushed to both
sides). This plan adds a third: `class_creation_requests`, using a **staging
table** rather than a `status` column on `classes` itself. That keeps a
proposal completely invisible to members and to the existing `classes`
RLS/query surface until an admin approves it — no changes needed to
`classes` RLS, the member appointments query, or its existing realtime
listener (`app/appointments/appointments-experience.tsx:37-55` already
refetches on *any* `classes` change, so an approval-time insert shows up live
for free).

## Data model

New migration `supabase/migrations/0026_class_creation_requests.sql`, mirroring
`0020_console_vision_foundations.sql`'s `class_change_requests` table:

```sql
create table public.class_creation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instructor_member_id uuid not null references public.members(id),
  name text not null,
  type text not null,
  class_date date not null,
  start_time time not null,
  duration_minutes int not null,
  capacity int not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_class_id text references public.classes(id)
);

alter table public.class_creation_requests enable row level security;
```

RLS policies (same three-policy shape as `class_change_requests`):
- `select_own_or_admin`: `user_id = auth.uid() or is_admin(auth.uid())`
- `insert_own`: `user_id = auth.uid() and is_staff(auth.uid()) and exists (select 1 from members m where m.id = instructor_member_id and m.auth_user_id = auth.uid())` — a trainer can only file a proposal under their own member identity, mirroring how `class_change_requests_insert_own_class` checks class ownership.
- `update_admin`: admin only, for resolving.

Second migration `0027_realtime_class_creation_requests.sql`: `alter
publication supabase_realtime add table public.class_creation_requests;`
(mirrors `0025_realtime_classes.sql` exactly).

No changes to `classes` table, its RLS, or `0022_class_management.sql`.

## Backend

**`lib/class-creation-requests/queries.ts`** (mirrors
`lib/class-changes/queries.ts`):
- `listOwnClassCreationRequests(supabase, userId)`
- `listPendingClassCreationRequests(supabase)`
- `submitClassCreationRequest(supabase, { userId, instructorMemberId, name, type, classDate, startTime, durationMinutes, capacity, reason })`
- `resolveClassCreationRequest(supabase, { requestId, decision, reviewerId })`:
  - `denied`: same conditional update as `resolveClassChangeRequest` (`.eq("status", "pending")`, check affected rows) — no side effect.
  - `approved`: first do the same conditional `.eq("status", "pending")` update to flip `status: "approved"` — this is the concurrency guard (only one caller wins the race on a double-click/double-approve). Only the caller that wins then calls the existing `createClass()` from `lib/classes/queries.ts` with the request's fields, and does a second update setting `created_class_id`. If `createClass()` throws after the status flip, the request is left `approved` without a `created_class_id` — acceptable edge case (admin can see and could re-approve is not needed; a future step could add a manual retry but that's out of scope here since `createClass` failing is already a generic 500 case elsewhere in this codebase).

**`lib/class-creation-requests/validate.ts`**: `parseClassCreationInput`, mirrors
`lib/classes/validate.ts` minus `instructorMemberId`/`instructorName` (those
are resolved server-side from the caller's session, not trusted from the
client body).

**Routes**, mirroring `app/api/staff/class-changes/{submit,resolve}`:
- `app/api/staff/class-creation-requests/submit/route.ts` — role `["staff", "admin"]`. Resolves the caller's own member row via `getMemberForUser` (same helper `app/staff/page.tsx:229` already uses) to get `instructor_member_id`; 403s with a clear message if the caller has no linked instructor member (matches how the trainer console already gates `isLinkedInstructor`).
- `app/api/staff/class-creation-requests/resolve/route.ts` — role `admin`. Same shape as the class-changes resolve route.

## UI

- **`app/staff/propose-class.tsx`** (new, client component): a form with the
  same fields as `ClassForm` in `app/staff/live-register.tsx` (name, type via
  the same datalist, date, start time, duration, capacity) plus an optional
  "Notes for your manager" text input (same pattern as `reason` in
  `app/staff/request-time-off.tsx`). Posts to the submit route, shows a
  confirmation, `router.refresh()`.
- **`app/staff/class-creation-status.tsx`** (new): mirrors
  `app/staff/class-change-status.tsx` — trainer's own proposals with a
  pending/approved/denied badge.
- **`app/staff/class-creation-inbox.tsx`** (new): mirrors
  `app/staff/class-change-inbox.tsx` — manager-side list of pending proposals
  (requester name, proposed name/type/date/time/capacity, optional note) with
  Approve/Deny buttons calling the resolve route.

**`app/staff/page.tsx` wiring:**
- Manager branch: fetch `listPendingClassCreationRequests` + join `profiles`
  for requester names (same pattern as the existing
  `pendingClassChangeRequests` block, lines 114-136). Add
  `<RealtimeRefresh table="class_creation_requests" />` and render
  `<ClassCreationInbox>` alongside `<ClassChangeInbox>` in the existing
  `staff-lower-grid` (line 286). Add a pending-count chip to the
  `staff-ops-signals` banner (line 275-279), same style as the existing
  swap/cancel signal.
- Trainer branch (`isLinkedInstructor`, lines 234-266): fetch
  `listOwnClassCreationRequests(supabase, user.id)`. Add
  `<RealtimeRefresh table="class_creation_requests" filter={`user_id=eq.${user.id}`} />`
  next to the existing filtered refreshes (line 294-295). Render
  `<ProposeClass />` and `<ClassCreationStatus>` in the trainer side stack near
  `<MySchedule>` / `<ClassChangeStatus>` (lines 297-309).

## What does NOT change

- `classes` table, its RLS, `createClass`/`updateClass`/`deleteClass`.
- Member appointments query and its realtime listener — approval simply
  inserts a row into `classes`, which the existing unfiltered
  `postgres_changes` subscription in `appointments-experience.tsx` already
  picks up and refetches live.
- `LiveRegister` (admin's own direct class creation stays as-is, unapproved
  and untouched).

## Verification

1. `npm run build` and `npx tsc --noEmit` pass.
2. As a trainer: submit a proposal via the new form, confirm it shows up under
   "My proposals" as pending, confirm it does **not** appear on the member
   `/appointments` page or in the admin's `LiveRegister` "today" list.
3. As an admin: confirm the proposal appears in the new inbox with the
   trainer's name and class details; deny one and confirm it disappears from
   the inbox and shows `denied` on the trainer's side (realtime, no manual
   reload on either open tab).
4. Approve another proposal; confirm it now appears in `LiveRegister`, and —
   with a member's `/appointments` tab open in a second browser/session —
   confirm the new class appears there live without a reload, and is
   bookable.
5. Try submitting as a staff user with no linked instructor member (if one
   exists in seed data) and confirm a clear 403, matching the existing
   `class_change_requests` ownership-check error style.
