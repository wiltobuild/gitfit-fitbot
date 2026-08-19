# Codex Handoff: supabase-auth-roles — Phase 1b

## Approved plan reference

docs/tasks/supabase-auth-roles/plan.md → Phase 1b.

## Exact scope for this handoff

Supabase client/server helpers, `proxy.ts` (Next 16's `middleware.ts`
replacement), and the `lib/auth/session.ts` permission-check helper
(`getSession`, `requireUserOrRedirect/OrThrow`,
`requireRoleOrRedirect/OrThrow`, `UnauthorizedError`). No UI pages.

## Instructions given to Codex

See `codex-phase1b-prompt.txt` (session scratchpad) — summarized: build
`lib/supabase/client.ts` and `lib/supabase/server.ts` (async, Next 16's
`cookies()`), `proxy.ts` for session-cookie refresh + a soft `/dashboard`
redirect (explicitly documented as not the security boundary, per the
plan's hybrid decision), and the session helper functions exactly per the
plan's approved shape.

## Constraints

- Stay inside `lib/supabase/*`, `lib/auth/*`, `proxy.ts` only.
- Do not touch `app/`.
- Do not install new dependencies without flagging back.

## Result

- Exit status: success.
- Files changed: `lib/supabase/client.ts`, `lib/supabase/server.ts`,
  `lib/auth/session.ts`, `proxy.ts`.
- `npm run lint` / `npm run build`: both passed; `Proxy (Middleware)`
  correctly recognized by the build output.
- Deviations from plan: none.
