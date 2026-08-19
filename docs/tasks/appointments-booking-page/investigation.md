# Investigation: Appointments booking page

_By Argus._

## Verified facts

- **Brand tokens** (`app/globals.css:3`): `--teal:#1FC2AE; --violet:#6E3FE0; --magenta:#C43FD6; --ink:#141B3C; --paper:#F8F7F5; --muted:#66708c; --line:#dfe2e9`. Tailwind v4 CSS-first (`@import "tailwindcss"`, no `tailwind.config.js`). Fonts via `next/font/google` in `app/layout.tsx:1-15,24` → `--font-baloo-2`, `--font-inter`.
- **No shared header component.** `app/page.tsx:8-14` and `app/chat/chat-experience.tsx:36-40` each build their own `<nav>`/`<header>` independently, reusing `.nav`/`.chat-header`/`.brand`/`.text-link`/`.back-link` classes from globals.css. `app/layout.tsx:22-28` only wraps `{children}`. `/appointments` should follow the same per-page pattern.
- `app/api/chat/route.ts` is a stateless echo — no existing persistence pattern to mirror beyond "plain API route."
- **Prototype logic** (`pulse-studio-prototype/membership booking.html`): hardcoded mock data uses numeric `id`, fields `day` (short name), `time`, `duration` (string), `booked` (not `bookedCount`). Core functions: `renderTabs`/`selectDay`/`renderClasses`/`openConfirmModal`/`confirmBooking`/`cancelBooking`. `confirmBooking` increments `booked`, adds to a `Set`, decrements credits; `cancelBooking` reverses. `typeStyles` maps Yoga/Cycling/HIIT to prototype-theme (slate/indigo/emerald) Tailwind classes — none are GitFit tokens, all need replacing.
- **JSON sample data uses a different ID scheme**: string IDs (`class_001`, `member_001`, `booking_NNN`), full day names, numeric `duration`/`bookedCount`. `members.json` `bookedClassIds` arrays match `bookings.json` rows exactly (e.g. member_001's 3 `bookedClassIds` = the 3 `bookings.json` rows with `memberId: "member_001"`).
- **Critical: `bookedCount` in `classes.json` already includes the `bookings.json` rows.** Seeding must set state directly from `classes.json`'s `bookedCount` and must NOT additively re-apply `bookings.json` on top — that would double-count. `bookings.json`/`bookedClassIds` should only be used to mark which classes the demo member currently holds (for "Spot reserved" rendering on load), not to increment counts a second time.
- **Tooling**: no state-management library installed (plain React/module state only). `tsconfig.json` has `resolveJsonModule: true` and `@/*` → repo root alias. ESLint flat config extends `eslint-config-next/core-web-vitals`. Prettier: `semi:true, singleQuote:false, trailingComma:"none"`.

## Inferences

- `/appointments` → `app/appointments/page.tsx`, likely split into a server page + client component (mirroring `chat/page.tsx` + `chat-experience.tsx`), with its own header reusing existing nav classes, plus new `Link`s wiring it into `/` and `/chat`'s navigation (medium-high confidence).
- Seed JSON should likely be copied into the app rather than imported from the submodule path, to avoid a runtime dependency on `pulse-studio-prototype/` resolving at build time (medium confidence — brief doesn't specify, worth an explicit Athena decision).
- Whether reserve/cancel goes through a new `app/api/appointments/*` route (mirroring the chat stub) or pure client-side state is left open by the brief (medium confidence either way) — explicit Athena decision needed.

## Unknowns

- Exact placement of seed data copies (inside `app/appointments/` vs a `lib/` directory).
- Whether API routes are required for reserve/cancel, or client-only state satisfies the "verified live" acceptance criteria.

## Risks

- **Double-counting** (see bookedCount finding) is the most concrete implementation risk — Athena must specify the seeding rule explicitly.
- **HMR module-state reset**: if using a module-level in-memory store in an API route, Next dev-mode Fast Refresh can re-execute the module and reset state between edits — acceptable per brief, but worth calling out as an expected caveat during verification, not a bug.
- **Serverless/multi-instance**: in-memory state won't survive a serverless cold start or be shared across instances — already accepted as out of scope for this task.
- Unrelated, already known/flagged in a prior task's review: `CLAUDE.md` contains a block claiming to be auto-written by `next dev`. This has already been independently confirmed as genuine Next.js 16 "agent rules" tooling output (the exact log line was observed directly from a real `next dev` run in a prior session) — not injected content. No action needed.
