# Plan: Supabase auth + client/staff roles (Phase 1)

Verified against repo state: `next` resolves to 16.3.1, `react`/`react-dom` to 19.2.8, no Supabase packages installed, no `middleware.ts`/`proxy.ts`, `lib/` contains only `appointments-store.ts`, `app/layout.tsx` wraps `{children}` directly in `<body>` with no providers, `app/appointments/page.tsx` is an iframe embedding `pulse-studio-prototype`'s static HTML (confirms Argus's low-confidence inference), `tsconfig.json` has a `@/*` path alias, `.env` locally has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set but no `SUPABASE_SERVICE_ROLE_KEY`.

---

## Decision: Session/SSR approach for Next.js 16

### Evidence
- No `middleware.ts` or `proxy.ts` exists today. Next 16.3.1 renamed the convention to `proxy.ts` exporting `proxy()` — any `@supabase/ssr` guide targeting `middleware.ts` silently won't run.
- Next's own docs warn Server Actions are POST requests to their defining page route, not separate routes in the proxy chain — a proxy `matcher` excluding a path also skips Server Actions on it.
- `cookies()` from `next/headers` is async and only settable in Server Functions/Route Handlers, not Server Components.

### Options
1. **Proxy-only**: `proxy.ts` refreshes the Supabase session cookie and does route-based redirects; individual routes/Server Actions trust the proxy ran.
2. **Per-route checks only, no proxy**: every Server Action/Route Handler/Server Component calls a shared `requireUser()`/`requireRole()` helper; no `proxy.ts` at all.
3. **Hybrid** (recommended): `proxy.ts` exists for two narrow jobs — (a) refresh/rewrite the Supabase auth cookie on every matched request per `@supabase/ssr`'s documented pattern, and (b) do a cheap "redirect unauthenticated users away from known authenticated pages" UX nicety. It is explicitly *not* the security boundary. Every Server Action, Route Handler, and Server Component that touches protected data calls the shared permission helper itself, independent of whether the proxy ran.

### Recommendation
Option 3 (hybrid), with the permission helper as the actual enforcement point.

### Why
Given the documented Server Action gap, a proxy-only model would leave Server Actions and any route outside the matcher unprotected — fails acceptance criterion 2 (server-side enforcement, not just UI-hidden). A per-route-only model forfeits Supabase's documented session-cookie-refresh pattern. The hybrid keeps proxy for cookie hygiene/UX redirect and makes the helper the non-optional gate everywhere else.

### Approval requested
Confirm the hybrid split (proxy = cookie refresh + soft UX redirect only; helper = actual enforcement everywhere) is acceptable.

---

## Decision: Where the `role` claim lives

### Evidence
- Supabase supports role/claims in `auth.users.app_metadata` (settable only server-side via service-role) or a separate `profiles` table with RLS.
- No `SUPABASE_SERVICE_ROLE_KEY` is currently supplied.
- decisions.md requires staff role to be assignable only through an admin-only path, never client-selectable, and flags "JWT/auth claim shape" as a shared-contract item needing elevated sign-off.

### Options
1. **`app_metadata.role` on `auth.users`** — rides in the JWT, but settable only via service-role key or Admin API.
2. **Separate `profiles` table** (`id uuid references auth.users`, `role text check (role in ('client','staff'))`), populated by a DB trigger defaulting to `client`, protected by RLS.
3. **Both** — table as source of truth, synced into `app_metadata` via trigger.

### Recommendation
Option 2 (`profiles` table, RLS-protected, trigger-populated on signup).

### Why
Avoids a hard *runtime* dependency on `SUPABASE_SERVICE_ROLE_KEY` for every signup. The one-time trigger/function is defined via SQL migration, not app runtime code. A table also gives later phases (member lookup, staff schedule views) a natural place to add more profile fields without touching auth internals again.

### Approval requested
Confirm `profiles` table (not `app_metadata`) as the role source of truth, and confirm this phase is treated as elevated-scrutiny (Themis) since it touches "JWT/auth claim shape" per decisions.md's shared-contract gate.

---

## Decision: Staff-provisioning mechanism

### Evidence
- decisions.md: staff accounts never selectable on a public signup form — admin-only path, exact mechanism deferred to planning.
- No staff accounts exist yet; no `SUPABASE_SERVICE_ROLE_KEY` supplied.

### Options
1. **Supabase Studio dashboard edit** — user manually flips a row in `profiles` after a staff member signs up as a normal client. Zero new code.
2. **Invite-code field** at a separate signup route, gated by a server-side shared secret.
3. **Internal admin route** — an authenticated staff user promotes another user via a service-role-privileged function.

### Recommendation
Option 1 (dashboard) for Phase 1, with RLS written now ("only service_role or an existing staff user may update another row's role") so Option 3 can be added later without a schema change.

### Why
Phase 1's acceptance criteria don't require a staff-promotion UI. Options 2/3 both have to solve "who promotes the very first staff member" — more honestly solved once via the dashboard than by building a second, less-tested code path now. Keeps Phase 1 out of `SUPABASE_SERVICE_ROLE_KEY` entirely.

### Approval requested
Confirm dashboard-only staff provisioning is acceptable for Phase 1, with an in-app admin promotion flow deferred to a later phase.

---

## Decision: Is `SUPABASE_SERVICE_ROLE_KEY` needed for Phase 1?

### Recommendation
Not needed. Signup, sign-in, sign-out, default-role assignment, and role enforcement all run under the anon/publishable key plus RLS policies and a `security definer` trigger function (defined once via SQL migration, run manually by the user in the Supabase SQL editor).

### Why
Avoids introducing the highest-privilege Supabase credential before it's actually needed — least privilege, no scope expansion beyond the brief.

### Approval requested
Confirm we proceed without `SUPABASE_SERVICE_ROLE_KEY` for Phase 1.

---

## Decision: Shape of the reusable permission-check helper

### Recommendation
Under `lib/supabase/`:
- `lib/supabase/server.ts` — `createSupabaseServerClient()` using `@supabase/ssr`'s `createServerClient`, wired to Next 16's async `cookies()`.
- `lib/supabase/client.ts` — `createSupabaseBrowserClient()` for sign-in/sign-up client components.

Under `lib/auth/session.ts`:
- `getSession(): Promise<{ user, role } | null>` — single primitive: Supabase auth user + joined `profiles.role`.
- `requireUserOrRedirect()` / `requireUserOrThrow()` — same check, two explicit call conventions (redirect for Server Components/pages, throw a typed `UnauthorizedError` for Route Handlers/Server Actions, caught by the caller and turned into a 403).
- `requireRoleOrRedirect('staff')` / `requireRoleOrThrow('staff')` — same pairing, with a role check.

Route Handlers and Server Actions call `requireRoleOrThrow`/`requireUserOrThrow` as their first line — this is the concrete answer to the documented proxy/Server-Action gap.

### Why
Naming the throw-vs-redirect distinction in the function name makes the correct choice obvious at each call site instead of one "magic" function guessing context. This is the pattern later phases (schedule, appointments, member lookup, chatbot intents) get evaluated against directly.

### Approval requested
Confirm this helper shape (module location, function names, throw-vs-redirect split) before implementation — later phases are built against it as a contract.

---

## Decision: Post-login destination for Phase 1

### Recommendation
A minimal new `/dashboard` placeholder page ("Signed in as {email} ({role})" + sign-out button) rather than redirecting into the existing anonymous-visitor-oriented `/` marketing page.

### Why
Redirecting to `/` after login gives no visible proof sign-in/role assignment worked, undermining verifiability. A one-file placeholder costs almost nothing and gives Apollo/Themis a concrete place to confirm session + role, without pre-building Phase 2's real design.

### Approval requested
Confirm a minimal `/dashboard` placeholder (not reusing `/`) is acceptable scope for this phase.

---

## Decision: Sign-up/sign-in UI scope

### Recommendation
`/sign-up` and `/sign-in`, plain Server Component pages with a `<form>` wired to a Server Action (`useActionState` for pending/error state), styled with existing Tailwind utilities only — no new design tokens or component library. Email + password only. `/sign-up` has no role selector (role defaults server-side to `client`). Errors render as inline text.

### Why
Minimum that satisfies acceptance criteria and the "no role picker" requirement, while staying inside "functional, not polished" per the brief's explicit Phase 12 deferral. Server Actions avoid a parallel `/api/auth/*` JSON contract that would need reconciling later.

### Approval requested
None strictly required — flagged for visibility. Speak up if you want additional fields (e.g. display name) now rather than later.

---

## Additional flag: `/appointments` and `pulse-studio-prototype`

Confirmed by direct read: `app/appointments/page.tsx` is exactly an `<iframe src="/appointments-prototype.html">`. It will keep loading untouched — no action needed this phase; relevant context for Phase 2/6 planning.

---

## Phased implementation plan (for Codex handoff)

**Phase 1a — Dependencies, env, Supabase project schema**
- Add `@supabase/supabase-js` and `@supabase/ssr` to `package.json`.
- Update `.env.example` to document `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (empty values).
- SQL migration file (checked in, run manually by the user in the Supabase SQL editor — no CLI/service-role automation in scope): `profiles` table, RLS policies (self-read own row; staff-only update of others' `role`; service_role bypass), and an `on auth.users insert` trigger defaulting `role='client'`.

**Phase 1b — Supabase client/session plumbing**
- `lib/supabase/client.ts`, `lib/supabase/server.ts`.
- `proxy.ts` at repo root: session cookie refresh + soft redirect for `/dashboard` when unauthenticated, documented in-code as not the security boundary.
- `lib/auth/session.ts`: `getSession`, `requireUserOrRedirect`, `requireUserOrThrow`, `requireRoleOrRedirect`, `requireRoleOrThrow`, `UnauthorizedError`.

**Phase 1c — Sign-up/sign-in/sign-out UI + Server Actions**
- `/sign-up`, `/sign-in` pages + Server Actions.
- Sign-out Server Action, surfaced on `/dashboard`.
- `/dashboard` placeholder page using `requireUserOrRedirect()`.
- Layout left untouched otherwise, to minimize blast radius on existing pages.

**Phase 1d — Server-side enforcement demonstration**
- One throwaway staff-only fixture (e.g. `app/api/staff-ping/route.ts` behind `requireRoleOrThrow('staff')`, and/or a `/staff` placeholder page behind `requireRoleOrRedirect('staff')`), explicitly labeled as a Phase 1 verification fixture — later phases replace it with real staff features.

**Phase 1e — Verification pass**
- `npm run lint`, `npm run build`.
- Confirm `/`, `/chat`, `/appointments` still load.
- Live: sign-up → `profiles` row with `role='client'` → sign-out → sign-in → session persists across navigation/refresh → client user hits staff fixture (expect 403/redirect) → manually flip a test user to `staff` in Supabase dashboard → confirm access granted.

---

## Acceptance criteria (concrete, checkable)

1. Sign-up creates a Supabase auth user + `profiles` row with `role='client'`; redirects to `/dashboard` showing email/role; sign-out returns to `/sign-in` and `/dashboard` becomes unreachable.
2. A signed-in `client`-role user hitting the Phase 1d staff-only fixture gets 403 (API, verified via curl/fetch with session cookie) or redirect (page) — not just UI-hidden.
3. Session persists across navigation and a hard refresh.
4. No `.env` changes staged in git; `.env.example` updated with empty-valued Supabase vars only.
5. `npm run lint` exits 0; `npm run build` exits 0, no type errors.
6. `/`, `/chat`, `/appointments` all still return 200 and render unchanged.
7. Manually promoting a test user's `profiles.role` to `staff` in Supabase Studio grants access to the Phase 1d fixture on next request/re-auth.

### Critical files
- `app/layout.tsx`, `package.json`, `.env.example`, `lib/appointments-store.ts` (reference only, not modified), `tsconfig.json` (`@/*` alias).

**Not yet approved for implementation.**
