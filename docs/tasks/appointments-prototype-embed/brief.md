# Brief: Embed the pulse-studio-prototype's original static HTML at /appointments

## Scope

Replace the GitFit-restyled `/appointments` page (built in the `appointments-booking-page` task) with a direct embed of the original prototype file, `pulse-studio-prototype/membership booking.html`, served byte-identical — dark slate-900/indigo-600 theme, its own hardcoded mock class data, fully standalone/static (not wired to `/api/appointments/*`). The user explicitly wants the prototype's original visual style preserved as-is, not restyled into GitFit brand tokens.

Mechanism: copy the HTML file verbatim into Next.js's `public/` directory as a static asset (e.g. `public/appointments-prototype.html`), and have `/appointments` render it via an `<iframe>` (simplest way to preserve the file's own `<script>` tags executing exactly as authored — `dangerouslySetInnerHTML` would not execute embedded `<script>` content). Keep the existing nav links from `/` and `/chat` pointing at `/appointments`.

Work type: **Small, low-risk fix** (per `docs/agent/workflow.md`) → Argus → Codex → Apollo.

## Out of scope

- Any wiring to `lib/appointments-store.ts` or `/api/appointments/*` — this embed is intentionally disconnected, standalone, resets on every page load, per explicit user direction.
- Removing the previously-built store/API routes/React implementation — leave `lib/appointments-store.ts` and `app/api/appointments/*` in place (unused by this page for now, but not deleted; they remain available for a future task if the direction changes back).
- Any change to `pulse-studio-prototype/` itself (still read-only, still a submodule).
- Any brand-token restyling — the whole point of this task is to NOT apply GitFit styling here.

## Acceptance criteria

1. `/appointments` visually matches `pulse-studio-prototype/membership booking.html` exactly — dark slate-900 background, indigo-600 accents, translucent Yoga/Cycling/HIIT badge colors (teal/amber/rose per the prototype's own `typeStyles`), same layout/interactions (day tabs, reserve/cancel, confirmation modal) — verified live in a running dev server, not just code review.
2. The embedded prototype's own JS logic works standalone (reserve/cancel/credits update visually) using its own hardcoded mock data — no network calls to `/api/appointments/*`.
3. Nav links from `/` ("Book a class") and `/chat` still reach `/appointments` and work.
4. `npm run lint` and `npm run build` both pass.
5. No secrets committed.

## Preflight state

- Branch: `main`
- Relevant existing behavior: `/appointments` currently renders a GitFit-branded React implementation (`app/appointments/page.tsx` + `appointments-experience.tsx`) wired to `lib/appointments-store.ts` via `/api/appointments/*` — built and verified in the prior `appointments-booking-page` task (not yet committed). This task replaces that page's visual/rendering approach only; the store/API code is left in place, unused.
