# Brief: Appointments booking page (native GitFit feature)

## Scope

Build `/appointments` as a native, GitFit-branded Next.js page inside `gitfit-fitbot` that reimplements the class-booking experience currently prototyped as a static HTML file in the `pulse-studio-prototype` submodule (`pulse-studio-prototype/membership booking.html`), using its bundled sample data (`classes.json`, `bookings.json`, `members.json`) as the seed data model.

Functionality to port from the prototype, restyled with GitFit brand tokens (`docs/build-doc.md`) instead of the prototype's slate/indigo dark theme:
- Day-by-day class schedule (Yoga / Cycling / HIIT), grouped by day, showing time, instructor, duration, capacity, and spots remaining.
- Reserve a spot / cancel a reserved spot, with capacity enforcement (disable + "Waitlist" label when full).
- A member credits indicator (e.g. "5 of 8 credits remaining") that updates on reserve/cancel.
- A confirmation step before booking (the prototype's modal) — this also satisfies the build-doc's "confirm before mutating" principle for anything that will later become a chatbot tool.

Data model: seed the page's server-side state from the shape of `classes.json`/`members.json`/`bookings.json` (adapted to consistent string IDs, since the prototype JSON and the prototype HTML currently use two different ID schemes — reconcile to one, matching the JSON files' `class_NNN`/`member_NNN`/`booking_NNN` string-ID convention per the shared contract's "IDs as strings everywhere" rule in `docs/build-doc.md`). No real user auth yet — hardcode/select a single demo member (e.g. `member_001`, Ria Russo) as "the current user" for this task.

Persistence: in-memory only, held server-side for the life of the dev/server process (e.g. a module-level store or a simple API route backed by an in-memory array) — matches the existing chat stub's approach of no real database yet, per the project's current constraints.

Work type: **Feature** (per `docs/agent/workflow.md`) → Argus → Athena → **approval** → Codex → Themis → Apollo.

## Out of scope

- Chatbot tool-calling / chatbot awareness of bookings (separate future task, once the shared tool-manifest contract is frozen — touching that needs the elevated approval gate).
- Real database/Postgres persistence (bookings reset on server restart — acceptable for this task).
- Real auth / multi-user login (single hardcoded demo member only).
- Supabase integration of any kind (the earlier `pulse-studio` submodule's auth approach is not used here — this task builds natively in `gitfit-fitbot`, not by wiring in the teammate's separate app).
- Waitlist functionality beyond the label (no actual waitlist queue/notification).
- Any change to `docs/build-doc.md`'s shared contract (tool manifest, JWT shape, error shape).
- Removing or modifying the `pulse-studio-prototype` submodule's own files — it's a read-only reference/data source for this task.

## Acceptance criteria

1. `/appointments` renders a day-by-day class schedule using the seed data derived from `classes.json`, with day-tab navigation (Mon–Sun) matching the data's actual dates.
2. Each class card shows name, type (Yoga/Cycling/HIIT with distinct visual treatment), instructor, time, duration, and remaining spots (or "Class Full").
3. Clicking "Reserve Spot" on a non-full class shows a confirmation step; confirming books the spot — the class's booked count increments, the demo member's remaining credits decrement by 1, and the card updates to show "Spot reserved" with a cancel option — verified live in a running dev server, not just code review.
4. Cancelling a reserved spot decrements the class's booked count and increments the member's credits back, verified live.
5. A full class (bookedCount >= capacity) shows "Class Full"/"Waitlist" and the reserve button is disabled, unless the demo member already holds that spot.
6. The page uses GitFit brand tokens (colors, Baloo 2 / Inter fonts) — no leftover slate/indigo prototype styling — and is reachable via a nav link from the landing page and/or chat page.
7. `npm run lint` and `npm run build` both pass.
8. No secrets committed; nothing in this task touches `.env`/auth.

## Preflight state

- Branch: `main`
- Relevant existing behavior: `gitfit-fitbot` currently has `/` (landing), `/chat` (stub chat UI + `/api/chat`), from the prior `landing-chat-scaffold` task (committed as `54c16f3`, pushed to `wiltobuild/gitfit-fitbot`). No `/appointments` or booking logic exists yet. `pulse-studio-prototype` is freshly added as a git submodule at `pulse-studio-prototype/`, containing a static HTML prototype and 3 JSON sample-data files — read-only reference for this task, not itself part of the Next.js build.
