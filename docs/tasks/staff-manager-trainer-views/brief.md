# Brief: Manager/Trainer view split + request approval (Phase 0 + core of Phase B)

## Scope

`/staff` (`app/staff/page.tsx`) currently renders one identical page for
every `staff`/`admin` account — no Manager/Trainer distinction exists.
This task splits it into two views by `session.role`, and ships a real
request-approval workflow as part of the same pass, since its only
schema dependency (an admin-only UPDATE policy on `time_off_requests`)
already exists from `0014_admin_role.sql` — no new migration needed for
this piece.

**No new Supabase migration in this task.** Everything here reads/writes
columns and policies that already exist.

### Manager view (`role === "admin"`)
1. **Studio register** — today's classes, all trainers, unscoped. Same
   panel/markup that exists today, unchanged.
2. **Requests inbox** (new) — every `time_off_requests` row with
   `status = 'pending'`, newest first. Approve/Deny buttons per row,
   calling a new API route that does the UPDATE (guarded server-side by
   the existing `time_off_requests_update_admin` RLS policy — the route
   is a thin wrapper, RLS is the real gate).
3. Member directory, Ask FitBot — unchanged, shared with Trainer view.

### Trainer view (`role === "staff"`)
1. **My requests** (new) — the signed-in trainer's own
   `time_off_requests` rows (`user_id = auth.uid()`, filtered
   application-side — RLS doesn't yet narrow SELECT, that's a separate
   follow-up, see Out of scope), showing `status` per row. This *is* the
   notification surface per the 2026-08-20 product-doc decision: no
   separate notifications table, status-on-refresh is the mechanism.
2. Member directory, Ask FitBot — unchanged, shared with Manager view.
3. **No "My schedule" panel in this pass** — `classes.instructor` is a
   plain text string, not linked to `profiles` (no `trainer_id` column
   exists yet), so there is no real data to scope a trainer's register
   to. Building a fake scope (e.g. string-matching `instructor` to the
   signed-in user's name) would be a hack the team didn't ask for.
   Deferred to Phase C.

## Out of scope (explicitly, for this task)

- `classes.trainer_id`/`promoted`, schedule management, promote action —
  Phase C, needs its own migration.
- `time_off_requests.type` (shift-swap support) — small follow-up
  migration, not blocking this task's approve/deny flow for `time_off`
  rows.
- Narrowing `time_off_requests` SELECT to own-rows-for-trainers via RLS —
  today any staff/admin can already SELECT every row; this task's
  Trainer "My requests" panel filters application-side, which is a UI
  narrowing, not a security boundary. Real RLS narrowing is a follow-up
  migration (part of Phase B's original schema scope), tracked
  separately, not silently treated as done by this task.
- Cert fields, `promo_events` — Phase D.
- At-risk visibility, activity feed — Phase E, not yet investigated.
- Any change to `app/staff/fitbot-tiles.tsx`, `/dashboard`, `/chat`, or
  any chatbot component — chat is a teammate's product surface.
- New Supabase migrations of any kind.

## Acceptance criteria

1. Signing in as `staff` shows the Trainer view (register removed, "My
   requests" + shared panels); signing in as `admin` shows the Manager
   view (existing register + new "Requests inbox" + shared panels).
2. A `client` account is still redirected away from `/staff` entirely
   (existing `requireRoleOrRedirect(["staff","admin"])` behavior,
   unchanged).
3. Manager can approve or deny a pending time-off request; the request
   disappears from the inbox (no longer `pending`) and reappears with
   the new status in the requesting trainer's "My requests" panel on
   their next load.
4. A `staff` (non-admin) account attempting the approve/deny API route
   directly gets rejected by RLS, not just hidden by the UI (server-side
   enforcement, not conditional rendering only).
5. `npm run lint` and `npm run build` clean.
6. Verified live in the browser: both views, at least one real
   approve/deny round trip against Supabase.

## Preflight state

- Branch: `operations-dashboard`.
- Current file: `app/staff/page.tsx` (53 lines, single view for
  staff+admin), `app/staff/member-search.tsx`, `app/staff/fitbot-tiles.tsx`
  (untouched by this task).
- `time_off_requests` schema: `id, user_id, requested_date, reason,
  status, created_at, reviewed_by, reviewed_at` (`0008`). `status`
  default `pending`. UPDATE policy `time_off_requests_update_admin`
  (`0014`) already allows `is_admin(auth.uid())` to update any row —
  this task is the first thing to actually use it.
- No existing API route resolves a request's status; the chatbot's
  `time-off.ts` intent only handles submission (INSERT).
