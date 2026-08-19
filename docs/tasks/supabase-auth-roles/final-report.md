# Final Report: Supabase auth + client/staff roles (Phase 1)

## What changed

Established the foundation every later phase of the GitFit Suite buildout
depends on:

- **Data**: `supabase/migrations/0001_profiles_and_roles.sql` — a
  `profiles` table (role: `client`/`staff`, defaulting to `client`), RLS
  (self + staff read; role-change blocked for non-staff via a `BEFORE
  UPDATE` trigger, not just RLS), an `is_staff()` `SECURITY DEFINER`
  helper avoiding RLS recursion, and an `auth.users` insert trigger
  auto-creating each new user's profile. `0002_fix_profile_role_trigger_dashboard_bypass.sql`
  fixes a bug found during live verification (see below). Both applied to
  the live Supabase project.
- **Plumbing**: `lib/supabase/{client,server}.ts`, `proxy.ts` (Next.js
  16's `middleware.ts` replacement — session-cookie refresh + a soft UX
  redirect only, explicitly not the security boundary), and
  `lib/auth/session.ts` (`getSession`, `requireUserOrRedirect/OrThrow`,
  `requireRoleOrRedirect/OrThrow`) — the permission-check contract every
  later phase's pages, API routes, and eventual chatbot intents call into.
- **UI**: `/sign-up`, `/sign-in` (Server Actions, no role picker — staff
  accounts are never self-selectable), a sign-out action, and a minimal
  `/dashboard` placeholder.
- **Verification fixture**: `/staff` and `/api/staff-ping`, explicitly
  labeled as throwaway Phase 1 fixtures for later phases (Phase 7: staff
  member lookup, etc.) to replace.

## What was found and fixed mid-task

1. **Email-confirmation redirect bug** (Phase 1c): `signUp()` blindly
   redirected to `/dashboard` even when Supabase's email-confirmation
   setting meant no session was returned, bouncing the user straight back
   to `/sign-in` with no explanation. Found via live browser testing,
   fixed to check `data.session` and show a "check your email" message.
2. **Role-protection trigger gap** (Phase 1d): the plan's approved
   "dashboard-only staff provisioning" (manually flip a row in Supabase
   Studio) would have been blocked by 0001's own trigger — it only
   exempted `auth.role() = 'service_role'` (a PostgREST-set GUC), but
   Studio's Table Editor connects as the `postgres` superuser directly and
   never sets that GUC. Found via live end-to-end promotion testing (not
   just code review), fixed via migration 0002.
3. Themis's review (elevated scrutiny, given this touches auth + the
   JWT/role claim shape) found no must-fix issues and specifically ruled
   out role-escalation paths (client cannot set their own role via RLS,
   INSERT, or a race with the trigger). Two optional items applied
   directly: a log line for the missing-profile-row edge case in
   `getSession()`, and a clarifying comment on why 0002's exemption is
   safe.

## What was verified

All 7 acceptance criteria — see
[verification.md](verification.md) for full detail. Live-tested against
the real Supabase project (not mocked): sign-up → DB row creation →
manual email confirmation (no email provider configured in this dev
environment) → sign-in → session persistence → staff-fixture 403 for a
client-role user → Studio-style promotion → access granted. `npm run lint`
and `npm run build` both pass. `/`, `/chat`, `/appointments` confirmed
unchanged and working.

## What remains open

- Real email delivery/confirmation UX — deferred, no email provider
  configured yet; not required for this phase.
- Staff-promotion UI (in-app admin flow) — deferred to a later phase per
  the approved plan; dashboard-only for now, with RLS already written to
  support an in-app flow without a schema change.
- `SUPABASE_SERVICE_ROLE_KEY` — stored in `.env`, not used by any Phase 1
  code; reserved for that future admin flow.
- Everything downstream in the 12-phase buildout (suite landing page,
  chatbot shell, intent router, schedule/appointments/member-lookup/
  workout-planning/time-off/retention features, LLM integration, visual
  polish) — Phase 1 only lays the auth/roles foundation.

## Commits

Four phase commits on `main`, each independently lint/build-verified:

- `81b873d` — Phase 1a: deps, env docs, SQL migration
- `a9a6403` — Phase 1b: Supabase client/server helpers, proxy.ts, session helper
- `f4428ea` — Phase 1c: sign-up/sign-in/sign-out UI + /dashboard
- `b7223f1` — Phase 1d: staff-only enforcement fixture, live-verified

Plus this final docs/optional-fixes pass, to be committed next.
