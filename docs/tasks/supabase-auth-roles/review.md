# Review: Supabase auth + client/staff roles (Themis)

Elevated-scrutiny review (touches authentication + JWT/role claim shape,
per the project's shared-contract decisions.md gate).

Verified live: `npm run lint` (0 errors, 1 pre-existing unrelated warning
in `postcss.config.mjs`) and `npm run build` both pass; all routes
including `/`, `/chat`, `/appointments`, `/dashboard`, `/staff`,
`/api/staff-ping` compile. `.env` untracked; `.env.example` has only
empty-valued placeholders; `SUPABASE_SERVICE_ROLE_KEY` referenced only in
docs, never in application code.

## Must-fix

None. Specifically hunted for a role-escalation path and found none:

- `protect_profile_role()` is a `BEFORE UPDATE` trigger, which runs and can
  raise before RLS's `WITH CHECK` evaluates the final row — a client
  attempting to set their own `role='staff'` is blocked regardless of what
  RLS alone would allow. The plan's reasoning ("RLS WITH CHECK can't
  compare OLD.role to NEW.role") is correct; the trigger is load-bearing,
  not redundant.
- No INSERT policy exists for `authenticated` on `profiles` — only the
  `SECURITY DEFINER` `handle_new_user()` trigger can insert, hardcoded to
  `role='client'`. No race-to-insert-as-staff path.
- `is_staff()` is `SECURITY DEFINER stable`, correctly avoiding RLS
  self-recursion.
- 0002's `session_user = 'postgres'` exemption is correctly scoped:
  ordinary PostgREST requests never connect as literal `postgres`; only
  direct-superuser connections (Studio) do, and those already bypass RLS
  entirely by default. No new escalation surface.
- `requireRoleOrThrow`/`requireRoleOrRedirect` both call
  `requireUserOrThrow`/`requireUserOrRedirect` first — unauthenticated
  requests correctly hit the "unauthenticated" path before any role
  comparison.
- `proxy.ts`'s cookie-refresh `response` reassignment inside `setAll` is
  correctly read by both the redirect branch and the final return — no
  stale-reference bug.
- `signUp()`'s email-confirmation fix correctly checks `data.session` (not
  `data.user`, which Supabase populates regardless).

## Optional (applied)

1. `getSession()`'s missing-profile fallback now logs an error — a missing
   row usually means the signup trigger failed, not a benign race; it
   shouldn't be silently invisible. Applied directly (small, non-behavioral
   change to session.ts).
2. 0002's migration comment now explicitly states *why* the
   `session_user = 'postgres'` exemption is safe (superusers already bypass
   RLS by default), not just why the bug happened. Applied directly.
3. Missing handoff docs for 1b/1c/1d — addressed by this task's docs pass
   (handoff-1b.md, handoff-1c.md, handoff-1d.md added alongside this file).

## Scope drift

None relative to the approved plan. Phase 1a's documentation-only touches
to `docs/agent/decisions.md`/`project-profile.md` record pre-existing
approvals (architecture pivot, Supabase dependency), not code scope
expansion. All four phases map cleanly to the plan's 1a–1d breakdown.

## Verdict

Ready for verification. No must-fix defects; no secrets committed;
lint/build green.
