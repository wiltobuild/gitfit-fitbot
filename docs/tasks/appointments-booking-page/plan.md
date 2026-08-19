# Plan: Appointments booking page

_By Athena._

## Decision: Seed data location

### Recommendation
Copy `classes.json`, `members.json`, `bookings.json` into `app/appointments/data/` (one-time, unmodified copy) rather than importing from the submodule path.

### Why
The submodule is a teammate-owned separate repo that may not be checked out in every build/CI environment. Copying makes `/appointments` self-contained and matches "native GitFit feature" framing.

### Approval requested
No — implementation-detail default.

---

## Decision: Reserve/cancel via server API route vs. client-only state

### Options
1. Pure client-side React state.
2. Server API routes (`app/api/appointments/*`) backed by a module-level in-memory store.

### Recommendation
Option 2.

### Why
Matches the existing `/api/chat` convention, sets up a clean seam for the future chatbot-tool-calling task to call into, and centralizes capacity/credit enforcement in one server-side place.

### Approval requested
**Yes** — this is the one decision with a real structural alternative and a bigger diff. Confirm option 2, or say go client-only for a smaller diff.

---

## Decision: Seeding algorithm (avoids double-counting)

1. Load `classes.json` verbatim — `bookedCount` used as-is, never incremented from `bookings.json`.
2. Load `members.json` verbatim — `remainingCredits` used as-is.
3. `CURRENT_MEMBER_ID = "member_001"` hardcoded constant.
4. Load `bookings.json` **only** to derive which classes the demo member currently holds (`demoMemberBookedClassIds`) — never used to mutate counts.
5. `reserve(classId)`: validate exists, not full (or already held), member has credits (or unlimited) → increment `bookedCount`, add to held set, decrement credits (skip if unlimited).
6. `cancel(classId)`: validate member holds it → decrement `bookedCount`, remove from held set, increment credits (skip if unlimited).
7. All mutation happens in one place so `bookedCount` and the held-set can't drift apart.

### Approval requested
No — follows directly from Argus's verified finding.

---

## Decision: Header/nav pattern

### Recommendation
Page-local header for `/appointments` (own `<nav>`/`<header>`, reusing existing `.nav`/`.brand`/`.text-link`/`.back-link` classes), matching the established per-page pattern already used twice in this repo. Add a `Link` into `/` and `/chat`'s existing nav.

### Why
A shared-header extraction is real value but out of this task's scope (would also touch `app/page.tsx`/`chat-experience.tsx`'s existing shipped code beyond what's needed). Two data points already establish "each page owns its header" as the repo's actual convention.

### Approval requested
No.

---

## Decision: Type color mapping (Yoga/Cycling/HIIT)

### Recommendation
One accent per type, applied as text-color + small dot/left-border on an otherwise neutral badge (`--line` border, white/paper background) — not translucent fills, and never the reserved gradient:
- Yoga → `--teal`
- Cycling → `--violet`
- HIIT → `--magenta`

Reuses the existing `.orbit-tag` idiom (colored text on a neutral card) already in the codebase.

### Approval requested
No — flagged for visibility; say now if you want a different color-to-type mapping.

---

## Decision: Shared-contract gate check

### Recommendation
This task does **not** trip the elevated shared-contract approval gate — no tool manifest, no auth/JWT, no published error-shape contract. The new API routes are private implementation detail for this page only, not yet exposed to the chatbot or other products.

### Approval requested
Confirmatory only — flag if you disagree with this read.

---

## Phased implementation plan (for Codex)

**Phase 1 — Seed data + store**: copy the 3 JSON files into `app/appointments/data/`; add `lib/appointments-store.ts` implementing the seeding algorithm plus `reserve`/`cancel`/`getState`; shared types.

**Phase 2 — API routes**: `GET /api/appointments/classes`, `POST /api/appointments/reserve`, `POST /api/appointments/cancel` (4xx errors: not found, full, insufficient credits, already booked, not booked).

**Phase 3 — Page UI**: `app/appointments/page.tsx` (server) → `appointments-experience.tsx` (client), mirroring the `chat/` split. Fetch on mount, day tabs from distinct `(day, date)` pairs sorted chronologically, cards grouped by selected day, reserve → confirmation panel → confirm → POST; cancel → POST directly (no confirmation needed for cancel). Credits indicator in header.

**Phase 4 — Brand styling**: `/appointments`-scoped CSS in `app/globals.css` using only the existing 7 CSS variables and Baloo 2/Inter, matching existing spacing/radius idioms.

**Phase 5 — Nav wiring**: `Link` to `/appointments` from `app/page.tsx` and `app/chat/chat-experience.tsx`.

**Phase 6 — Verification**: `npm run lint`/`npm run build` pass; live walkthrough of all acceptance criteria in a running dev server.

## Acceptance criteria, concrete checks

1. Day tabs show all 7 days from seed data with correct dates; selecting a tab filters correctly.
2. Cards show name, type badge (color per mapping above), instructor, time, duration, spots-left/Class Full.
3. Reserve on a non-full, not-yet-held class → confirmation panel → confirm → booked count +1, credits −1 (if not unlimited), card flips to "Spot reserved" + Cancel. Live-verified.
4. Cancel on a held class → booked count −1, credits +1, card reverts. Live-verified.
5. A full class not held by member_001 shows Class Full/disabled Reserve; a full class member_001 already holds shows "Spot reserved" + working Cancel, not Class Full.
6. No leftover prototype (slate/indigo/emerald/amber/rose) styling; only GitFit tokens/fonts. Working nav links both directions.
7. `npm run lint` and `npm run build` exit 0.
8. No secrets; diff scoped to appointments feature files + small nav edits only.

## Approval needed before implementation

1. **Server API routes vs. client-only state** — confirm option 2 (API routes), or request client-only instead.
2. Confirm the shared-contract gate does not apply (or object if it should).
3. Everything else is a low-risk default, flagged for visibility only — speak up now if you want something different (e.g. a different color mapping).
