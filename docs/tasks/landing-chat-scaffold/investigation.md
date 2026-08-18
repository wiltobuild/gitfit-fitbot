# Investigation: Landing page + chat UI scaffold

_By Argus._

## Verified facts

- Git state: branch `main`, no commits yet, untracked files `CLAUDE.md` and `docs/`.
- File tree: repo has only doc/agent scaffolding (`CLAUDE.md`, `docs/build-doc.md`, `docs/agent/**`, `docs/tasks/**`) — no `app/`, `package.json`, `.gitignore`, or application code. Confirms this is the first code in the project.
- Node/npm: `node --version` → `v24.18.0`; `npm --version` → `11.16.0`.
- Brand tokens (`docs/build-doc.md`): Vital Teal `#1FC2AE`, Drive Violet `#6E3FE0`, Energy Magenta `#C43FD6`, Ink `#141B3C`, Paper `#F8F7F5`. Fonts: Baloo 2 (600/700) for headlines/personality moments; Inter (400/500/600) for chat bubbles, buttons, read/reply text. Gradient (teal→violet→magenta) is a hero-moment device only — not for body text or chat bubble fills; reserve for typing indicator or send-button active state. Voice: warm but driven, instructor tone ("Let's get you booked" over "I'd be happy to assist with that").
- Tech stack table confirms: Next.js/Vite + React + Tailwind for frontend, Node+TS backend, SSE streaming transport (not needed for this stubbed task), Postgres/SQLite state (out of scope), Render/Fly/Vercel hosting (out of scope).
- Sibling project `2026-07-06\cr` (unrelated app, same workspace) uses Next.js 15, React 19, TypeScript 5.6, **Tailwind v3.4** (`tailwind.config.ts` + `postcss.config.js`, CommonJS, HSL CSS-variable tokens, shadcn/ui pattern), ESLint 9 + `eslint-config-next`, Prettier (`semi: true`, `singleQuote: false`, `trailingComma: "none"`), `tsconfig.json` targets ES2017 strict with `@/*` alias and `moduleResolution: "bundler"`. Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`.

## Inferences

- Given Node 24 is installed, a fresh `create-next-app` may default to a newer Next.js major and possibly **Tailwind v4** (CSS-first `@theme`, no `tailwind.config.ts`/`postcss.config.js` in the old form) rather than the sibling project's v3 setup — medium confidence, unverified without actually running the scaffold command.
- No `.nvmrc`/`engines` field exists anywhere yet in this repo.

## Unknowns

- Whether `create-next-app` in this environment defaults to Tailwind v3 or v4, and its non-interactive flag behavior — needs to be resolved at implementation time (Codex), not by Argus (read-only).
- Whether Google Fonts (Baloo 2, Inter) are reachable via `next/font/google` in this environment/build, or need local font files instead.

## Risks

- **Scaffolding mismatch**: if `create-next-app` lands on Tailwind v4, the sibling project's config patterns aren't directly transferable — implementation must adapt to whatever version actually installs, not assume v3.
- **Brand doc scope creep**: `docs/build-doc.md` covers the full team contract (JWT, tool manifest, MCP/REST, hosting) — out of scope for this task. Nothing here should touch shared-contract code paths (that would trigger the elevated approval gate in `docs/agent/workflow.md`).
- **Interactive prompt risk**: `create-next-app` prompts interactively by default (App Router/TypeScript/ESLint/Tailwind/src-dir/import-alias) — must be run with explicit non-interactive flags to avoid hanging in the Codex handoff.
