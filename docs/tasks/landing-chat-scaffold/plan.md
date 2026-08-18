# Plan: Landing page + chat UI scaffold

_By Athena._

## Decision: Tailwind version — pin v3 vs let create-next-app decide

### Evidence
Node 24.18.0 / npm 11.16.0 installed; a fresh `create-next-app` may default to Tailwind v4 rather than the sibling project's v3 setup. Acceptance criteria don't name a Tailwind major version.

### Options
1. Pin Tailwind v3 to match the sibling project's config pattern.
2. Let `create-next-app` decide, adapt to whatever lands (v3 or v4).

### Recommendation
Option 2 — adapt to whatever installs.

### Why
No dependency on the sibling project's config being reusable. Pinning v3 means fighting current defaults. Acceptance criteria are version-agnostic. Codex records which version landed in implementation notes.

### Approval requested
Confirm the concrete Tailwind major version is an implementation-time discovery, not a pre-committed choice.

---

## Decision: Font loading — next/font/google vs local font files

### Evidence
Need Baloo 2 (600/700) and Inter (400/500/600). Google Fonts reachability during build is unverified in this environment.

### Options
1. `next/font/google` only — simplest, but fails `npm run build` if fonts unreachable.
2. Local font files via `next/font/local` — offline-safe, more setup.
3. Try `next/font/google` first, fall back to `next/font/local` if build fails.

### Recommendation
Option 3.

### Why
Idiomatic default with a documented escape hatch so acceptance criterion 4 (build must pass) isn't blocked on network access. Whichever path is taken gets noted in implementation notes.

### Approval requested
None — implementation contingency, not a scope change.

---

## Decision: Chat state approach for the stub

### Recommendation
Client-side React state only (`useState`, array of `{role, content}` messages, lost on refresh) — simplest thing that satisfies criterion 3; persistence is explicitly out of scope.

### Approval requested
None.

---

## Decision: API route shape for the stubbed echo endpoint

### Recommendation
Plain `POST /api/chat` (Next.js Route Handler), accepts `{ message: string }`, returns `{ reply: string }` with a deterministic echo/canned instructor-voice response. No SSE/streaming — deferred to the real-LLM task.

### Why
Streaming is speculative complexity with no acceptance criterion requiring it; would be redone anyway once real Claude integration lands. Doesn't touch the shared contract (no tool manifest, auth, or cross-product schema), so this stays on the standard Feature workflow row.

### Approval requested
None.

---

## Phased implementation plan (for Codex)

**Phase 1 — Project scaffold**
- Non-interactive `create-next-app` (TypeScript, App Router, ESLint, Tailwind, `@/*` alias).
- Verify `npm install && npm run dev` boots cleanly.
- Record installed Next.js/Tailwind versions in implementation notes.
- `.gitignore` (confirm `.env*.local`, `node_modules`, `.next` covered) + `.env.example` with placeholder vars (e.g. commented `ANTHROPIC_API_KEY=` for a future task).

**Phase 2 — Brand tokens**
- Define the 5 brand colors + 2 fonts as design tokens (v3 JS theme or v4 `@theme` CSS, whichever installed).
- Load Baloo 2 / Inter per the font decision above.
- Gradient (teal→violet→magenta) reserved for typing indicator / send button active state only — never body text or bubble fills.

**Phase 3 — Landing page**
- `/` (`app/page.tsx`): headline in Baloo 2, body/UI in Inter, brand colors visibly used, a link/button into `/chat`. Instructor-voice copy.

**Phase 4 — Chat UI + stub API**
- `/chat` page: message list (user + assistant bubbles, Inter, no gradient fills), text input, send control, client-side state.
- `POST /api/chat` route handler returning stubbed `{ reply }`.
- Wire send → POST → append response to list.

**Phase 5 — Tooling and verification**
- Lint/format config (ESLint + eslint-config-next; reasonable `.prettierrc`).
- `npm run lint` and `npm run build` clean.
- Manually exercise the chat flow in the dev server — live verification, not just code reading (Apollo re-verifies independently).

Each phase lands as its own reviewable commit, per the project's "small commits per approved phase" strategy.

## Approval needed before implementation starts

1. Tailwind version handling — proceed with whatever `create-next-app` installs (v3 or v4).
2. Font fallback contingency — try `next/font/google` first, fall back to `next/font/local` if the build environment can't reach Google Fonts.

Confirmed standard **Feature** workflow (Argus → Athena → approval → Codex → Themis → Apollo) — nothing here touches the shared contract, so the elevated approval gate does not apply.

## Acceptance criteria, restated as concrete checks

1. **Install and run cleanly** — `npm install` exits 0; `npm run dev` serves `GET /` with 200.
2. **Landing page brand fidelity** — Baloo 2 headline, Inter body, Vital Teal/Drive Violet/Ink visibly used, a link/button to `/chat`.
3. **Chat UI functional round-trip (live verification required)** — type + submit a message, confirm it appears in the list, a network request fires to the local API route, a stubbed response appears without reload; repeat for 2+ messages to confirm accumulation.
4. **Lint and build gates** — `npm run lint` and `npm run build` both exit 0.
5. **No secrets, correct ignores** — no `.env`/`.env.local` tracked; `.gitignore` excludes `.env*`; `.env.example` tracked with placeholder-only values.

Apollo performs 1–3 live in a running dev server, not from code reading alone.
