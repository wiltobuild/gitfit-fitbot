# Plan

STATUS: ACTIVE
TASK: Real-time updates across the platform when a member books a class.
Member (/appointments), staff trainer (My Schedule), and admin (Live
Register) should all see booking/cancellation changes live, without a
manual reload. Dashboards explicitly out of scope per user decision.

## Steps

- [x] 1. Add classes to the Supabase Realtime publication
  - Do: New migration supabase/migrations/0025_realtime_classes.sql:
    `alter publication supabase_realtime add table public.classes;`
    mirroring 0021_realtime_requests.sql's header-comment style. Note
    classes RLS is `using (true)` for all authenticated (no new access
    surface) and booked_count is trigger-maintained (booking/cancel
    changes surface as UPDATEs here).
  - Contract: none (DDL, no live-DB harness). Verify: file exists, highest
    migration number, contains exactly the one alter publication
    statement (public.classes, supabase_realtime), no other DDL. npm run
    build passes.
  - Touches: supabase/migrations/0025_realtime_classes.sql (new).

- [ ] 2. Wire live refresh into the Admin Live Register (unfiltered)
  - Do: In app/staff/page.tsx manager branch (isManager block, alongside
    existing RealtimeRefresh time_off_requests/class_change_requests
    instances), render `<RealtimeRefresh table="classes" />` (no filter).
  - Contract: manager-branch render includes exactly one RealtimeRefresh
    with table="classes", no filter prop, inside isManager true-branch
    only (not trainer/else branch).
  - Done when: source check confirms placement + shape; npm run build and
    npm run lint pass with no new warnings. Not unit-testable (no
    jsdom/browser harness) — source-shape + build/lint verified.
  - Touches: app/staff/page.tsx (manager branch only).
  - Depends on: step 1 (inert without it, but can land in either order).

- [ ] 3. Thread the trainer's member id into the render scope
  - Do: In app/staff/page.tsx trainer (isLinkedInstructor/else) branch,
    make the instructor's own members.id (instructorMember.id) available
    where step 4's RealtimeRefresh filter needs it. If already trivially
    in scope, confirm that in the handoff (step collapses into step 4).
  - Contract: none (internal data threading, no standalone observable
    surface until step 4). Verify: id referenceable in trainer-branch JSX
    scope (source check); npm run build/lint pass.
  - Touches: app/staff/page.tsx (trainer branch only).

- [ ] 4. Wire live refresh into Trainer My Schedule (filtered by instructor)
  - Do: In app/staff/page.tsx trainer branch, near existing
    class_change_requests filtered RealtimeRefresh, render
    `<RealtimeRefresh table="classes" filter={`instructor_member_id=eq.${instructorMemberId}`} />`
    using step 3's id. Filter column MUST be instructor_member_id (FK
    from 0019), not the free-text instructor display column. Classes with
    null instructor_member_id (unbackfilled) won't push to that trainer —
    accepted, pre-existing data gap, out of scope to fix.
  - Contract: trainer-branch render includes exactly one RealtimeRefresh
    with table="classes" and filter resolving to
    instructor_member_id=eq.<trainer's members.id>; absent from manager
    and non-instructor staff branches.
  - Done when: source check confirms column/value/placement; npm run
    build and npm run lint pass with no new warnings. Not unit-testable —
    source-shape + build/lint verified, same as step 2.
  - Touches: app/staff/page.tsx (trainer branch only).
  - Depends on: step 1, step 3.

- [ ] 5. Make Member appointments schedule reflect live capacity
  - Do: AppointmentsExperience is a client component that fetches classes
    via GET /api/appointments/classes into local useState — it does NOT
    read server-component props for its schedule, so a bare
    RealtimeRefresh + router.refresh() would NOT update the visible
    schedule (only the thin bookedThisWeek server fetch in page.tsx).
    Instead: on any Realtime change to classes (unfiltered — whole-week
    capacity is relevant), refetch /api/appointments/classes and update
    the classes state, preserving the current user's own optimistic
    patch (final state after refetch must equal server truth). Reuse the
    setAuth-then-subscribe sequence documented in realtime-refresh.tsx —
    either generalize RealtimeRefresh with an onChange callback variant,
    or inline a small subscription in AppointmentsExperience. No filter.
  - Contract: after mount, AppointmentsExperience holds an active
    Realtime subscription on classes; a change event triggers a refetch
    of /api/appointments/classes and updates classes state. No session ->
    subscription doesn't open, page still renders, no throw. Failed
    refetch -> existing error/actionError path used, no crash, no blank
    list. Unmount -> channel removed, no leak.
  - Done when: source check confirms a classes Realtime subscription
    triggers a refetch of /api/appointments/classes (not merely
    router.refresh()) and removes the channel on cleanup. npm run build
    and npm run lint pass. MANUAL LIVE-CHECK (not automatable, no
    browser/jsdom/live-DB harness): open /appointments in two
    authenticated sessions on the same class; reserve in session A;
    confirm session B's spots-open/booked count updates within a few
    seconds without reload. Document result in journal.
  - Touches: app/appointments/appointments-experience.tsx (subscription +
    refetch); possibly app/components/realtime-refresh.tsx if generalized.
    No change to app/api/appointments/classes/route.ts.
  - Depends on: step 1.

## Notes carried from planning
- Steps 2 and 4 are pure mechanical wiring, fully testable by source-shape
  + build/lint (no live subscription behavior to unit test).
- Step 5 is the one substantive design decision: /appointments is fully
  client-driven, so RealtimeRefresh's router.refresh() pattern silently
  does nothing there — a "looks wired, isn't working" trap avoided by
  refetching the client API on a realtime event instead.
- No shared-contract approval gate triggered (no tool-manifest/JWT/error-
  shape change). classes RLS already using(true) for all authenticated —
  adding it to the realtime publication creates no new read access.
- GUARDRAILS cross-check: npm run build is authoritative typecheck; ignore
  tsc --noEmit failures confined to .next/types/, never edit .next/.
