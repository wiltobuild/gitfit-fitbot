# gitfit-fitbot

This project follows the global defaults in `~/.claude/CLAUDE.md`.

## Commands
- test: `npm test` (vitest; run in CI/non-watch mode — `npm run test:watch`
  for local iteration). Framework added 2026-08-24; no test files exist yet,
  so a fresh checkout will report "no test files found" until the first one
  is written.
- build: `npm run build` (Next.js)
- lint: `npm run lint` (eslint)
- typecheck: `npx tsc --noEmit`

## Constraints
- Documentation level: **Standard** — every task gets a full
  `docs/tasks/<slug>/` artifact set (see `docs/tasks/README.md`).
- Extra approval gate: any change to the shared contract (tool manifest
  format, JWT/auth claim shape, or error response shape defined in
  `docs/build-doc.md`) needs explicit user sign-off before implementation
  and elevated review after, since it breaks teammates' products if changed
  silently.
- Ship date: Friday, Aug 28, 2026.
- Secrets (Supabase keys, JWT secret) must never be committed — use
  gitignored `.env` files.

## Notes
New tasks: run `/start-task`. See `docs/tasks/README.md` for the per-task
artifact structure. Full project context: `docs/agent/project-profile.md`
and `docs/build-doc.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
