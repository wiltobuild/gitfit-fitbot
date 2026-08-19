# Codex Handoff: supabase-auth-roles — Phase 1a

## Approved plan reference

docs/tasks/supabase-auth-roles/plan.md, "Phased implementation plan" → Phase 1a.

## Exact scope for this handoff

Dependencies (`@supabase/supabase-js`, `@supabase/ssr`), `.env.example`
documentation, and a checked-in SQL migration file for the `profiles`
table + RLS + signup trigger. No application code (no `lib/`, `app/`,
`proxy.ts`) — that's Phase 1b/1c.

## Instructions given to Codex

See `codex-phase1a-prompt.txt` in the session scratchpad (full text run
via `codex exec`) — summarized: add the two Supabase packages; update
`.env.example` with empty-valued `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (documented as
reserved for a later phase); create
`supabase/migrations/0001_profiles_and_roles.sql` with the `profiles`
table, RLS enabled, a `security definer` `is_staff()` helper to avoid RLS
recursion, self+staff SELECT policies, a role-protected UPDATE policy, and
an `on auth.users insert` trigger defaulting new users to `role='client'`.

## Constraints

- Stay inside the scope above — do not touch files outside it without
  flagging back.
- Do not install new dependencies without flagging back.
- Do not modify tests to make them pass — fix the code, or report the test
  is wrong and stop.

## Result

(filled in after Codex runs)
