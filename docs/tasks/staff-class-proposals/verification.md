# Verification — Staff-proposed classes, pending admin approval

## Automated / static checks (done)

- `npx tsc --noEmit` — clean, no errors.
- `npm run lint` — clean; the 4 warnings present are pre-existing and
  unrelated to this change (img-element and anonymous-default-export
  warnings in files this task never touched).
- `npm run build` — succeeds. New routes confirmed present in the route
  table: `/api/staff/class-creation-requests/submit`,
  `/api/staff/class-creation-requests/resolve`.
- Smoke check against the already-running local dev server (port 3001):
  `GET /staff` returns `307 → /sign-in` (expected — no runtime error,
  auth guard intact).

## Not verified (needs a live Supabase instance + real accounts)

No local Supabase/Docker is available in this environment (`npx supabase
status` fails: `docker: command not found`), so the following from the plan's
verification section could **not** be exercised end-to-end:

1. Applying migrations `0026_class_creation_requests.sql` and
   `0027_realtime_class_creation_requests.sql` against a real database.
2. Submitting a proposal as a trainer and confirming it's invisible to
   members / `LiveRegister` while pending.
3. Approving/denying as an admin and confirming realtime propagation to both
   consoles without a reload.
4. Confirming an approved class appears live on the member `/appointments`
   page and is bookable.
5. The no-linked-instructor 403 path.

**Next step before shipping:** run `supabase db push` (or the project's usual
migration-apply step) against a dev/staging Supabase project, then walk
through the 5 scenarios above with a real trainer and admin account.
