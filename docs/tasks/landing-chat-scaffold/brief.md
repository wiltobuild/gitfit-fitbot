# Brief: Landing page + chat UI scaffold

## Scope

Stand up the initial GitFit chatbot app: a Next.js + TypeScript project that
serves both the marketing landing page and the chat interface, styled with
the GitFit brand tokens (colors, fonts) from `docs/build-doc.md`. The chat
UI holds a conversation (user message → assistant response) against a
stubbed/echo backend endpoint — no real LLM call yet. Includes the base
project tooling: npm, Tailwind, lint/format config, `.env.example`, and a
`.gitignore` that excludes secrets.

Work type: **Feature** (per `docs/agent/workflow.md`) →
Argus → Athena → **approval** → Codex → Themis → Apollo.

## Out of scope

- Real Claude/Anthropic API integration and the tool-call loop (future
  task, once an API key and the shared contract are ready).
- Any teammate product integration (tool manifest consumption, MCP/REST
  client) — contract isn't frozen yet (see Unknowns in
  `docs/agent/project-profile.md`).
- Auth / JWT handling — no cross-product identity needed until integration.
- Persistence (Postgres/SQLite conversation history) — in-memory/local
  state only for this task.
- Deployment/hosting setup.

## Acceptance criteria

1. `npm install && npm run dev` starts the app locally with no errors.
2. Landing page renders at `/` with GitFit brand colors (Vital Teal
   `#1FC2AE`, Drive Violet `#6E3FE0`, Energy Magenta `#C43FD6`, Ink
   `#141B3C`, Paper `#F8F7F5`) and fonts (Baloo 2 for headlines, Inter for
   body/UI text), and a clear path (link/button) into the chat UI.
3. Chat UI accepts a typed message, sends it to a local API route, and
   displays a response (stubbed/echoed) in a message list — verified by
   actually using it in a running dev server, not just code review.
4. `npm run lint` and `npm run build` both pass.
5. No secrets committed; `.env.example` documents expected env vars (even
   if unused yet) and `.gitignore` excludes `.env`.

## Preflight state

- Branch: `main`
- Relevant existing behavior: none — repo is empty aside from
  `docs/build-doc.md` and `docs/agent/*`. This is the first code in the
  project.
