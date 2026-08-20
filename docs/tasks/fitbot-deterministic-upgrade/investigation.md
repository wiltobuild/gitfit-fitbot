# Investigation: fitbot-deterministic-upgrade (Argus)

## Verified facts

### 1. Router & intent architecture

- `lib/chatbot/router.ts:5-21` — `routeMessage` iterates `intents` in array order, returns the first intent whose `roles.includes(session.role) && intent.match(message, session)` is true; on no match returns a fixed fallback string (`router.ts:18`) tagged `intentId: "fallback"`.
- `lib/chatbot/intents/index.ts:18` — registration order: `[help, myAppointments, bookClass, whoIsBooked, memberLookup, workoutPlan, timeOff, retentionLookup, outreachDraft, outreachSend, schedule]`. Comment (lines 14-17): more-specific intents ordered before `scheduleIntent` because its weak date-word fallback would otherwise win by registration order.
- 11 intents, one file each. Per-intent summary:
  - `help.ts`: `match` = substring check against `["help","what can you do","what can you help with"]`. `handle` returns a static role-specific blurb, no card, no data lookup.
  - `schedule.ts`: strong keywords OR weak date word AND NOT `otherIntentShaped` (`/\b(workout|exercise|training|off|pto)\b/i`). Queries `classes` with optional filters, returns `card: {kind:"schedule"}`.
  - `my-appointments.ts`: regex for "my appointments/bookings/classes". Queries `bookings` joined to `classes` for `session.user.id`, future only, returns schedule card.
  - `book-class.ts`: reserve/cancel phrasing. Resolves candidate classes, requires exact single match, inserts/deletes `bookings` rows directly. No card on success.
  - `who-is-booked.ts` (staff): roster phrase + class reference. Returns only `booked_count`/`capacity` — explicitly notes member names aren't available (seed `booked_count` has no matching `bookings` rows to name).
  - `member-lookup.ts` (staff): calls `searchMembers()` RPC, then queries `bookings` for the resolved member's future classes; returns `members` card.
  - `workout-plan.ts` (client+staff): see detailed sizing analysis below.
  - `time-off.ts` (staff): lookup vs. request patterns. Insert-only — **no update/cancel/approve path exists**.
  - `retention-lookup.ts` (staff): calls `listMembersForStaff()`, filters client-side for `lifecycle_status === "at_risk" || "lapsed"` — the only intent reading `lifecycle_status`.
  - `outreach-draft.ts` (staff): looks up member via `searchMembers`, inserts a fixed-template row (subject/body hardcoded beyond name).
  - `outreach-send.ts` (staff): flips latest draft to `sent`.

### 2. Workout generator sizing — user's claim verified accurate

`lib/chatbot/intents/workout-plan.ts`:
- `exerciseLibrary` (lines 19-64) defines exactly **6** populated goal×equipment pools: `strength×bodyweight` (4), `strength×dumbbells` (4), `strength×full-gym` (4), `cardio×bodyweight` (4), `flexibility×bodyweight` (4), `general×bodyweight` (4) — **24 total distinct exercises in the whole file**, plus 2 fixed warmup + 2 fixed cooldown exercises used for *every* plan.
- `parseGoal`/`parseEquipment`/`parseLevel` nominally support 4×3×3 = 36 combinations, but `selectExercises` falls back to `exerciseLibrary[goal].bodyweight` whenever `[goal][equipment]` is undefined — so `cardio`, `flexibility`, `general` **ignore equipment entirely**, always returning the same 4-exercise bodyweight pool. Only `strength` varies by equipment (3 pools).
- Level filtering removes at most 0-1 exercises per pool; doesn't add variety.
- `fillBlock` cycles the pool with `index % exercises.length` to fill duration — **longer durations repeat the same 3-4 exercise names**, they don't add new ones.
- **Conclusion**: ~6 real exercise pools × ~2 level-variants, warmup/cooldown 100% invariant across every plan. The true distinct-plan count is closer to "one or a few" than "dozens" — confirms rather than contradicts the user's claim.

### 3. Card rendering

- `RichCard` union (`lib/chatbot/types.ts:3-8`) has exactly 5 `kind` values: `schedule`, `members`, `workout`, `time-off`, `outreach`. `IntentResult = { reply: string; data?: unknown; card?: RichCard }`.
- `ChatCard` (`app/components/chat-cards.tsx:12-26`) is a single `switch(card.kind)`, one branch per kind, **no default/fallback branch** — an unrecognized `kind` silently renders nothing (no TS exhaustiveness `never` check either).
- All 5 kinds map to existing, populated CSS in `app/globals.css`: `.chat-card`/`.chat-schedule-card`/`.chat-schedule-row`/`.class-type-*`, `.chat-members-card`/`.chat-member-row`/`.member-initials`, `.chat-workout-card`/`.chat-workout-blocks`/`.chat-workout-row`, `.chat-outreach-card`/`.chat-outreach-member`/`.chat-outreach-message`/`.chat-outreach-actions`, plus shared `.badge` variants. The `time-off` kind reuses the `members` card classes rather than having its own.
- Card renders always pair with a `reply` string; the `<p>` is hidden via `sr-only` when a card is present (accessibility pattern to preserve for any new card kind).

### 4. Chat UI quick-suggestion flow — confirmed NOT guaranteed today

- `app/chat/chat-experience.tsx:12,58` — 3 starters (`"Help me plan my week"`, `"I need a quick workout"`, `"How do I build consistency?"`), shown only before the first exchange.
- `app/components/chatbot-overlay.tsx:16,105` — a *different* set of 3 starters (`"Plan my week"`, `"Give me a quick workout"`, `"Build consistency"`), same first-message-only gating.
- Both send the starter text as free text through the identical `routeMessage`/`match()` pipeline — **no dedicated guaranteed-intent path exists.**
- Concretely broken today:
  - `"How do I build consistency?"` / `"Build consistency"` match no intent → **fall through to the generic fallback**, directly violating the "guaranteed premade answer" requirement.
  - `"Help me plan my week"` contains `"help"`, and `helpIntent` (bare `.includes("help")`) is registered first → misfires to the generic help blurb, not `workoutPlanIntent`.
  - Even `"Plan my week"` (the overlay's version, no "help" substring) does reach `workoutPlanIntent` via `asksForWeeklyPlan`, but `handle()` has no actual weekly-plan behavior — runs the identical single-session generator as any other request (default 30 min, goal "general").

### 5. Dataset surface

- RLS-confirmed table access: `members` (staff-all / client-own), `bookings` (own-or-staff), `classes` (all authenticated), `chat_messages` (own-only), `time_off_requests` (staff-select-all, own-insert-only, **no UPDATE policy exists at all** — approve/deny isn't possible at the DB level today), `outreach_messages` (staff-only, no client access).
- `search_members`/`list_members_for_staff` RPCs (both `security definer`, staff-only) **only return** `id, email, full_name, auth_user_id, lifecycle_status, is_staff, created_at` — none of `goals`, `preferred_class_types`, `fitness_level`, `membership_tier`, `membership_status`, `last_visit_date`, `join_date`, `phone`, `birthdate`, `staff_notes`, `is_instructor` (all present on `members` per migration `0011`).
- `lib/members/queries.ts`'s `memberSelect` (line 15) selects a wider column set including `goals`/`preferred_class_types`/`fitness_level`/`membership_tier`/`last_visit_date`/`join_date`/`phone`/`birthdate` via `getMemberForUser`/`getMemberById` — **but neither function is called anywhere in `lib/chatbot/intents/`** today. Only `searchMembers`/`listMembersForStaff` are used.
- **No current intent reads**: `goals`, `preferred_class_types`, `fitness_level`, `membership_tier`, `membership_status`, `last_visit_date`, `join_date`, `phone`, `birthdate`, `staff_notes`, `is_instructor` — all real, unused columns. Prime candidates for new intents.
- `MemberRow` type (`lib/members/queries.ts:5-13`) only models the 7 narrow RPC columns — `getMemberForUser`/`getMemberById`'s wider results are effectively untyped for the extra fields today.

### 6. Other pages' underlying server logic

- `app/api/appointments/classes/route.ts`: GET, merges `classes` + caller's `bookings` into an `isBookedByCurrentUser` flag. Includes `duration_minutes`, which no chatbot intent currently selects.
- `app/api/appointments/reserve/route.ts`: POST, validates, pre-checks existing booking, inserts, maps Postgres errors to structured `{code, message, retryable}` JSON.
- `app/api/appointments/cancel/route.ts`: POST, deletes scoped to `user_id`, returns `not_booked` if nothing deleted.
- **Verified duplication**: `lib/chatbot/intents/book-class.ts` reimplements booking/cancellation directly against `bookings` with its own Supabase calls and its own error-string mapping — a **separate parallel implementation** of the same logic as the reserve/cancel routes (near-verbatim duplicate race-condition comment in both). Different error shapes (plain string vs. structured JSON). A new "let Fitbot book things" intent risks becoming a *third* implementation unless consolidated.
- `app/api/staff/members/route.ts`: thin wrapper directly calling `searchMembers()` — same function the chatbot intents already use, no duplication here.
- `app/dashboard/page.tsx`: computes this-week Mon-Sun booking count via `bookings` joined to `classes.class_date`, feeds a progress ring (target 4/week). This computation exists **only** on the dashboard; no intent computes it today.
- `app/staff/page.tsx`, `member-search.tsx`, `fitbot-tiles.tsx` exist but weren't read in this pass (see Unknowns) — flagged for Athena to confirm before finalizing staff-parity scope.

### 7. Session/role plumbing inside `handle()`

- `SessionUser = { user: User; role: "client"|"staff" }` (`lib/auth/session.ts`). Full Supabase `User` (id, email, etc.) already resolved and passed to every intent — no re-fetch needed for identity.
- No direct `members.auth_user_id` linkage is pre-resolved into the session — any intent needing the caller's own `members` row must call `getMemberForUser` itself. **No current intent does this** — `my-appointments.ts` queries `bookings` directly by `session.user.id`, bypassing `members` entirely.

### 8. Card CSS budget

Full reusable class list confirmed present in `globals.css` (see item 3). No orphaned chat-card CSS found.

### 9. Staff-page quick-prompt tiles (closes an Argus unknown)

- `app/staff/fitbot-tiles.tsx` — two more preset-prompt buttons, **separate from and in addition to** the chat/overlay starters: "Retention outreach" (`"draft a retention outreach for a member who hasn't booked in 30 days"`) and "Time-off coverage" (`"help plan instructor coverage for a time-off request"`). Both dispatch a `fitbot:open` custom event carrying the preset text, which `chatbot-overlay.tsx` listens for and drops into the input box — still free text through the same `routeMessage` pipeline once sent.
- Confirmed both are broken today for the same reason as the chat starters: "draft a retention outreach for a member who hasn't booked in 30 days" contains "booked" → matches `scheduleIntent`'s strong keyword list, returning a class schedule instead of an outreach draft. "help plan instructor coverage for a time-off request" contains "help" → matches `helpIntent` first, returning the generic capability blurb instead of anything about time-off coverage.
- `app/staff/member-search.tsx` — 3 more "Ask FitBot" buttons (empty-state, and one per search result row), all dispatching generic presets (`"look up a member"` / `"Ask FitBot about {name}"`) through the same event → same free-text pipeline.
- **This means there are three separate UI surfaces today** (chat page starters, overlay starters, staff page tiles) all suffering the identical architectural gap — a guaranteed-answer chip mechanism needs to fix/unify all three, not just the chat starters, for the brief's requirement to actually hold everywhere it appears.

## Inferences

- **(Medium confidence)** A guaranteed-deterministic quick-reply chip system needs a mechanism distinct from today's starter buttons — e.g., dispatching by a fixed intent id or a literal pre-baked `IntentResult`, not free text through `routeMessage`. Confirmed by the two concrete misfires above; nothing today short-circuits `match()`.
- **(Medium confidence)** Filtering members by `goals`/`fitness_level`/`preferred_class_types` across multiple rows likely needs a new RPC (mirroring the `security definer` + `is_staff` pattern) or a direct table select — `getMemberForUser`/`getMemberById` only fetch by a single known id, not by filter.
- **(Low-medium confidence)** Adding staff time-off approve/deny would need a new migration (no UPDATE RLS policy exists on `time_off_requests`) — likely out of the brief's "no schema changes" scope; Athena should flag/exclude or treat as an explicit exception.

## Unknowns

- `app/staff/page.tsx`, `app/staff/member-search.tsx`, `app/staff/fitbot-tiles.tsx` not read in full this pass — relevant to requirement #3 (staff page parity).
- Exact seed data shape/diversity of `fitness_level`/`goals`/`preferred_class_types` values wasn't queried live — affects how "intelligent" a new data-driven intent can look in practice.
- No runtime confirmation that an unhandled `RichCard.kind` truly renders blank (verified structurally via the missing `default` case only).

## Risks

- **Fallback-contract violation is already latent, not hypothetical** — 2 of 6 existing starter chips already fall through to the generic fallback today. Any "guaranteed chip answer" plan must fix or retire these, or the acceptance criterion is false on day one.
- **Intent-ordering fragility** — strict first-match linear scan, already has documented collision fixes (`otherIntentShaped`, `timeOffShaped`). The `"Help me plan my week"` → `helpIntent` misfire is a live example; more intents raise collision surface.
- **Duplicated booking logic** (`book-class.ts` vs. the reserve/cancel API routes) — any new "perform an action" intent risks becoming a third implementation unless Athena's plan explicitly consolidates.
- **Workout "dozens of distinct plans" is a real content-authoring lift**, not a wiring fix — only 6 real exercise pools (24 exercises) exist today; hitting "dozens" requires substantially expanding authored content, sized to how literally "dozens" is interpreted.
- **`RichCard` union has no exhaustiveness guard** — extending it is mechanically easy, but a card kind added to `types.ts` without a matching `chat-cards.tsx` case silently renders blank rather than erroring. Worth flagging for Themis's review specifically.
