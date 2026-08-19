# Verification: supabase-auth-roles (Phase 1)

## Acceptance criteria vs. evidence

1. Sign-up creates a Supabase auth user + `profiles` row with
   `role='client'`; sign-in works; session persists — **VERIFIED**. Live
   browser test: signed up `phase1-test2@gitfit.dev`, confirmed via direct
   DB query that `auth.users` and `public.profiles` (role='client') rows
   were both created. Manually confirmed the email (no email delivery in
   this dev environment), signed in, landed on `/dashboard` showing
   "Signed in as phase1-test2@gitfit.dev (client)".
2. A signed-in `client`-role user hitting the staff-only fixture gets
   403 (API) / redirect (page) — **VERIFIED**. `/staff` redirected the
   client-role session back to `/dashboard`; `fetch('/api/staff-ping')`
   returned `{status: 403}`.
3. Session persists across navigation and a hard refresh — **VERIFIED**.
   Forced navigation to `/dashboard` after sign-in re-rendered the
   authenticated view without re-prompting.
4. No secrets committed; `.env.example` documents empty-valued vars only —
   **VERIFIED**. `git status` confirms `.env` untracked throughout; each
   commit's diff reviewed before staging; `.env.example` contains only
   empty-valued `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`.
5. `npm run lint` / `npm run build` both pass — **VERIFIED**, re-run after
   every phase (1a–1d) and again after the final optional-fix pass. 0
   lint errors (1 pre-existing unrelated warning); build succeeds, all
   routes compile, `Proxy (Middleware)` correctly recognized.
6. `/`, `/chat`, `/appointments` still load — **VERIFIED**. Screenshotted
   all three live in the browser after Phase 1d; unchanged, no console
   errors beyond an expected 403 from our own manual staff-ping test call.
7. Manually promoting a test user's `profiles.role` to `staff` grants
   fixture access on the next request — **VERIFIED**. Direct SQL promotion
   (simulating the Supabase Studio dashboard-edit workflow) initially
   failed due to a trigger bug (see Phase 1d commit/handoff-1d.md); fixed
   via migration 0002; re-tested successfully — `/staff` rendered "Staff
   Zone", `/api/staff-ping` returned `{ok: true, message: "pong", user}`
   for the same session with no re-login.

## Commands run

```
npm run lint    # 0 errors, 1 pre-existing warning, every phase
npm run build   # success, every phase — 14 routes incl. /dashboard, /staff, /api/staff-ping

# Migration application (scratch Node script against DATABASE_URL, since
# psql isn't installed in this environment):
node run.js supabase/migrations/0001_profiles_and_roles.sql
node run.js supabase/migrations/0002_fix_profile_role_trigger_dashboard_bypass.sql

# Direct DB checks used during live verification:
select id, email, confirmed_at from auth.users order by created_at desc limit 5;
select id, role, created_at from public.profiles order by created_at desc limit 5;
update auth.users set email_confirmed_at = now() where email = $1;   -- dev-only, no email delivery configured
update public.profiles set role = 'staff' where id = (...);          -- simulates Studio dashboard edit
```

Browser: real sign-up, sign-in, `/dashboard`, `/staff`, `/api/staff-ping`
(via `fetch`), `/`, `/chat`, `/appointments` all exercised live via the
in-app browser tool, not just code-reviewed.

## Not verified

- Password reset / email verification UX beyond the "check your email"
  message — explicitly out of scope for Phase 1 per the brief.
- Real email delivery (Supabase's own confirmation email) — this dev
  environment has no configured email provider; confirmation was done via
  direct DB update instead. Worth a real end-to-end check once the project
  has a real email setup, but that's outside Phase 1's scope.
- Concurrent-request behavior of the pre-existing
  `lib/appointments-store.ts` shared-mutable-state issue — explicitly out
  of scope, flagged only for Phase 6.

## Verdict

Ready to commit (already committed incrementally per phase, per the
project's small-commits-per-phase git strategy). Phase 1 is complete and
verified end-to-end against the real Supabase project.
