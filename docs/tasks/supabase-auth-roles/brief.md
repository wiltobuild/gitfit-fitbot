# Brief: Supabase auth + client/staff roles (Phase 1 of gitfit-suite-buildout)

## Scope

Establish the foundation every later phase depends on:

- Supabase project wiring (client SDK, server-side session handling for
  Next.js App Router).
- Sign-up / sign-in / sign-out flows.
- A `role` claim distinguishing `client` vs `staff` accounts, stored
  durably (not inferred client-side).
- Route/page protection: authenticated-only pages redirect unauthenticated
  users; staff-only pages/API routes reject client-role users server-side,
  not just hide UI.
- A reusable permission-check pattern (helper/middleware) that later
  phases' pages, API routes, and chatbot intents all call into, so
  role-gating isn't reinvented per phase.

## Out of scope (deferred to later phases)

- The suite landing page itself (Phase 2) — this phase only needs *a*
  post-login destination, not the final one.
- Chatbot integration with auth (Phase 3+) — the chatbot shell doesn't
  exist yet.
- Migrating `lib/appointments-store.ts` off its in-memory/hardcoded-member
  model onto real Supabase-authenticated users (Phase 6).
- Any UI visual redesign beyond what's needed for functional sign-in/
  sign-up forms (Phase 12 owns suite-wide visual polish).
- Password reset / email verification flows, unless Supabase's defaults
  make them effectively free — full account-recovery UX is not a stated
  requirement for this phase.

## Acceptance criteria

1. A new user can sign up, is assigned a role, and can sign in/out.
2. Role is enforced server-side: a client-role user hitting a staff-only
   route/API gets rejected (403 or redirect), not just UI-hidden.
3. Session persists across page navigation and a refresh.
4. No secrets committed — Supabase URL/keys via gitignored `.env`, with
   `.env.example` updated to document the required variables.
5. `npm run lint` and `npm run build` both pass.
6. Existing pages (`/`, `/chat`, `/appointments`) still load without
   crashing — this phase adds auth, it doesn't need to fully gate every
   existing page yet (that's implicit in later phases owning those pages),
   but nothing should be left broken.

## Preflight state

- Branch: `main`, commit `3bd172d`, working tree clean except this task's
  own doc additions and the prior architecture-pivot doc edits (both
  uncommitted, per project git strategy of no auto-commits).
- No auth exists anywhere in the app today (hardcoded `member_001` in the
  appointments feature).
- User has an existing Supabase project; URL/keys to be provided before
  the Codex implementation stage (not yet supplied as of this writing).
- `.env.example` currently only documents `ANTHROPIC_API_KEY` (unused
  placeholder) — will need `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and likely
  `SUPABASE_SERVICE_ROLE_KEY` added.

## Role-assignment decision

Client accounts are self-service at signup. Staff accounts are never
self-selected on a public form — they're created/promoted via a separate
admin-only path (exact mechanism — Supabase dashboard role edit vs. an
invite-code field vs. an internal admin route — decided during planning).
Recorded in `docs/agent/decisions.md`.

## Workflow classification

Per `docs/agent/workflow.md`: this is simultaneously an **Architecture
change** and a **Database/migration** row (new Supabase schema: users/
roles table or `auth.users` metadata) and touches **authentication** (a
global stop-condition on its own). Recommended sequence:

1. Argus — investigate current app structure (App Router layout, existing
   routes, existing `.env` handling) to scope exactly what auth wiring
   touches.
2. Athena — plan: Supabase schema for roles, session/middleware approach
   for Next.js App Router, the permission-check helper shape, sign-up/
   sign-in UI scope.
3. **Your approval** — hard stop, this brief's own gate plus the plan's.
4. Codex — implementation, one phase.
5. Themis — independent review, elevated scrutiny (auth + schema).
6. Apollo — verification, including a live sign-up/sign-in run against a
   real Supabase project.
