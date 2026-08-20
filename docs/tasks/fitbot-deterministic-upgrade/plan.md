# Plan: fitbot-deterministic-upgrade (Athena)

## Decision: Guaranteed-answer quick-reply chip mechanism

### Evidence
`routeMessage` (`lib/chatbot/router.ts:5-21`) is the only entry point from `/api/chat`, and it always runs free text through `intent.match()` with no bypass. Argus confirmed three separate UI surfaces feed it free text today — chat page starters (`app/chat/chat-experience.tsx:12,58`), overlay starters (`app/components/chatbot-overlay.tsx:16,105`), and staff tiles/search buttons (`app/staff/fitbot-tiles.tsx`, `app/staff/member-search.tsx`, via the `fitbot:open` CustomEvent) — and named four concrete misfires: `"How do I build consistency?"` → fallback; `"Help me plan my week"` → `helpIntent`; the retention-outreach tile → `scheduleIntent` (via "booked"); the time-off-coverage tile → `helpIntent` (via "help"). `IntentResult = { reply; data?; card? }` and `/api/chat`'s `POST` returns `{ reply, card }` after persisting both sides to `chat_messages` — a chip path needs to produce the same shape and hit the same persistence, or transcripts become inconsistent.

### Options
1. **Client-side canned replies** — hardcode chip text/response pairs in the React components, skip the API entirely on click.
2. **`chipId` → server-side lookup table, new API path, bypasses `routeMessage`.** Each chip carries a stable `chipId` (e.g. `"weekly-plan"`, `"retention-outreach-30d"`, `"time-off-coverage"`, `"build-consistency"`). `/api/chat` accepts an optional `chipId` field; when present, it looks up a handler from a new `lib/chatbot/chips.ts` registry (`Record<string, (session: SessionUser) => Promise<IntentResult>>`) instead of calling `routeMessage`. Handlers reuse real intent logic where the underlying intent already does the right thing, or are new small dedicated handlers where no intent fits. Same persistence path so transcripts stay coherent; the "user" message stored is the chip's display label, not raw params.
3. **Keep free text but make `match()` bulletproof for a fixed known-string set** — add exact-string fast-path branches ahead of the linear scan.

### Recommendation
Option 2.

### Why
Option 1 breaks the acceptance criterion that chip answers persist and render identically to normal chat turns. Option 3 still routes through fragile keyword matching — a future edit to `helpIntent`'s keywords could silently re-break a chip, and it doesn't fix the "staff page opens the overlay with free text" architecture. Option 2 is a genuine bypass: chip clicks never touch `match()`, so no future keyword change can break them.

This directly retires the three broken surfaces: chat-page and overlay starters become chip buttons with `chipId`s instead of free-text strings; staff tiles and member-search buttons switch their `fitbot:open` event payload from `{ preset: string }` to `{ chipId: string, memberId?: string }`. The two confirmed-broken tiles (retention outreach, time-off coverage) get real handlers instead of coexisting as still-broken free-text buttons.

### Approval requested
Confirm: (a) chip payload shape (`chipId` + optional structured params, not free text) is acceptable; (b) it's fine for the stored "user" chat message to be the chip's human-readable label rather than literal free text; (c) approve the initial chip set — proposed: `quick-workout`, `plan-my-week`, `build-consistency` (client); `retention-outreach`, `time-off-coverage`, `member-lookup` (staff tiles), plus member-search's per-row "Ask FitBot about {name}" becoming a `member-summary` chip with `memberId`.

---

## Decision: Workout library sizing — concrete target

### Evidence
Argus verified only 6 real goal×equipment pools (24 exercises), with `cardio`, `flexibility`, `general` collapsing to bodyweight regardless of equipment input, and warmup/cooldown 100% invariant. `parseGoal`/`parseEquipment`/`parseLevel` already support 4 goals × 3 equipment × 3 levels = 36 combinations nominally; the gap is authored content, not wiring.

### Options
1. **Minimal fix**: add equipment variants only for `cardio`/`flexibility`/`general`, keep 4 exercises per pool. Yields 4 goals × 3 equipment = 12 pools × 4 exercises = 48 exercises, ~12 distinct main-block pools.
2. **Target scope**: 4 goals × 3 equipment = 12 pools, 6-8 exercises each (~150-190 total exercises), plus 3 warmup and 3 cooldown *variants* selected by goal (not fully invariant).
3. **Full combinatorial exhaustiveness**: every goal×equipment×level cell gets a fully distinct pool (36 cells) — largest authoring lift.

### Recommendation
Option 2: 4 goals × 3 equipment = 12 pools, each with 6-8 exercises tagged by level (reusing the existing `levels: Level[]` tagging), plus 3 warmup and 3 cooldown variants keyed by goal.

### Why
This hits "dozens" honestly and fixes a real gap Option 1 leaves: warmup/cooldown identical on every single plan regardless of goal is a "still looks recombined" tell, since warmup/cooldown are the first and last thing rendered in every card. Option 3's 200+ exercises is a disproportionate authoring lift for the Aug 28 ship date versus the marginal realism gain.

### Approval requested
Confirm the target shape (12 main pools × 6-8 exercises, 3 warmup variants, 3 cooldown variants, selected by goal) and confirm "dozens" is satisfied by this combinatorial count rather than requiring literally 24+ hand-written complete plans. Confirm no new goal/equipment enum values are wanted — scope stays within the 4 existing goals and 3 existing equipment types.

---

## Decision: New intents that read previously-unused member-data fields

### Evidence
`lib/members/queries.ts`'s `getMemberForUser`/`getMemberById` already select `goals`, `preferred_class_types`, `fitness_level`, `membership_tier`, `membership_status`, `last_visit_date`, `join_date`, `phone`, `birthdate` but are called by zero intents. `search_members`/`list_members_for_staff` RPCs only return 7 narrow columns.

### Options for the staff-filtering gap
1. **New RPC** mirroring migration 0012's `security definer` + `is_staff` pattern, returning the wider column set for multi-row staff queries.
2. **Client-side compose**: loop `getMemberById` per row after `listMembersForStaff()` — N+1 queries, worse.

### Recommendation
Client-facing intent (self-data): `getMemberForUser` directly, no RPC change.
Staff-facing filtering intent: Option 1, a new RPC — additive function, not a table/column change.

### New intents proposed
- **`my-goals`** (client): matches "what should I train for" / "my goals" / "my fitness level". Calls `getMemberForUser`, reads `goals`/`fitness_level`/`preferred_class_types`. Cross-references `preferred_class_types` against upcoming `classes.type`.
- **`my-activity`** (client): matches "when did I last visit" / "how am I doing" / "my activity". Reads `last_visit_date`/`membership_tier`/`join_date`, plus reuses the dashboard's weekly-booking-count computation.
- **`members-by-attribute`** (staff): matches "members interested in yoga" / "beginners who haven't been in a while". Calls the new RPC filtering by `preferred_class_types`/`fitness_level`/`last_visit_date`, returns a `members` card.

### Approval requested
Approve adding one new RPC (`search_members_by_attributes`), `security definer`, staff-gated exactly like existing RPCs. Confirm this counts as "no schema changes" per the brief (a function + grant, not a table/column) — the one place this plan touches the database.

---

## Decision: Which "other page" action Fitbot gains, and de-duplicating booking logic

### Evidence
`book-class.ts` independently reimplements insert/delete against `bookings`, near-verbatim duplicating logic already in `app/api/appointments/reserve/route.ts` and `.../cancel/route.ts`, but with divergent error shapes (plain string vs. structured `{code,message,retryable}` JSON).

### Options
1. **Extract a shared function** (`lib/appointments/booking.ts`: `reserveBooking`/`cancelBooking`) that both the API routes and `book-class.ts` call.
2. **Leave duplication, be careful** — accept divergence risk.
3. **Intent calls the HTTP API routes internally** (fetch loopback) — adds network overhead and auth-forwarding complexity.

### Recommendation
Option 1.

### Why
Collapses existing duplication from 2 implementations to 1 shared function + 2 thin callers, and gives `book-class.ts` the structured error codes it's missing today — a strict improvement, not just future-proofing.

### New "perform an action" intent scope
No new booking intent needed — `book-class.ts` already covers it. Requirement #3 is satisfied by (a) the booking consolidation, and (b) `my-activity`'s reuse of dashboard logic Fitbot didn't have before.

**Explicitly excluded**: time-off approve/deny — no UPDATE RLS policy exists on `time_off_requests`; adding it is a schema migration, out of this brief's stated scope. Flagged as a separate future task if wanted.

### Approval requested
Confirm extracting shared `reserveBooking`/`cancelBooking` helpers (touching `book-class.ts` and both API routes) is acceptable scope. Confirm time-off approve/deny stays excluded.

---

## Decision: RichCard extensibility — exhaustiveness guard and new card kinds

### Evidence
`ChatCard`'s `switch (card.kind)` has no `default` case — an unhandled kind renders nothing.

### Options
1. Add a `default` branch with a `const _exhaustive: never = card; return null;` pattern — a missing case becomes a compile error, not a silent blank render.
2. Leave as-is, rely on manual review.

### Recommendation
Option 1, plus reuse existing kinds wherever the shape fits rather than inventing one-off kinds.

### Why
Converts "new intent ships, card silently blank" into "build fails, caught before merge" — a few lines, zero runtime cost.

### New card kinds needed
`my-goals`/`my-activity` and `members-by-attribute` all reuse the existing `members` card kind (single-member array works for the profile-style cards too). **Net new kinds: 0 required, 1 possible (`profile`)** — decided during implementation only if visual review shows `members`-kind reuse doesn't fit.

### Approval requested
Confirm the exhaustiveness-guard addition (mechanical, low-risk) and the "reuse `members` kind before inventing `profile`" approach.

---

## Decision: Router collision management as intent count grows

### Evidence
Router is a strict first-match linear scan, already has two documented collision guards, and one live unfixed collision (`"Help me plan my week"` → `helpIntent`). This plan adds ~3 new free-text intents — the chip system explicitly bypasses the router, so it adds zero collision surface.

### Options
1. Keep the existing pattern: careful keyword specificity, add `xShaped` exclusion guards as needed.
2. Introduce a scored-match system (each intent's `match` returns a confidence score).

### Recommendation
Option 1, plus fix the pre-existing `helpIntent`/`workoutPlanIntent` collision as part of this work.

### Why
Only 3 new free-text intents are being added — a small, boundable increase that doesn't justify a scored-matcher rewrite's own new risk surface (tie-breaking becomes its own bug source).

### Approval requested
Confirm keeping the linear-scan-with-guards pattern, and confirm fixing the `"Help me plan my week"` misfire is in scope (independent of chip work, since some users will still type this).

---

## Decision: "Dozens of templates" — combinatorial vs. fixed pre-written plans

### Evidence
User said they like the existing output *format*. The existing architecture already combinatorially generates duration/level-adaptive plans — fixed templates would lose that.

### Options
1. Combinatorial: expand exercise pools, keep generating at request time.
2. Fully pre-written fixed template plans, matched by closest params.
3. Hybrid: combinatorial generation stays primary, plus the `quick-workout` chip uses a fixed, curated param set (not the generic "general/30min/beginner" default) for a guaranteed strong first impression.

### Recommendation
Option 3.

### Why
Fixed templates alone sacrifice duration/level adaptivity, a real working feature. Pure combinatorial generation already satisfies "dozens" once the pool expansion lands. The hybrid just ensures the guaranteed-answer chip shows a good example, not the least differentiated combination.

### Approval requested
None beyond the above two decisions — this just confirms the mechanism choice.

---

## Phased plan

**Phase 1 — Workout library expansion.** Expand `exerciseLibrary` to 12 goal×equipment pools (6-8 exercises each), add 3 warmup + 3 cooldown variants keyed by goal. No intent-matching changes.

**Phase 2 — New data-driven intents.** Add `my-goals`, `my-activity` (client), `members-by-attribute` (staff), the new `search_members_by_attributes` RPC + migration, wire `getMemberForUser` into client intents for the first time.

**Phase 3 — Quick-reply chip system + fixing the 3 broken surfaces.** Add `lib/chatbot/chips.ts` registry, extend `/api/chat` to accept `chipId`, convert chat-page/overlay starters and staff tiles/search buttons to chip dispatch.

**Phase 4 — RichCard safety + any new card kinds.** Add exhaustiveness guard to `ChatCard`. Confirm Phase 2's intents render via reused `members` kind (or add `profile` if needed).

**Phase 5 — Booking-logic consolidation.** Extract `reserveBooking`/`cancelBooking` into a shared module, repoint `book-class.ts` and both API routes. Fix the `helpIntent`/"plan my week" collision in this phase too.

## Acceptance criteria

1. `exerciseLibrary` has 12 goal×equipment pools with 6+ exercises each (72+ total) plus 3 warmup and 3 cooldown variants — verify by counting entries.
2. Three new intents (`my-goals`, `my-activity`, `members-by-attribute`) each read at least one of `goals`/`fitness_level`/`preferred_class_types`/`last_visit_date`/`membership_tier`.
3. Booking consolidation: API routes and `book-class.ts` both call the same exported `reserveBooking`/`cancelBooking` function, no duplicate insert/delete logic remains.
4. Every chip in `lib/chatbot/chips.ts` is exercised end-to-end (chat page, overlay, staff page) and returns a non-fallback response — verify by manual click-through plus checking `chat_messages` rows.
5. `ChatCard`'s switch has an exhaustiveness `never` guard — verify `tsc --noEmit` fails on an unhandled kind (test then revert).
6. Existing 11 intents' behavior unchanged except the deliberate `helpIntent` fix; the two previously-broken staff tiles now produce their intended replies.
7. No table/column schema changes; the one new RPC is additive only.

Not implemented yet — stopping here for approval on the seven decisions above before any Codex work begins.
