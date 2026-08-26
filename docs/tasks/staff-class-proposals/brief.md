# Brief — Staff-proposed classes, pending admin approval

## Scope

A trainer (staff role) can propose a new class from their own console. The
proposal is not a live class — it sits pending until an admin approves or
denies it. On approval it becomes a real, bookable class, visible live to
members exactly like an admin-created one is today. On denial it is simply
marked denied; nothing is created.

## Acceptance criteria

- A staff user with a linked instructor member can submit a class proposal
  (name, type, date, start time, duration, capacity, optional note) from the
  trainer console.
- The proposal never appears in `classes`, `LiveRegister`, or the member
  `/appointments` page while pending.
- An admin sees pending proposals in a new inbox on the manager console, with
  the requester's name and the proposed class details.
- Approving a proposal creates a real class (same `createClass` path admins
  already use) and it appears live — no manual reload — on both the admin
  Live Register and the member appointments page.
- Denying a proposal leaves no class behind; the trainer sees it marked
  denied without reloading.
- A staff user with no linked instructor member gets a clear error rather
  than a raw 500/403 with no explanation.

## Preflight state

- Classes have no status column; `classes` RLS restricts insert/update/delete
  to admins (`0022_class_management.sql`). No change needed there.
- Member appointments page already refetches on any `classes` realtime event
  (`app/appointments/appointments-experience.tsx:37-55`), unfiltered by
  status — an approval-time insert into `classes` reaches it for free.
- Two existing analogous workflows — `time_off_requests` and
  `class_change_requests` — establish the trainer-submits/manager-resolves
  pattern (`pending`/`approved`/`denied`, `reviewed_by`/`reviewed_at`,
  RLS-scoped, realtime-pushed) this feature reuses directly.

See `plan.md` in this directory for the approved implementation plan.
