# GitFit — Demo build

Demo mode ships in this repo (`wiltobuild/gitfit-fitbot`) behind a single env
flag, `NEXT_PUBLIC_DEMO_MODE`. Set it to `true` on a deployment and the app runs
the full product against the shared Supabase project, plus a few changes that
make it walk-up friendly:

1. **The sign-in page is prefilled** with the demo Admin credentials on every
   visit.
2. **One-click quick-login buttons** sit under the sign-in form — a highlighted
   **Dev** all-access login plus **Admin / Staff / Member** role logins — so a
   viewer can jump straight in without typing anything.

Everything else — schedule, class booking, retention, outreach, time-off,
Fitbot — is the real app with real seeded data.

## The Dev login vs the role logins

GitFit routes by role, and the surfaces genuinely don't overlap:

| Role   | Lands on            | Exclusive surfaces                                              |
| ------ | ------------------- | ------------------------------------------------------------- |
| Member | `/dashboard` (client) | `/appointments` class booking (admins/staff are redirected out) |
| Staff  | `/staff` console    | trainer schedule, "my requests" submitter side, `role==='staff'` code paths |
| Admin  | `/dashboard` (admin) | time-off approval, retention launch as admin, studio-wide stats |

- **Dev** — an all-access view. Every `requireRole*` gate is waived, so one
  session can open **every page and every Fitbot shortcut**: admin dashboard,
  `/dashboard?view=client` (member render), `/appointments`, `/staff`,
  `/retention`, `/chat`. The nav exposes all of them. Use this to see the whole
  app quickly.
- **Admin / Staff / Member** — sign in as that exact persona, gates intact, to
  see the app precisely as that user experiences it.

### How Dev works (no schema change)

"dev" is **not** a Supabase role. The Dev button authenticates as the **admin**
account (so row-level security grants full data access) and additionally sets a
short-lived `httpOnly` cookie, `gitfit_demo_dev`. `lib/auth/session.ts` reads
that cookie and, only when `NEXT_PUBLIC_DEMO_MODE=true`, returns
`{ role: "admin", dev: true }`; `requireRoleOrRedirect` / `requireRoleOrThrow`
return early for any `dev` session, and the Fitbot router/chip guards do the
same. Every non-dev sign-in and `signOut` clears the cookie, so all-access never
leaks into an ordinary login. No migration, no RLS change, no extra Supabase
account.

Because the underlying user is the admin account (no `members` row), client-only
pages render with no personal membership context — e.g. `/appointments` shows
"Tier: Member" and a 0 booking count — but they are fully interactive (you can
reserve and cancel classes as Dev).

## Demo accounts

All use password `Welcome!` (seeded accounts on the shared project).

| Button | Email                         | Underlying role |
| ------ | ----------------------------- | --------------- |
| Dev    | `wil.sheppard@pursuit.org`    | admin + all-access bypass |
| Admin  | `wil.sheppard@pursuit.org`    | admin |
| Staff  | `sofia.martinez@gitfit.demo`  | staff |
| Member | `casimir.hilpert@gitfit.demo` | client |

## What changed from upstream

| File | Change |
| ---- | ------ |
| `lib/demo/accounts.ts` | **new** — demo-mode flag, per-role account config (env-overridable), `DEV_COOKIE` |
| `lib/auth/session.ts` | `SessionUser.dev` flag; `getSession` reads the dev cookie in demo mode; `requireRole*` waive gates for `dev` |
| `app/actions/auth.ts` | **new** `signInAsDemo(role)` Server Action; sets/clears the dev cookie; `signIn` + `signOut` clear it |
| `app/sign-in/demo-quick-access.tsx` | **new** — the Dev block + the three role buttons |
| `app/sign-in/sign-in-form.tsx` | accepts a `prefill` prop → `defaultValue` on email/password |
| `app/sign-in/page.tsx` | passes prefill + renders quick-access when demo mode is on; renders `?error=` |
| `app/dashboard/page.tsx` | honours `?view=client` for a `dev` session (member-dashboard render) |
| `app/components/site-nav.tsx` / `nav-links.tsx` | dev session gets a nav group linking every surface |
| `lib/chatbot/chips.ts` / `router.ts`, `app/api/chat/route.ts` | `dev` sessions pass every role/chip guard |
| `app/page.tsx` | landing CTAs point at `/sign-in` instead of `/sign-up` in demo mode |
| `app/globals.css` | styles for `.demo-quick-access` and the dev button |

Every change is gated behind `NEXT_PUBLIC_DEMO_MODE=true` — with it unset the
app behaves exactly like upstream, so this fork can be kept in sync or the
changes upstreamed.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev -- -p 3001
```

`.env.local` needs:

```
NEXT_PUBLIC_SUPABASE_URL=https://eranyjhyplfebfgjywmc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_DEMO_MODE=true
```

The `DEMO_*` account overrides are optional — the defaults in
`lib/demo/accounts.ts` already point at the accounts in the table above, and
`DEMO_DEV_EMAIL` defaults to `DEMO_ADMIN_EMAIL`.

## Turn demo mode on for the live deployment

The Vercel project (`gitfit`, team `pursuit6`, serving
`https://gitfit-pursuit6.vercel.app`) already has the Supabase env vars. To make
it the demo, add one Production env var and redeploy:

1. Vercel → project **gitfit** → **Settings → Environment Variables**.
2. Add `NEXT_PUBLIC_DEMO_MODE` = `true`, environment **Production** (and
   **Preview** if you want branch previews in demo mode too).
3. **Deployments** → latest Production → **Redeploy** (or just push to `main`).

To take demo mode back off, delete that variable and redeploy — no code change.
The Supabase redirect URL for the password-reset flow
(`https://gitfit-pursuit6.vercel.app/reset-password`) is already configured for
this deployment.
