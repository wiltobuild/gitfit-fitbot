# GitFit — Demo build

This is a demo-configured fork of `wiltobuild/gitfit-fitbot`. It runs the full
application against the existing shared Supabase project, with two changes that
make it walk-up friendly:

1. **The sign-in page is prefilled** with the demo Admin credentials on every
   visit.
2. **One-click role buttons** ("Sign in as Admin / Staff / Member") sit under
   the sign-in form so a viewer can jump straight into any of the three role
   experiences without typing anything.

Everything else — schedule, class booking, retention, outreach, time-off,
Fitbot — is the real app with real seeded data.

## Why three buttons instead of one login

GitFit routes by role, and the surfaces genuinely don't overlap:

| Role   | Lands on            | Exclusive surfaces                                              |
| ------ | ------------------- | ------------------------------------------------------------- |
| Member | `/dashboard` (client) | `/appointments` class booking (admins/staff are redirected out) |
| Staff  | `/staff` console    | trainer schedule, "my requests" submitter side, `role==='staff'` code paths |
| Admin  | `/dashboard` (admin) | time-off approval, retention launch as admin, studio-wide stats |

A single login can only ever be one role at a time, so "every feature
accessible" means being able to switch personas in one click.

## Demo accounts

All use password `Welcome!` (seeded accounts on the shared project).

| Button | Email                         | Role  |
| ------ | ----------------------------- | ----- |
| Admin  | `wil.sheppard@pursuit.org`    | admin |
| Staff  | `sofia.martinez@gitfit.demo`  | staff |
| Member | `casimir.hilpert@gitfit.demo` | client |

## What changed from upstream

| File | Change |
| ---- | ------ |
| `lib/demo/accounts.ts` | **new** — demo-mode flag + per-role account config (env-overridable) |
| `app/actions/auth.ts` | **new** `signInAsDemo(role)` Server Action |
| `app/sign-in/demo-quick-access.tsx` | **new** — the three role buttons |
| `app/sign-in/sign-in-form.tsx` | accepts a `prefill` prop → `defaultValue` on email/password |
| `app/sign-in/page.tsx` | passes prefill + renders quick-access when demo mode is on; renders `?error=` |
| `app/page.tsx` | landing CTAs point at `/sign-in` instead of `/sign-up` in demo mode |
| `app/globals.css` | styles for `.demo-quick-access` |

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
`lib/demo/accounts.ts` already point at the accounts in the table above.

## Deploy to Vercel

1. Push this repo to GitHub (done: `wiltobuild/gitfit-demo`).
2. In Vercel → **Add New… → Project** → import `wiltobuild/gitfit-demo`.
   Framework preset auto-detects as **Next.js**; leave build/output settings at
   their defaults.
3. Add **Environment Variables** (Production + Preview):

   | Name | Value |
   | ---- | ----- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://eranyjhyplfebfgjywmc.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon (publishable) JWT |
   | `NEXT_PUBLIC_DEMO_MODE` | `true` |

   Do **not** add the service-role key — the running app never uses it.
4. Deploy. Once the URL is live, add it to Supabase → **Authentication → URL
   Configuration → Redirect URLs** (for the password-reset flow to bounce back
   correctly): `https://<your-vercel-url>/reset-password`.
