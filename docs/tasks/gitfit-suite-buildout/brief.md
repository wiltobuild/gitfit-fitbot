# Brief: GitFit Suite buildout (umbrella — phase index, not a single implementation task)

## Scope

Evolve `gitfit-fitbot` from a landing page + stub chat + standalone
appointments demo into the GitFit Suite: Supabase-authenticated app with
client/staff roles, a persistent chatbot overlay backed by a
deterministic-first intent router, and native schedule/member/retention
features — per the architecture pivot recorded in `docs/agent/decisions.md`
(2026-08-18).

This file is an index and sequencing plan, not itself an implementable
task. Each phase below gets its own `/start-task` run — its own brief,
investigation, plan, approval gate, implementation, review, and
verification — sized to the smallest reviewable unit per the project's
standard workflow.

## Preflight state (at time of writing)

- Branch: `main`, commit `3bd172d`, working tree clean.
- Existing code, reusable going forward:
  - `app/page.tsx` — branded landing page (single-product framing; becomes
    the seed for the multi-module suite landing page in Phase 2).
  - `app/chat/*`, `app/api/chat/route.ts` — chat UI shell + stub reply
    endpoint (no history persistence, no intent handling, no auth). Becomes
    the seed for the persistent chatbot shell (Phase 3) and intent router
    (Phase 4).
  - `lib/appointments-store.ts`, `app/api/appointments/*`,
    `app/appointments/*` — in-memory (resets on restart) schedule/booking
    logic hardcoded to one demo member, no auth. Real logic to migrate onto
    Supabase in Phase 6, once auth (Phase 1) exists.
  - `pulse-studio-prototype` submodule + its embed at `/appointments`
    (`appointments-prototype-embed` task) — a teammate's standalone static
    prototype, currently what actually renders at `/appointments`. Under
    the pivot this is legacy; Phase 2 or 6 should decide explicitly whether
    to remove the embed and restore/rebuild the native appointments page,
    rather than leaving two competing implementations.
- No auth exists anywhere yet (hardcoded `member_001`).
- No Supabase project/credentials configured yet — will need to be created
  before Phase 1 can implement against a real backend.

## Open flag carried from the architecture-pivot decision

User confirmed "still a 4-person team" in the same answer that approved the
full architecture pivot to this repo owning suite data directly. Working
interpretation (see `decisions.md`): the capstone team context is
unchanged, but this repo no longer waits on or integrates with teammates'
separate builds. If that's wrong — e.g. if `pulse-studio-prototype` or
another teammate product should remain the system of record for some
domain — say so before Phase 2 (landing page) or Phase 6 (appointments)
lock in the native-ownership assumption.

## Phase sequence (implementation priority, per user request)

Each phase = one future `/start-task` run. Risk/workflow classification per
`docs/agent/workflow.md`.

1. **Supabase auth + client/staff roles** — Architecture change +
   authentication + new dependency. Workflow: Argus → Athena → **approval**
   → Codex → Themis → Apollo, elevated scrutiny (touches
   `docs/agent/workflow.md`'s "Architecture change" and "Database/migration"
   rows). Establishes: Supabase project wiring, session handling, a
   `role` claim (`client` | `staff`), and the permission-check pattern every
   later phase's pages/API routes/chatbot tools reuse.
2. **GitFit Suite landing page + shared navigation** — Feature/UI change.
   Replaces `app/page.tsx`'s single-product framing with a multi-module
   suite entry point, role-aware (client vs. staff module visibility).
   Establishes the shared design-token/component system the visual redesign
   (Phase 12) will extend suite-wide. Decides the `pulse-studio-prototype`
   embed's fate (see open flag above).
3. **Persistent chatbot shell** — Feature. Chat overlay mounted at the
   authenticated-layout level (not per-page), collapsed/expanded states,
   conversation persisted (Supabase-backed, not just `useState`) so it
   survives navigation. No new intents yet — reuses the existing stub reply
   endpoint.
4. **Deterministic intent router** — Architecture change (new core
   subsystem). Defines the tool-call-shaped intent → handler contract
   ("additional intents and tools can be added later without rewriting the
   chatbot" is the acceptance bar), a null/fallback intent for
   not-yet-implemented or ambiguous requests, and per-role intent
   visibility. No real intents wired yet beyond a trivial example — this
   phase is the router's shape, not its coverage.
5. **Schedule queries + staff schedule questions** — Feature, first real
   intents on the router from Phase 4. Client-facing ("what's on the
   schedule tomorrow") and staff-facing (filter by date/instructor/class,
   fill/capacity questions) queries against Supabase schedule data.
6. **Appointment lookup + scheduling workflows** — Feature. Migrates
   `lib/appointments-store.ts`'s logic onto Supabase + real auth (per-user
   bookings, not hardcoded `member_001`), exposes it through the intent
   router (client: "what appointments do I have", book/modify; staff:
   who's booked for X).
7. **Staff member lookup** — Feature, staff-only. New data domain (member
   records, attendance/booking history) + new permission boundary (staff
   can view other users' data; clients cannot).
8. **Fitness guidance + workout planning** — First LLM-touching feature,
   but sequenced before Phase 11 to build the deterministic scaffolding
   (goals/time/equipment/level inputs, structured workout-plan output
   shape, rendering) that Phase 11 later plugs a real LLM into behind a
   stub/rules-based generator initially.
9. **Time-off request workflow** — Feature, staff-only. New data domain
   (staff time-off requests) + approval-workflow shape.
10. **Retention + promotional outreach workflows** — Feature, staff-only,
    highest scrutiny of the deterministic phases: identifies members for
    re-engagement, stages outreach/promotional messages, but per explicit
    user requirement, **any send action is gated behind an explicit staff
    confirmation step** — no autonomous sending. Treat the "send" action
    like `build-doc.md`'s `requires_confirmation` convention even though
    that doc's contract model itself is superseded.
11. **LLM integration** — New external dependency (LLM API) + cost/latency
    surface. Wires a real LLM behind the intent router's fallback path
    (Phase 4) and behind Phase 8's workout planner and Phase 10's outreach
    drafting. Elevated scrutiny: this is the one place natural-language
    input can influence application behavior beyond fixed intents — needs
    explicit review of how tool/action calls coming back from the LLM are
    validated before touching real data (per user's required flow: intent
    detection → deterministic tool if possible → LLM only when necessary →
    validated application action → response).
12. **Visual polish + suite-wide design consistency** — UI change, last on
    purpose: applies the design language established in Phase 2 across all
    modules built in between, upgrades empty/loading states, motion, and
    brings the chatbot's own UI (collapsed/expanded/messages/cards/
    confirmations) fully in line with the rest of the suite.

## Sequencing notes

- Phases 5–10 each depend on Phase 1 (auth/roles) and Phase 4 (router)
  being in place first; they are not independent of each other in the way
  the numbered list might suggest, but they are independent of *each
  other's* internal logic (schedule queries don't block member lookup).
- Phase 11 (LLM) is deliberately last among the functional phases so the
  deterministic surface area is as large as possible before any LLM call
  is introduced — matches the user's explicit deterministic-first
  requirement.
- Phase 12 (visual polish) is last so it doesn't get redone as new modules
  land.

## Out of scope for this brief

No implementation happens under this brief directly. This file exists to
get explicit sign-off on the phase sequence before Phase 1's own
`/start-task` run begins.
