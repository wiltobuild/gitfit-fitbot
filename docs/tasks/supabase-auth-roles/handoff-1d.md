# Codex Handoff: supabase-auth-roles — Phase 1d

## Approved plan reference

docs/tasks/supabase-auth-roles/plan.md → Phase 1d.

## Exact scope for this handoff

A throwaway staff-only verification fixture: `app/api/staff-ping/route.ts`
(`requireRoleOrThrow`) and `app/staff/page.tsx` (`requireRoleOrRedirect`),
explicitly labeled as a Phase 1 fixture for later phases to replace.

## Instructions given to Codex

See `codex-phase1d-prompt.txt` (session scratchpad) — summarized: GET
route returning `{ ok, message, user }` for staff / 403 for anyone else;
a staff-only page rendering the signed-in user's email and a note that
this is a Phase 1 fixture.

## Constraints

- Stay inside `app/api/staff-ping/`, `app/staff/`.
- Do not modify `lib/auth/session.ts`, `proxy.ts`, or any existing page.
- Do not install new dependencies.

## Result

- Exit status: success.
- Files changed: `app/api/staff-ping/route.ts`, `app/staff/page.tsx`.
- `npm run lint` / `npm run build`: both passed.
- Deviations from plan: none from Codex's own pass. Live verification
  (promoting a test user to `staff` via direct SQL, simulating the
  dashboard-provisioning workflow) surfaced a real bug in 0001's
  `protect_profile_role()` trigger — it only exempted
  `auth.role() = 'service_role'`, which Supabase Studio's Table Editor
  never sets (it connects as the `postgres` superuser directly). Fixed via
  a new migration, `0002_fix_profile_role_trigger_dashboard_bypass.sql`,
  rather than editing 0001 in place, to keep the applied-migration history
  append-only. Recorded in the Phase 1d commit message.
