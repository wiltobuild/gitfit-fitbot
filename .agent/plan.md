# Plan

STATUS: ACTIVE
TASK: Fix class capacity/delete bugs — batch 1 of 4 from the full-app audit
(2026-08-24). Closes: (1) capacity can be edited below booked_count with no
check, silently overbooking a class; (2) deleteClass hard-deletes all
bookings via cascade with zero notification/audit trail; (3) deleteClass
also cascades away pending class_change_requests silently.

## Steps

- [x] 1. Reject capacity edits below current booked_count (server-side)
  - Do: In the update path, before writing, fetch the class's current
    booked_count and reject the update with HTTP 400 when the submitted
    capacity is less than it. Enforce in the server layer (API route or
    updateClass), not just client validation. Do not touch the create path.
  - Contract: `POST /api/staff/classes/[classId]/update` — when target
    class has booked_count=B and request capacity < B, respond 400
    `{ error: { message } }` naming the conflict; no row updated. When
    capacity >= B, proceed and respond 200 `{ ok: true }` as today. The
    checking function must return an observable result (not throw a
    generic error that becomes a 500) — e.g. `{ ok: true } | { ok: false,
    code: "capacity_below_booked", bookedCount }`, injectable Supabase
    client so it's testable with a stub. Auth unchanged (401/403). Capacity
    exactly equal to booked_count is allowed. Class-not-found: preserve
    existing behavior, no new failure mode.
  - Done when: test with stub client reporting booked_count=18 and input
    capacity=10 gets a non-OK result with the "below booked" code, and the
    stub records NO update issued to classes. Same with capacity=18 and
    capacity=20 gets OK result and the update IS issued. `npm test` passes.
  - Touches: lib/classes/queries.ts (updateClass),
    app/api/staff/classes/[classId]/update/route.ts.
  - Requirement test: tests/agent_requirements/update-class-capacity-below-booked.test.ts (GREEN)

- [x] 2. Client-side guard + error surfacing on the Edit form (no code
      change needed — cas confirmed submitEdit already correctly surfaces
      the step-1 400 message; no testable seam exists, verified by
      build/lint)
  - Do: Confirm/ensure the staff Edit form surfaces the server's 400
    capacity error to the admin. Server (step 1) remains the enforcement;
    this is UI wiring only, additive if a pre-submit check is added.
  - Contract: none (not behaviour-testable — no RTL/jsdom harness in repo).
    Verify by reading submitEdit in app/staff/live-register.tsx confirms a
    400 with `{ error: { message } }` renders in the form's error state,
    and no client change weakens the server check.
  - Done when: submitEdit surfaces the step 1 400 message in the form error
    area. `npm run build` and `npm run lint` pass.
  - Touches: app/staff/live-register.tsx.
  - Requirement test: N/A (Contract: none — verified by read + build/lint)

- [x] 3. Add a durable class-cancellation audit table (migration)
  - Do: Add supabase/migrations/0024_class_cancellations.sql creating a
    class_cancellations table recording: class identity + denormalized
    label snapshot (class row is deleted right after, so class_id must be
    plain text, NOT a foreign key/cascade), who canceled it, when, and the
    roster booked at cancellation time. Follow promo_events precedent for
    RLS (admin-only select/insert).
  - Contract: none (DDL, not behaviour-testable). Verify by reading the
    migration: class_id is text with no FK/cascade; columns capture class
    name/date/time snapshot, canceled_by uuid references auth.users(id),
    booked_count int not null, roster captured durably (e.g. roster jsonb
    of {userId, name, email}), created_at timestamptz default now(); RLS
    enabled matching promo_events' admin-only pattern; no cascade path that
    lets a classes delete erase these rows.
  - Done when: reviewer confirms via reading the migration that all of the
    above hold.
  - Touches: supabase/migrations/0024_class_cancellations.sql (new).
  - Requirement test: N/A (Contract: none — verified by read)

- [x] 4. Cancellation-logging query helper
  - Do: Add lib/class-cancellations/queries.ts with a function that, given
    a class id and canceling admin's user id, gathers the class's label
    fields and current roster (reuse getClassRoster) and inserts one
    class_cancellations audit row. Pure orchestration over an injected
    Supabase client, testable with a stub.
  - Contract: `logClassCancellation(supabase, { classId, canceledBy })`.
    Reads class row + roster for classId, inserts exactly one row into
    class_cancellations with snapshot label fields, canceled_by, booked_count
    = roster length, and roster identities. Throws on insert error
    (consistent with logPromoEvent).
  - Done when: test with stub client returning a 2-person roster + class
    row asserts exactly one insert into class_cancellations with
    booked_count=2 and roster carrying both users' ids. Test with empty
    roster asserts one insert still issued with booked_count=0 and empty
    roster. `npm test` passes.
  - Touches: lib/class-cancellations/queries.ts (new). Reuses
    lib/classes/roster.ts.
  - Requirement test: tests/agent_requirements/log-class-cancellation.test.ts (GREEN)

- [x] 5. Auto-resolve pending class_change_requests before a class is deleted
  - Do: Add a query helper that, given a class id and reviewer (admin) user
    id, denies every still-pending class_change_requests row for that class
    with a reason noting the class was canceled (overwrite the reason field
    with the cancellation note — accepted default per Chuck, original
    requester reason is not preserved separately).
  - Contract: `denyPendingRequestsForCanceledClass(supabase, { classId,
    reviewerId })`. Updates rows where class_id = classId AND status =
    'pending', setting status='denied', reviewed_by=reviewerId,
    reviewed_at=now(), reason=canceled-class note. Rows already
    approved/denied untouched. Returns number of rows denied (or ids). No
    pending rows -> 0, no error.
  - Done when: test with stub client where 2 pending + 1 already-denied
    request exist for the class asserts the update targets class_id=<id>
    AND status='pending' (excluding the already-denied one), setting
    status=denied with reviewed_by and a canceled-class reason. Test with
    no pending requests asserts helper completes reporting 0, no error.
    `npm test` passes.
  - Touches: lib/class-changes/queries.ts (add function) or new file.
  - Requirement test: tests/agent_requirements/deny-pending-requests-on-cancel.test.ts (GREEN)

- [x] 6. Wire cancellation flow into the delete route (log -> deny -> delete, in order)
  - Do: Change the delete route so before hard-deleting the class it (a)
    writes the cancellation audit row (step 4) and (b) denies pending
    change requests (step 5), then deletes. Roster/pending requests must be
    captured before the delete cascades them away.
  - Contract: `POST /api/staff/classes/[classId]/delete` unchanged request
    shape, auth unchanged. Success: 200 `{ ok: true }`, and as observable
    side effects exactly one class_cancellations row created (pre-delete
    roster/count), all previously-pending class_change_requests for that
    class now denied, classes row (+ bookings via cascade) deleted.
    Ordering: audit-log and deny-requests both execute BEFORE classes
    delete. If audit-log write fails: class is NOT deleted, route responds
    500 `{ error: { message } }`. If deny-requests fails: same, no delete,
    500. Deleting an already-gone class id: existing behavior preserved.
  - Done when: test driving the delete orchestration function with a stub
    client asserts call sequence is read roster/pending requests -> insert
    class_cancellations -> update class_change_requests to denied -> delete
    classes, and that if the class_cancellations insert stub throws, the
    classes delete is NEVER issued. Test asserts successful path issues
    delete exactly once after the audit insert. `npm test` passes; `npm run
    build` passes.
  - Touches: app/api/staff/classes/[classId]/delete/route.ts,
    lib/classes/queries.ts (deleteClass may become orchestration or route
    composes helpers). Reuses steps 4 and 5.
  - Requirement test: tests/agent_requirements/cancel-flow-order.test.ts (GREEN)

- [x] 7. Surface canceled classes in the manager Activity Log
  - Do: Extend the manager Activity Log so canceled classes appear
    alongside resolved time-off requests: load recent class_cancellations
    rows in the staff page's manager branch, pass to ActivityLog, render
    class label, canceler's name, affected member count, timestamp.
    Existing time-off entries continue to render unchanged. No
    member-notification system — display only.
  - Contract: if a pure merge/format helper is extracted (merging N
    time-off entries + M cancellation entries, sorted newest-first, each
    tagged by kind) — that is the testable surface. If no such helper is
    introduced, Contract: none, verify by build + reading the JSX.
  - Done when: if a pure helper exists, test feeds mixed entries and
    asserts correct newest-first ordering with cancellation entries
    carrying class label, canceler, affected count. `npm test` passes.
    Regardless: `npm run build` and `npm run lint` pass, reviewer confirms
    by reading app/staff/page.tsx + activity-log.tsx that a
    class_cancellations row renders with class label, canceler, affected
    count, and time, without breaking existing time-off rendering.
  - Touches: app/staff/page.tsx, app/staff/activity-log.tsx. Possibly a
    small pure helper module.
  - Requirement test: tests/agent_requirements/activity-log-merge.test.ts (GREEN)

## Notes carried from planning
- No existing test harness for DB-backed code (no live DB in CI, no mock
  convention). Testable steps are written to be verified against pure
  orchestration functions with a hand-rolled stub Supabase client.
- Shared-contract approval gate: assessed as not triggered — these are
  internal staff-console routes, not chatbot tool-manifest endpoints; the
  repo pivoted away from the cross-team shared-contract model on
  2026-08-18 (docs/agent/decisions.md). Response shape `{error:{message}}`
  unchanged, only new cases added. User confirmed proceeding without a
  separate sign-off gate.
- Bug 3 reason-column collision: class_change_requests.reason is a single
  column also holding the requester's original reason. Default: overwrite
  with the cancellation note (simplest, no new column). Accepted.
- Out of scope: remediating already-overbooked existing rows; DB-level
  trigger for capacity-vs-booked (app-layer enforcement only, per bug
  report's "don't rely solely on client-side validation" direction).
