# Final report — Staff-proposed classes, pending admin approval

## What changed

**Data model** (new, nothing existing altered):
- `supabase/migrations/0026_class_creation_requests.sql` — `class_creation_requests` staging table + RLS (select own-or-admin, insert own-instructor-identity-only, update admin-only).
- `supabase/migrations/0027_realtime_class_creation_requests.sql` — adds the table to the `supabase_realtime` publication.

**Backend:**
- `lib/class-creation-requests/queries.ts` — list own / list pending / submit / resolve. Resolving `approved` reuses the existing `createClass()` (`lib/classes/queries.ts`) so an approved proposal becomes a real class through the same path an admin's own class creation already uses.
- `lib/class-creation-requests/validate.ts` — input validation, mirrors `lib/classes/validate.ts`.
- `app/api/staff/class-creation-requests/submit/route.ts` (staff/admin) and `.../resolve/route.ts` (admin only).

**UI:**
- `app/staff/propose-class.tsx` — trainer-facing proposal form.
- `app/staff/class-creation-status.tsx` — trainer's own proposal list with status badges.
- `app/staff/class-creation-inbox.tsx` — manager-facing approve/deny inbox.
- `app/staff/page.tsx` — wired both branches: realtime subscriptions, data fetching, and the three new components placed alongside their `class_change_requests` counterparts; added a pending-proposal count to the manager ops-signals banner.

## What did NOT change

`classes` table/RLS, `createClass`/`updateClass`/`deleteClass`, the member
appointments query, and its realtime listener — approval simply inserts into
`classes`, which the member page already picks up live (see `brief.md` for
why this was the deciding factor for a staging-table design over a status
column on `classes`).

## Verified

Static checks (typecheck, lint, build) all pass; see `verification.md`.
Live end-to-end verification (submit → approve/deny → live member visibility)
was **not** possible in this environment — no local Supabase/Docker, no test
accounts. See `verification.md` for the exact scenarios still to run before
this ships, and the `docs/build-doc.md` note doesn't apply here (this feature
doesn't touch the tool-manifest/JWT/error-shape contract, so no extra
approval gate is needed).

## Remaining work before merge

1. Apply the two new migrations to a dev/staging Supabase project.
2. Walk through the 5 scenarios listed in `verification.md` with a real
   trainer + admin account.
3. Decide whether to commit — not yet committed, per instruction to only
   commit when explicitly asked.
