# Plan: fitbot-intelligence-upgrade (Athena, v2 — supersedes v1 in full)

Grounded in `docs/tasks/fitbot-intelligence-upgrade/brief.md` (including the
"Scope revision" section), `investigation.md`, and `investigation-followup.md`.
This is a full replacement of `plan.md`. Old Decision 1 (padded to 8 intents)
and old Decision 3 (fallback-as-suggestions as a standalone mechanism) are
**replaced**, not amended, per the brief's scope revision. Old Decisions 2, 4,
and 5 carry forward, lightly updated for consistency with the decisions below.

Decision numbering in this version is new and does not match v1's numbering.

---

## Decision 1: Conversation-memory storage architecture (NEW — centerpiece)

### Evidence
`investigation-followup.md` §1–3: `app/api/chat/route.ts` POST calls
`routeMessage(message, session)` with no history or context fetched or
passed; grepped `lib/chatbot/*` for `pending|clarif|awaiting|slot` — zero
hits. `chat_messages` (`0003_chat_messages.sql`) has `id, user_id, role,
content, created_at`, own-row RLS, and an index on `(user_id, created_at)` —
an ordered "last N for this user" read is index-backed and cheap, but there
is no structured/JSON column to hold anything beyond raw text. No
`runtime = "edge"` override, no custom server, no `vercel.json` pinning a
long-running process — `app/api/chat/route.ts` is a standard Route Handler,
which on Vercel deploys as a serverless function with no guaranteed instance
reuse between a user's consecutive turns. In-process memory (a module-level
`Map`, etc.) is therefore not safe; DB-backed state is the only
architecturally sound option, confirmed high-confidence by investigation.

### Options
1. **In-process memory (module-level cache/Map).** Rejected outright —
   investigation found no deployment guarantee of instance reuse; this would
   work in local dev and silently fail intermittently in production, the
   worst possible failure mode (looks fine in testing, flaky in the field).
2. **Reuse `chat_messages` alone, read-only lookback, no new table.**
   Sufficient for pronoun/shorthand resolution (re-read the last N rows,
   re-parse entities out of prior `content` text). Not sufficient for
   slot-filling, which needs a machine-readable "this reply is a question
   awaiting a specific answer, for this intent, with these args already
   filled" marker — re-parsing free text to recover that structure on the
   next turn is fragile and duplicates entity-extraction work per turn.
3. **One new table, `chat_context`, serving both sub-features** with a
   generic JSON payload column, one row per user (upsert), holding both
   "recently discussed entities" and "pending clarification" in the same
   blob.
4. **Two mechanisms: read-only lookback over `chat_messages` for pronoun
   resolution, plus one new narrow table for pending clarification only.**

### Recommendation
Option 4, matching investigation's medium-confidence inference. These are
genuinely different access patterns and different lifecycles:

- **Pronoun/shorthand resolution** ("that one," "her too") is read-only,
  best-effort, and naturally decays — the last 1-2 exchanges are the only
  useful signal, and `chat_messages` already has the exact index needed
  (`(user_id, created_at)`). No new table: on each request, fetch the last
  ~6 messages for `session.user.id`, and re-run each intent's own (now
  centralized, per Decision 4) entity-extraction over the most recent
  assistant reply's referenced entities (the reply's own resolved
  class/member, tracked structurally — see below) plus the current message.
  This does not need a write path or a schema change, only a read.
  Concretely: extend `IntentResult` with an optional `resolvedEntities`
  field (e.g. `{ classId?: string; memberId?: string; date?: string }`) that
  intents populate when they resolve a concrete class/member/date, and log
  that alongside `role: "assistant"` in `chat_messages`. This does need one
  schema addition — see below — but it's additive metadata on an existing
  write, not a new store.
- **Slot-filling's pending clarification** needs an explicit write-a-flag,
  consume-it-once, expire-if-stale record — a distinct table, `chat_pending_clarifications`,
  because it is not "history to skim," it is a specific piece of state that
  must be atomically present-or-absent and cleared on use (re-reading recent
  messages and trying to infer "was the last assistant turn a pending
  question" from free text is exactly the fragility investigation flagged).

**Concrete schema** (see Decision 10 for whether this ships as one migration
combined with the old-Decision-4 persistence fix, or two):

```sql
-- Structured resolved-entity metadata on assistant turns, for pronoun/shorthand lookback.
alter table public.chat_messages
  add column resolved_entities jsonb;

-- Pending clarification: one open slot-filling question per user at a time.
create table public.chat_pending_clarifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intent_id text not null,
  partial_args jsonb not null default '{}'::jsonb,
  missing_slot text not null,
  prompt text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

alter table public.chat_pending_clarifications enable row level security;

create policy "chat_pending_clarifications_select_own"
on public.chat_pending_clarifications
for select
to authenticated
using (user_id = auth.uid());

create policy "chat_pending_clarifications_insert_own"
on public.chat_pending_clarifications
for insert
to authenticated
with check (user_id = auth.uid());

create policy "chat_pending_clarifications_delete_own"
on public.chat_pending_clarifications
for delete
to authenticated
using (user_id = auth.uid());

create unique index chat_pending_clarifications_user_id_idx
on public.chat_pending_clarifications (user_id);
```

The `unique index on user_id` enforces "at most one open clarification per
user" at the DB level (a new one always replaces/`upsert`s the old — see
Decision 2 for what happens if a second unrelated question arrives before
the first is answered). No `update` policy is needed: the row is only ever
inserted (new pending question) or deleted (answered/expired/abandoned),
never edited in place. RLS mirrors `chat_messages`' own-row select/insert
pattern, extended with an own-row delete since this table's lifecycle
requires consuming (deleting) a row, which `chat_messages` never needs.

### Why
Splitting the two mechanisms avoids forcing a read-only, best-effort,
naturally-decaying feature (pronoun resolution) into the same strict
contract a slot-filling answer needs (atomic present/absent, one row,
explicit expiry). A single shared "context blob" table (Option 3) would
need to encode both a decaying history view and a strict single-pending-item
invariant in one ad hoc JSON shape, which is more complex to reason about
correctness for than two purpose-built, narrow structures. The `chat_messages.resolved_entities`
addition is minimal (one nullable jsonb column on an existing table,
populated only when an intent resolves something concrete) rather than a
parallel history store.

### Approval requested
This is a new decision, not previously approved. Needs explicit sign-off on:
(a) the two-mechanism split (read-only lookback vs. dedicated pending-clarification
table) rather than one unified context store; (b) the concrete schema above,
including the 10-minute default expiry (tunable, see Decision 2) and the
`user_id` uniqueness constraint (at most one open clarification at a time);
(c) whether `chat_pending_clarifications` and the `resolved_entities` column
addition to `chat_messages` ship as part of the same migration as
old-Decision-4's persistence fix (see Decision 10).

---

## Decision 2: Real slot-filling mechanism (NEW)

### Evidence
`investigation-followup.md` §4: `IntentResult` has no field for "this reply
is a question awaiting a specific answer." `Intent.handle` takes no "answer
this pending question" parameter. `routeMessage` has no pre-routing check
for a pending clarification — every message goes straight to normal
scoring. Every existing "ask a clarifying question" branch today
(`who-is-booked.ts:30-33`, `book-class.ts` disambiguation, etc.) is a
disambiguation list requiring the user to restate the whole request, never a
targeted single-field prompt whose next answer is consumed specially. This
is a real type/signature change, not a copy change.

### Options
1. **No structured hook — infer from message history whether the last
   assistant turn "looked like" a question.** Rejected: fragile string
   matching, no clean way to carry forward the partially-filled args or know
   which single slot is missing.
2. **Structured pending-clarification record (per Decision 1's schema),
   checked before normal routing; `Intent.handle` gains an optional third
   parameter carrying the resolved answer merged into args.**
3. **Full slot-filling state machine per intent** (a formal multi-turn
   dialogue graph). Rejected as over-engineering for this app's actual
   need — only single-slot gaps ("which class," "which member") have been
   identified as needing this, not multi-step wizards.

### Recommendation
Option 2. Concrete flow:

1. **Type changes** (`lib/chatbot/types.ts`):
   ```ts
   export type IntentResult = {
     reply: string;
     data?: unknown;
     card?: RichCard;
     suggestedChips?: ChipId[];
     resolvedEntities?: { classId?: string; memberId?: string; date?: string };
     needsClarification?: { missingSlot: string; partialArgs: Record<string, unknown>; prompt: string };
   };

   export type Intent = {
     id: string;
     description: string;
     roles: Array<"client" | "staff" | "admin">;
     match: (message: string, session: SessionUser) => number;
     handle: (
       message: string,
       session: SessionUser,
       pendingAnswer?: { partialArgs: Record<string, unknown>; missingSlot: string },
     ) => Promise<IntentResult> | IntentResult;
   };
   ```
   An intent that resolves ambiguity for itself sets `needsClarification`
   instead of falling through to a disambiguation-list reply, when the
   condition is specifically "score > 0 but exactly one required slot is
   missing" (see Decision 6 for the split against near-miss suggestions,
   which is a different condition). Intents that keep their existing
   disambiguation-list behavior (0 or >1 matches) are unaffected by this
   decision — Decision 2 only adds a new branch, it doesn't replace multi-match
   disambiguation (see Decision 6).

2. **Pre-routing check** (`routeMessage`, before the normal scoring loop):
   - Look up the caller's row in `chat_pending_clarifications` (by
     `user_id`, one row max per the unique index).
   - If none, or `expires_at < now()`, proceed with normal routing
     unchanged (and opportunistically delete an expired row).
   - If present and unexpired: **don't assume the message answers it.**
     Re-run normal intent scoring on the raw message first. If the
     top-scoring intent is the *same* `intent_id` as the pending
     clarification (or, if nothing scores above 0, treat the message as a
     literal slot answer since there's no competing interpretation), call
     that intent's `handle` with `pendingAnswer` set. If a *different*
     intent scores clearly higher than 0, the user has moved on — drop the
     pending clarification (delete the row) and route normally to the new
     intent, without forcing the old question onto an unrelated message.
     This directly answers the brief's "doesn't look like an answer" case:
     graceful drop, not a forced bad-match.
   - After a successful slot-filling completion (the intent no longer sets
     `needsClarification`), delete the pending row.

3. **Staleness/expiry**: `expires_at` default `now() + 10 minutes`,
   consistent with this being a synchronous chat UI where a 10-minute gap
   plausibly means the user got distracted or the tab sat idle — long enough
   to survive a slow typing pause, short enough that a stale question from
   an earlier session won't resurface unexpectedly. Recommend making this a
   named constant (`PENDING_CLARIFICATION_TTL_MINUTES`) rather than a magic
   number, so it's trivially tunable without touching the routing logic.

4. **Second clarification request while one is already open**: the unique
   index means a new `needsClarification` from a *different* intent
   (reached because the user's message scored highest for it, per the
   "moved on" branch above) simply upserts and replaces the old row — first-class
   support for "user changed their mind mid-flow," not an error case.

### Why
Checking the pending clarification against a fresh scoring pass first
(rather than blindly treating the next message as the answer) is the
concrete mechanism for the brief's explicit requirement that an unrelated
next message shouldn't be force-interpreted as a bad answer. Putting the
check before normal routing, but not exclusively gating on it, keeps normal
routing as the single source of truth for "what does this message most
resemble" — slot-filling only wins when it's still the best explanation.

### Approval requested
New decision. Needs sign-off on: (a) the `IntentResult`/`Intent.handle`
signature change (breaking change touching all 19 existing intents, even
though only a handful will use the new parameter — every intent's `handle`
signature must accept and typically ignore the third parameter); (b) the
"re-score first, only consume as an answer if the same intent still wins or
nothing else scores" reconciliation rule; (c) the 10-minute default TTL.

---

## Decision 3: Typo/fuzzy tolerance mechanism (NEW)

### Evidence
`investigation-followup.md` §6: no fuzzy-matching/edit-distance dependency
in `package.json`. Candidate sets are small and closed: 3 instructors, 3
class types (4 in `members-by-attribute.ts`, see Decision 4's note on that
drift), 7 weekdays, and member/instructor full names checked against a
bounded roster rather than arbitrary free text. A ~15-line deterministic
edit-distance function is plausibly sufficient.

### Options
1. **New npm dependency** (e.g. `fastest-levenshtein`, `fuse.js`). Rejected:
   scale doesn't warrant it, and the brief's existing "deterministic, no
   ML/AI dependency" constraint (from `fitbot-capability-expansion`, still
   in force) leans toward keeping this in-house and auditable.
2. **~15-line in-house Levenshtein/edit-distance function, applied only
   against bounded candidate lists, with a length-scaled distance
   threshold.**
3. **Prefix/substring fuzziness only** (no edit distance at all, just
   looser `includes`/`startsWith` matching). Rejected: doesn't address the
   brief's explicit "typo tolerance" ask — a transposition or single
   dropped letter often fails prefix matching too (e.g. "yoag" for "yoga").

### Recommendation
Option 2. Confirmed: no new dependency.

**Placement**: centralized in the shared entity-extraction module from
Decision 4 (`lib/chatbot/entity-extraction.ts`), as a single
`fuzzyMatch(input: string, candidates: string[]): string | undefined`
helper used by the centralized instructor/class-type/weekday resolvers
(and, more cautiously, member-name lookups in `member-lookup.ts` /
`who-is-booked.ts`, where the candidate list is larger and typo-collision
risk is higher — see threshold policy below). Centralizing here means the
fuzzy layer is written once and gets picked up automatically as each
intent's date/instructor/class-type/weekday parsing is migrated onto the
shared module — there is no value in writing it six separate times only to
then centralize it in a follow-up pass.

**Distance threshold policy** (length-scaled, to avoid false positives on
short strings):
- Length ≤ 4 chars (e.g. "hiit"): exact match only, distance 0. A distance-1
  tolerance on a 4-letter word risks matching an unrelated 4-5 letter word
  (e.g. accidentally matching "hilt" or "hint").
- Length 5–7 chars (e.g. "yoga" is 4 so falls above; "cycling" is 7, most
  instructor first names): distance ≤ 1.
- Length ≥ 8 chars (full names, "wednesday"): distance ≤ 2.
- Only ever match against the exact bounded candidate list for that field
  (never free text) — a fuzzy match against a wrong-field candidate list
  (e.g. testing a class-type typo against the instructor list) is out of
  scope, matching is always "this token vs. this field's own closed set."
- If a token fuzzy-matches more than one candidate at the same minimal
  distance, treat it as no match (ambiguous) rather than guessing — falls
  through to the intent's normal 0/multi-match handling, consistent with
  today's behavior on a genuinely-absent term.

### Why
The threshold scaling directly answers the brief/investigation's concern
about false-positive matches on short strings — a flat "distance ≤ 2 for
everything" would let a 3-letter typo match almost anything. Centralizing
avoids a second future clean-up pass identical to the one already
identified for date/time/instructor/weekday duplication.

### Approval requested
New decision. Needs sign-off on: (a) no new dependency (in-house
implementation); (b) the length-scaled threshold table above (exact values
are a judgment call, not derived from data — reasonable to adjust during
implementation but the *shape* of the policy should be confirmed now); (c)
the "ambiguous tie = no match" rule.

---

## Decision 4: Entity-extraction centralization (NEW)

### Evidence
`investigation-followup.md` §5: 6 date-parsers (5 near-identical,
`studio-capacity.ts` deliberately different — checks `tomorrow` before
`today` and falls back to **today's date** instead of `undefined` when
nothing matches). 3 identical time-parsers. 5 duplicate instructor-list
occurrences across 4 files. 6 files with the same 7-value weekday list.
Class-type list duplicated in 4 files as `["yoga","cycling","hiit"]`, except
`members-by-attribute.ts`'s superset (`"pilates"`, `"strength"`, `"cardio"`)
which doesn't match `classes.type`'s real seed values (Yoga/Cycling/HIIT
only) — pre-existing drift, unrelated to this task's origin but touched by
this centralization.

### Options
1. **Leave duplication as-is, add fuzzy matching independently in each of
   the ~6 call sites.** Rejected: the same 15-line fuzzy function pasted 6
   times is exactly the kind of duplicated-logic bug surface already found
   and fixed earlier in this project (per the brief's own framing) — doing
   it again here would be repeating the mistake inside the same task that
   calls it out.
2. **Centralize into one shared module, `lib/chatbot/entity-extraction.ts`,
   exporting `resolveDate`, `resolveTime`, `resolveInstructor`,
   `resolveClassType`, `resolveWeekday`, and the new `fuzzyMatch` helper;
   migrate all 6+ call sites onto it.**
3. **Centralize only the parts needed for fuzzy matching (instructor/class-type/weekday
   lists), leave date/time parsing duplicated since it's lower-risk
   duplication.** Rejected: date-parsing is the largest duplication (6
   implementations) and the one place a real behavioral divergence
   (`studio-capacity.ts`'s fallback-to-today) needs to be preserved
   explicitly rather than silently lost during a partial refactor — better
   to do this once, deliberately, than leave it half-migrated.

### Recommendation
Option 2. `resolveDate` takes an explicit `{ fallbackToToday?: boolean }`
option (default `false`, matching every parser except `studio-capacity.ts`);
`studio-capacity.ts` passes `{ fallbackToToday: true }` explicitly at its
call site, so the behavioral divergence investigation flagged is preserved
as a visible parameter, not silently dropped in the refactor. `resolveClassType`
takes the real 3-value closed set (`yoga`, `cycling`, `hiit`) as the
canonical list; `members-by-attribute.ts`'s extra `pilates`/`strength`/`cardio`
values are **flagged and fixed as part of this centralization**, not carried
forward or left as a separate follow-up — the moment they're being unified
into one canonical list is the natural point to correct known drift, and
leaving a stale 4th/5th/6th value in the canonical list would mean fuzzy
matching against ghost class types with real seed data never producing
those results (silently confusing, not neutral).

### Why
This is a direct prerequisite for Decision 3 (no point building fuzzy
matching in 6 separate places) and pays down real, already-identified
duplication risk (a future date-format change would otherwise require
touching up to 6 files and could easily miss one). Fixing the
`members-by-attribute.ts` drift now, while the canonical list is being
defined, is lower-risk than fixing it as an unrelated follow-up task later
(when it would require re-discovering the same investigation finding).

### Approval requested
New decision. Needs sign-off on: (a) the centralization itself and its
scope (date/time/instructor/class-type/weekday, all folded into one
module); (b) the `fallbackToToday` explicit-parameter approach for
preserving `studio-capacity.ts`'s divergence; (c) fixing the
`members-by-attribute.ts` class-type drift as part of this phase rather
than filing it separately.

---

## Decision 5: The 3 new capabilities (brief-scoped, existence pre-approved — document concretely)

### Evidence
`investigation-followup.md` §7–9 confirms all three are buildable as
scoped. Existence of these three is settled by the brief's scope revision;
this section documents the concrete shape, which is not yet approved in
detail.

### 5a. `who-is-booked` real attendee names
- Join `bookings.user_id → members.auth_user_id → members.full_name` for
  the resolved class (single-match branch only — the existing >1-match
  disambiguation branch is unaffected structurally, though it migrates to
  the `disambiguation` RichCard kind per Decision 8).
- **Honesty-constraint wording** (per investigation's flagged wrinkle:
  `booked_count` can exceed the count of nameable attendees for classes with
  seed-phantom padding): when `named attendees < booked_count`, the reply
  must not imply the named list is exhaustive. Recommended phrasing:
  `"${label(classRow)} has ${bookedCount} of ${capacity} spots booked. ${namedCount} attendee(s) on record: ${names.join(", ")}."`
  when `namedCount < bookedCount`, versus a plain `"...booked. Attendees: ${names.join(", ")}."`
  when they match exactly — the qualifier ("on record") only appears when
  there's a real gap, so it doesn't read as boilerplate hedging on every
  reply.
- Open item carried from investigation's Unknowns: whether staff/admin
  accounts that book classes should also resolve via `profiles.full_name`
  in addition to `members.full_name` (both join paths exist and are
  populated). Recommend joining both and preferring whichever table has a
  matching row for the booking's `user_id`, since RLS doesn't prevent
  staff/admin from booking — confirm during implementation with a quick
  data check rather than blocking this decision on it now.

### 5b. Class-recommendation intent
- New intent, `recommend-class` (roles: client — this is inherently a "what
  should I book" self-service question, not a staff lookup).
- Matches on trigger family: "what should I book," "what class is right for
  me," "recommend a class," etc.
- Reads the current member's `goals`, `preferred_class_types`,
  `fitness_level` (`.split("; ")` per investigation's confirmed seed
  format), matches case-insensitively against `classes.type`'s real 3-value
  set (using Decision 4's centralized `resolveClassType` candidate list, now
  the corrected one).
- Renders as a `schedule` card (existing kind, reused — this is literally "here
  are some classes," the same shape `class-info`/`schedule` already render)
  filtered to upcoming classes matching the member's preferred type(s),
  with a short reply framing why (referencing the matched
  goal/preference), not just a bare card.
- If no upcoming class matches the member's preferred type(s) at all, falls
  through to a `notice` card (from Decision 8, carried forward) rather
  than an empty `schedule` card with zero rows.

### 5c. "What's happening now/next" intent
- New intent, `now-and-next` (roles: client, staff, admin — this is the
  single most common front-desk-style question per the brief, applicable to
  all roles).
- Extracts `app/staff/page.tsx`'s `isCurrentOrNext` (confirmed portable,
  takes a plain class-shaped object and a `Date`) into a shared helper in
  the Decision 4 entity-extraction module (or a small adjacent
  `lib/classes/` helper, matching the existing `lib/classes/fill-level.ts`
  convention already in the repo) — used by both the chatbot intent and
  (optionally, non-blocking) refactored into `staff/page.tsx` itself so
  there's one source of truth, not two copies going forward.
- **"Next" fallback-to-tomorrow gap**: investigation confirmed the staff
  page's existing "next" computation has no fallback to tomorrow's first
  class if today's schedule is exhausted. Recommend the new intent adds
  this fallback (check tomorrow's first class if nothing remains later
  today), since "what's next" answering "nothing" when it's 9pm and there's
  a 7am class tomorrow reads as a broken/dead-end answer, which directly
  contradicts this whole task's "graceful, not a dead end" theme. This is a
  net-new behavior beyond what `staff/page.tsx` does today, not a
  faithful-only extraction — call this out explicitly since it goes beyond
  "just move existing logic."
- Renders as a `schedule` card filtered to 1-2 rows (current class if any,
  next class either way).

### Why
Framing 5a's honesty constraint conditionally (only mention "on record"
when there's a real gap) avoids two bad outcomes: overclaiming completeness
(numbers visibly not adding up to staff who notice, per investigation's
flagged risk) and under-trusting the data on the common case where every
booking *is* nameable (unnecessary hedging language on every single reply
would read as evasive). 5c's tomorrow-fallback recommendation is a small,
deliberate scope addition beyond pure extraction, flagged for explicit
approval since it's new behavior, not a verbatim port.

### Approval requested
New decision (existence of the 3 capabilities is settled by the brief; this
detail is not). Needs sign-off on: (a) 5a's exact reply wording/framing for
the "not necessarily complete" honesty constraint; (b) 5a's staff/admin
booker name-resolution approach (join both `members` and `profiles`); (c)
5b's role restriction to client-only (vs. also useful for staff answering
"what should I book for this member," which would need a member-target
parameter — recommend client-only for v1, flag staff-facing recommendation
as an explicit non-goal unless the user wants it added); (d) 5c's
tomorrow-fallback addition as in-scope new behavior, not just extraction.

---

## Decision 6: Fallback-as-suggestions vs. slot-filling reconciliation (NEW)

### Evidence
The brief explicitly flags this as needing resolution: does real
slot-filling (Decision 2) replace v1's near-miss-suggestion mechanism,
complement it, or serve different situations? `router.ts`'s current
zero-score fallback path (`router.ts:21-24`) returns generic prose with no
card and no targeted `suggestedChips` — `route.ts:18`'s `??=` backfill
silently fills the full role menu whenever a handler doesn't set one
explicitly.

### Options
1. **Slot-filling fully replaces near-miss suggestions** — every "unclear"
   case becomes a slot-filling question. Rejected: slot-filling requires an
   intent to have already won routing (score > 0) with a specific missing
   entity it knows how to ask about; a message that matches *no* intent at
   all (zero score everywhere) has no "which slot is missing" to ask about
   — there's nothing for slot-filling to attach to.
2. **Near-miss suggestions fully replace slot-filling** — always show
   clickable "did you mean" options, never ask a targeted question and wait
   for the answer. Rejected: this is strictly the v1 approach the brief is
   explicitly asking to go beyond ("foundationally smarter," not just "more
   suggestions") — a message like "book me into the yoga class" with no
   date/time is not "no intent matched," it's "the intent matched
   correctly and needs one more piece of information," which suggestions-only
   handles worse than a direct question would.
3. **Split by condition: slot-filling owns "an intent won routing (score >
   0) but is missing a required entity to complete its action"; near-miss
   suggestions own "no intent matched at all (zero score everywhere)."**

### Recommendation
Option 3. Concretely:

- **Slot-filling case** (Decision 2): the router picks a winning intent
  normally (score > 0, strictly highest per existing tie-break rule); that
  intent's own `handle` recognizes it has the right *kind* of request but a
  specific missing entity (e.g. `book-class` matched "book me into yoga"
  but has no date/time), and returns `needsClarification` instead of either
  a disambiguation list or a generic error. This never touches the router's
  scoring loop — it's entirely within the winning intent's own `handle`
  logic.
- **Near-miss-suggestion case** (renamed from v1's Decision 3, same
  underlying mechanism, now scoped correctly against Decision 2's existence):
  fires only when the *primary* scoring pass finds no winner at all (every
  intent scored 0 for this role). Rerun each chip-eligible intent's
  `scoreTriggerFamily` alone (dropping the entity multiplier, since a
  present-trigger/absent-entity message is exactly why it fell through the
  primary pass) as a relaxed secondary pass; up to 3 intents scoring > 0 map
  to their chip as `suggestedChips` with "did you mean..." framing. If the
  relaxed pass also finds nothing, fall back to a small curated 3-4 chip
  subset (never the full 9-10 item menu) — this part of v1's Decision 3 is
  unchanged and still correct under the new split.
- **Multi-match disambiguation** (`class-info` finding 3 classes matching
  "yoga," `member-lookup` finding 2 members named "Sam") is a third,
  pre-existing case, distinct from both of the above — it already exists
  today as the text-blob pattern Decision 8 fixes by converting to the
  `disambiguation` RichCard kind. It is not touched by this decision;
  worth stating explicitly so it isn't confused with slot-filling (both
  involve "the bot needs more information," but disambiguation is "too many
  candidates for a slot already provided," while slot-filling is "no
  candidate provided for a slot at all").

### Why
These genuinely are different situations with different available signal:
slot-filling has a specific intent and a specific missing field to ask
about; near-miss suggestions have neither (nothing won routing, so there's
no "ask about X" target — only "here's what you might have meant").
Building one mechanism to cover both would force either slot-filling to
degrade to generic suggestions when it has better information available, or
near-miss suggestions to fabricate a fake "missing slot" for a message that
doesn't match anything. Keeping disambiguation as an explicit third,
untouched case avoids conflating "ambiguous within a match" with "no match
at all."

This directly answers the brief's explicit request to reconcile the two
mechanisms with a real decision and reasoning, not just an assertion.

### Approval requested
New decision. Needs sign-off on the three-way split (slot-filling /
near-miss-suggestion / disambiguation) and specifically that near-miss
suggestions remain scoped to "zero-score-everywhere" only, not any
missing-entity case (which now belongs to slot-filling instead).

---

## Decision 7 (carried forward, updated): Message recognition — scoring normalization

*Formerly v1 Decision 2. Substance unchanged; renumbered for this plan's
new ordering. Already user-approved in v1 pending Phase 12 spot-check
confirmation, which still applies.*

### Evidence
`investigation.md` §1: 6 intents (`my-goals`, `my-activity`,
`members-by-attribute`, `my-appointments`, `roster-summary`,
`retention-lookup`) use bare `Number(regex.test())` despite importing the
shared scoring helpers; 2 (`who-is-booked`, `time-off-review`) use fully
bespoke ad hoc scoring (hardcoded `2`). These 8 intents structurally cannot
out-score a well-matched competitor via an entity-match boost the way
helper-based intents do.

### Decision (unchanged from v1)
Normalize all 8 onto `scoreTriggerFamily(...) * (1 + scoreEntity(...))`,
reusing each intent's own already-parsed entity as the entity pattern (no
new invented vocabulary). `who-is-booked` and `time-off-review` keep their
bespoke structural gates (`hasClassReference`, `date && name`) as
legitimate preconditions, but compose them with the shared formula instead
of a hardcoded `2`.

### Consistency note for this v2 plan
Once Decision 4 centralizes entity extraction, several of these 6 intents'
"already-parsed entity" (instructor names, class types, weekdays) should
pull from the same centralized candidate lists, so this phase and Decision
4's phase should land in the same order dependency (Decision 4 before or
alongside this normalization work) to avoid extracting entity patterns
twice.

### Approval requested
Already approved in v1 (confirm still stands): normalizing all 8 intents,
spot-checked in QA for tie-break behavior changes on ambiguous messages.

---

## Decision 8 (carried forward, updated): Universal polished output — new RichCard kinds + persistence, now combined with Decision 1's schema

*Formerly v1 Decision 4. The `disambiguation`/`notice` RichCard kinds and
their application are unchanged and already approved. The persistence
migration is re-scoped here against Decision 1's new schema needs (this is
where old-Decision-4's "already user-approved" status intersects with new
schema work that still needs approval).*

### Evidence
`investigation.md` §3–4: 7 existing RichCard kinds, exhaustive switch.
Disambiguation-list-as-text-blob repeats across 8 intents. `help` and
`my-activity` are 100% plain text. `chat_messages` stores only `role,
content, created_at` — cards are not persisted at all today, and
`route.ts:34` unconditionally overwrites every historical assistant
message's `suggestedChips` with the full role menu on reload.

### Decision (unchanged from v1, already approved)
New types:
```ts
| { kind: "disambiguation"; prompt: string; options: Array<{ label: string; detail?: string; sendMessage: string }> }
| { kind: "notice"; tone: "info" | "tip" | "error"; title?: string; body: string }
```
Applied to all 8 repeat-offender intents' multi-match branches (`notice`
also used for `needsClarification` prompts from Decision 2, and for the
near-miss/curated-fallback replies from Decision 6 — both are new
consumers of this already-approved kind, not new kinds themselves).

**Persistence migration, reconciled with Decision 1**: add nullable `card`
and `suggested_chips` jsonb columns to `chat_messages` (already approved in
v1), in the *same* migration as Decision 1's `resolved_entities` column
addition and the new `chat_pending_clarifications` table (see Decision 10
below) — all are `chat_messages`-adjacent, chat-flow schema additions being
designed at the same time, and splitting them into separate migrations buys
no real isolation benefit since they're not independently revertible in
practice (the persistence fix and the memory/slot-filling work are both
needed for this task's full acceptance criteria to be demonstrable together
— e.g. a reload-preserves-context test touches both).

### Approval requested
The kinds/application (already approved in v1) carry forward unchanged. The
*combined-migration* framing is new — see Decision 10's combining
recommendation for the explicit call.

---

## Decision 9 (carried forward, unchanged): Thinking/loading animation

*Formerly v1 Decision 5. Already fully approved (~500-600ms floor
confirmed). No changes from v1 — restated here only for completeness of the
unified plan.*

### Decision (unchanged, already approved)
CSS-only `@keyframes spin-arc { to { transform: rotate(360deg); } }` /
`.animate-spin-arc { animation: spin-arc 1.1s linear infinite; }` applied
conditionally on `isSending`, `linear` timing (deliberate deviation from
project easing tokens, justified for a continuous loop). Reduced-motion:
the global forced-single-iteration rule lands the icon back at its natural
orientation with no jarring freeze, by construction of the 0→360°
keyframe. Minimum visible duration ~500-600ms client-side floor, gated on
actual response arrival.

### Approval requested
None — already approved, included for completeness only.

---

## Decision 10: Migration-combining call

### Evidence
Decision 1 needs: `chat_messages.resolved_entities` (jsonb, nullable) +
new `chat_pending_clarifications` table. Decision 8 needs:
`chat_messages.card` + `chat_messages.suggested_chips` (both jsonb,
nullable). All four changes touch `chat_messages` or a table that only
exists to support it, all are part of the same "chat gets smarter and more
persistent" effort, and none has an independent rollback story that
benefits from being separate (rolling back conversation memory without also
rolling back card persistence, or vice versa, isn't a realistic operational
scenario for this app).

### Options
1. **One combined migration** adding all 4 changes (2 new columns +
   `card`/`suggested_chips` on `chat_messages`, plus the new
   `chat_pending_clarifications` table) in a single file.
2. **Two migrations** — one for old-Decision-4's `card`/`suggested_chips`
   (framed as "already approved, ship it first/independently"), one for
   Decision 1's `resolved_entities` + `chat_pending_clarifications`.

### Recommendation
Option 1, combined. Both are additive-only (new nullable columns, one new
table with its own RLS) — there's no destructive change in either that
would need independent revert isolation. Combining also means Phase-ordering
doesn't have to awkwardly split "add 2 of 4 columns to chat_messages now,
add 2 more later" across two different phases touching the same table,
which would read as arbitrary sequencing rather than a real boundary.

### Why
The brief's own framing groups these as "both chat-related schema
additions" and explicitly asks the planner to decide on combining. Given
neither has a real independent-rollback need, one migration is simpler to
review and land than two migrations touching the same table in adjacent
phases.

### Approval requested
New decision. Needs explicit sign-off: combine into one migration touching
`chat_messages` (2 new columns: `card`, `suggested_chips` — already
approved in principle via old-Decision-4) + `chat_messages.resolved_entities`
(new, Decision 1) + the new `chat_pending_clarifications` table (new,
Decision 1), all in a single migration file.

---

## Cross-cutting: registration order, IntentResult signature migration, menu entries

- **`Intent.handle` signature change** (Decision 2) touches all 19 existing
  intent files mechanically (each gains an unused third parameter) even
  though only slot-filling-aware intents (initially: `book-class`,
  `class-info`, `who-is-booked`, `recommend-class` — any intent with a
  clearly-identifiable single missing required slot) use it. This should
  land as its own reviewable step (see Phase 4) precisely because it's
  mechanical-but-pervasive — a good candidate for one focused diff rather
  than folding into feature phases.
- **Registration order**: `recommend-class` and `now-and-next` (Decision 5)
  get appended to `intents/index.ts` in a deliberate position, following
  the existing convention of narrower/more-specific-entity intents placed
  earlier; extend the file's existing tie-break-rule comment to document
  the new entries.
- **`ChipId`/menus**: new chip(s) for `now-and-next` (e.g. `whats-next`) and
  `recommend-class` (e.g. `recommend-me-a-class`) need `CHIP_LABELS`/`CHIP_ROLES`
  entries and role-menu placement. `who-is-booked`'s existing chip-free,
  free-text-only status is unaffected (it stays free-text-only; only its
  reply content changes per Decision 5a).

---

## Phased implementation plan

Reordered from v1: conversation-memory/slot-filling (Decisions 1–2) is now
the largest, most foundational piece, and several later phases depend on
its schema and mechanism existing first — most notably, the fallback path
(Decision 6) needs to know it's specifically the zero-score case, distinct
from slot-filling, before it can be implemented correctly; entity
centralization (Decision 4) is a prerequisite for fuzzy matching (Decision
3) rather than something to interleave with it.

**Phase 1 — Combined schema migration (Decision 1's schema + Decision 8's
persistence columns, combined per Decision 10).** `chat_messages.card`,
`chat_messages.suggested_chips`, `chat_messages.resolved_entities` (all
nullable jsonb); new `chat_pending_clarifications` table with RLS.
Migration-only, no application code changes yet — smallest possible unit,
independently reviewable/rollback-able as a single atomic schema change
before anything depends on it.

**Phase 2 — Entity-extraction centralization (Decision 4).** Build
`lib/chatbot/entity-extraction.ts` (`resolveDate` with explicit
`fallbackToToday` param, `resolveTime`, `resolveInstructor`,
`resolveClassType` with the corrected 3-value canonical list,
`resolveWeekday`); migrate all 6+ existing call sites onto it, preserving
`studio-capacity.ts`'s divergence explicitly. No behavior change intended
except the `members-by-attribute.ts` class-type drift fix (flagged
explicitly in the PR). Pure refactor otherwise, reviewable in isolation, no
schema/UI dependency.

**Phase 3 — Typo/fuzzy tolerance (Decision 3).** Add `fuzzyMatch` to the
Phase 2 module; wire into `resolveInstructor`/`resolveClassType`/`resolveWeekday`
and (more cautiously, per the larger-candidate-list threshold) member-name
lookups. Depends on Phase 2 existing (this is explicitly the "don't build
it 6 times" phase).

**Phase 4 — `IntentResult`/`Intent.handle` signature change + slot-filling
mechanism (Decision 2).** Add `needsClarification`/`resolvedEntities` to
`IntentResult`, the optional third `pendingAnswer` parameter to
`Intent.handle` (mechanical update across all 19 intents), the pre-routing
pending-clarification check in `routeMessage`, and wire 3-4 initial
slot-filling-aware intents (`book-class`, `class-info`, `who-is-booked`;
`recommend-class` once it exists in Phase 6) to actually use it. Depends on
Phase 1's `chat_pending_clarifications` table.

**Phase 5 — Conversation memory / pronoun resolution.** Populate
`resolvedEntities` on relevant intents' successful resolutions; add the
last-N-messages lookback read in `routeMessage` (or a pre-processing step
before it) that resolves pronoun/shorthand references against the most
recent resolved entity before normal scoring runs. Depends on Phase 1's
`resolved_entities` column and benefits from Phase 4 landing first (both
touch `routeMessage`'s pre-scoring logic, better done as one coherent
change to that function than two separate touches).

**Phase 6 — The 3 new capabilities (Decision 5).** `who-is-booked` real
names with the honesty-constrained wording; new `recommend-class` intent +
chip; new `now-and-next` intent + chip, with the shared `isCurrentOrNext`
helper and tomorrow-fallback addition. Depends on Phase 2 (entity
resolution), Phase 3 (fuzzy name matching for `who-is-booked`), and Phase 4
(these are prime slot-filling candidates, e.g. `recommend-class` asking "for
which class type?" if goals/preferences don't cleanly resolve).

**Phase 7 — RichCard kinds + disambiguation click-through (Decision 8, UI
half).** Add `disambiguation`/`notice` kinds to `types.ts`, render in
`chat-cards.tsx`, generalize the chip-click mechanism to accept a raw
message string. Migrate the 8 disambiguation-pattern intents and the 2
all-text intents. Independent of Phases 2–6, could be parallelized, but
sequenced here since Phase 4's `needsClarification` prompts and Phase 6's
`recommend-class` no-match branch both want to render as `notice`/`disambiguation`
cards from day one rather than plain text that gets migrated later.

**Phase 8 — Scoring normalization (Decision 7).** Rebase the 8
flagged intents onto `scoreTriggerFamily`/`scoreEntity`, pulling entity
patterns from Phase 2's centralized lists where applicable. Placed after
centralization so this phase doesn't duplicate entity-pattern extraction
that Phase 2 already did.

**Phase 9 — Fallback-as-suggestions (Decision 6).** Router's relaxed
secondary pass restricted to the zero-score case, chip-eligible-intent
mapping, explicit `suggestedChips` on every fallback branch, curated
small-menu final fallback. Depends on Phase 4 (must not fire on cases that
are actually slot-filling candidates) and Phase 7 (`notice` kind for the
fallback reply itself).

**Phase 10 — Persistence read/write completion (remainder of Decision 8).**
POST writes `card`/`suggested_chips`/`resolved_entities`; GET reads and
returns them instead of unconditionally synthesizing the full menu; fixes
`route.ts:34`'s overwrite bug as part of the same change (already flagged
as a risk to double-check, per investigation-followup). Depends on Phase 1's
columns existing and Phases 5/7 populating them meaningfully to verify
against.

**Phase 11 — Thinking animation (Decision 9).** `spin-arc` keyframe +
`.animate-spin-arc` utility; conditional class on `MomentumArc` in both
typing indicators; minimum-visible-duration timer. Fully independent of
all other phases — can land at any point, listed last only because it's
already fully specified and lowest-risk.

**Phase 12 — Full-surface QA pass.** Exercise: pronoun-resolution
conversations ("book me into the 6pm yoga" → "actually make that the 7pm
one instead"); a full slot-filling exchange (intent matches, missing slot,
targeted question, next message answers it, request completes); a
deliberate typo ("cyclng", "hitt", a misspelled instructor/member name)
resolving via fuzzy match; `who-is-booked` against a class with real vs.
seed-phantom bookings, confirming wording differs correctly; the
recommendation intent against a member profile; the now/next intent at a
time with nothing left today (confirming the tomorrow fallback); a message
that starts a slot-filling flow then gets abandoned for an unrelated
message (confirming graceful drop, not forced misinterpretation); the
near-miss fallback path on a genuinely-unmatched message; a page reload
after a card-bearing, chip-bearing, and slot-filling-pending conversation;
reduced-motion emulation; a near-instant response confirming the animation
floor; re-test of pre-existing intents' trigger phrases for new collisions
from the larger surface area.

## Acceptance criteria

**Conversation memory (Decisions 1, 5)**
- [ ] A two-turn conversation ("what yoga classes are today" → "who's
      teaching that one") resolves the pronoun to the previously-discussed
      class without the second message containing "yoga" or a date,
      verified against a running dev server.
- [ ] `chat_messages.resolved_entities` is populated on turns where an
      intent resolves a concrete class/member/date.
- [ ] Pronoun resolution only looks back a small, bounded number of recent
      messages (per the design) — a stale reference from much earlier in
      a long conversation does not incorrectly resolve.

**Slot-filling (Decision 2)**
- [ ] A message that matches an intent but omits a required entity (e.g.
      "book me into yoga" with no date/time) produces a specific targeted
      question, not a disambiguation list or generic fallback.
- [ ] The next message, answering only the missing slot (e.g. "Tuesday at
      6pm"), completes the original request without the user restating
      "book me into yoga."
- [ ] A pending clarification is dropped gracefully (not force-interpreted)
      when the next message clearly targets a different intent; verified
      by starting a slot-filling flow then sending an unrelated message and
      confirming it routes normally.
- [ ] A pending clarification past its expiry window is not consumed as an
      answer even if the next message could plausibly be read as one.
- [ ] `chat_pending_clarifications` has RLS restricting rows to their
      owning user; verified via a second-user request never seeing or
      affecting the first user's pending row.

**Typo/fuzzy tolerance (Decision 3)**
- [ ] A deliberately misspelled class type, instructor, or weekday (e.g.
      "cyclng," "hitt," an instructor surname off by one letter) still
      resolves correctly.
- [ ] A very short deliberately-wrong token (≤4 chars) does NOT fuzzy-match
      an unrelated candidate, confirming the length-scaled threshold
      prevents false positives.
- [ ] No new npm dependency added for this feature.

**Entity centralization (Decision 4)**
- [ ] All migrated call sites import from the single shared module; no
      duplicate date/time/instructor/weekday/class-type literal arrays
      remain outside it.
- [ ] `studio-capacity.ts`'s fallback-to-today behavior is unchanged
      end-to-end (verified with a message that matches no explicit date).
- [ ] `members-by-attribute.ts` no longer offers `pilates`/`strength`/`cardio`
      as class-type filters that can never match real data.

**The 3 new capabilities (Decision 5)**
- [ ] `who-is-booked` against a class with real (non-seed) bookings returns
      actual attendee names.
- [ ] `who-is-booked` against a class where named attendees < `booked_count`
      uses the "on record" qualified phrasing, not an unqualified claim of
      completeness.
- [ ] `recommend-class` returns a class matching the asking member's
      `preferred_class_types`/`goals`, with a reply explaining why, for at
      least one seeded member profile.
- [ ] `recommend-class` returns a `notice` (not an empty schedule card) when
      no upcoming class matches the member's preferences.
- [ ] `now-and-next` answers correctly with no date given, for both "class
      happening right now" and "next class" cases.
- [ ] `now-and-next` falls back to tomorrow's first class when nothing
      remains later today, verified with a request made late in the day.

**Fallback/slot-filling reconciliation (Decision 6)**
- [ ] A message matching no intent at all (zero score everywhere) triggers
      the near-miss-suggestion path, never slot-filling.
- [ ] A message matching an intent with a missing required slot triggers
      slot-filling, never the near-miss-suggestion path.
- [ ] Multi-match disambiguation (unrelated to either) continues to render
      as the `disambiguation` card, unaffected by this decision.

**Carried-forward items (Decisions 7, 8, 9)**
- [ ] All 8 previously-`Number(regex.test())`/bespoke-scored intents call
      `scoreTriggerFamily`/`scoreEntity`.
- [ ] `types.ts` has `disambiguation` and `notice` kinds; `chat-cards.tsx`'s
      switch remains exhaustive.
- [ ] All 8 previously-text-blob disambiguation branches render a
      `disambiguation` card; clicking an option sends the follow-up without
      retyping.
- [ ] `help` and `my-activity` render `notice` cards on every branch.
- [ ] Reloading a chat with a card-bearing, targeted-chip-bearing, or
      slot-filling-pending history preserves that state (not the full-menu
      overwrite bug).
- [ ] `MomentumArc` visibly rotates in the typing indicator during a real
      request in both client surfaces.
- [ ] With `prefers-reduced-motion: reduce` emulated, the typing-indicator
      icon shows no visible rotation.
- [ ] A deliberately fast round-trip still shows the typing indicator for
      at least the agreed minimum duration.

**General**
- [ ] `npm run lint` and `npx tsc --noEmit` pass with no new errors after
      every phase.
- [ ] Phase 12's QA pass explicitly re-tests a sample of pre-existing
      intents' trigger phrases (not just new/changed ones) to catch new
      collisions from the larger, fuzzy-matched, memory-aware surface.

---

## Approval status summary

**Already user-approved (carry forward, no re-approval needed unless the
user wants to revisit):**
- Decision 7 (scoring normalization) — approved in v1.
- Decision 8's `disambiguation`/`notice` RichCard kinds and their
  application — approved in v1.
- Decision 9 (thinking animation, ~500-600ms floor) — approved in v1.
- The *existence* of the 3 capabilities in Decision 5 (real attendee names,
  class recommendation, now/next) — approved via the brief's scope
  revision.
- Dropping `member-profile-lookup`, `membership-status-lookup`,
  `member-contact-lookup`, `birthday-lookup`, `staff-notes-flag`,
  `renewal-risk-lookup`, `class-duration-search` — approved via the brief's
  scope revision.

**NEW — needs explicit approval before implementation:**
- Decision 1 (conversation-memory storage architecture: two-mechanism
  split, concrete schema).
- Decision 2 (slot-filling mechanism: type/signature changes,
  re-score-first reconciliation rule, TTL).
- Decision 3 (fuzzy tolerance: no new dependency, threshold policy,
  placement).
- Decision 4 (entity-extraction centralization: scope, `fallbackToToday`
  parameter approach, fixing `members-by-attribute.ts` drift now).
- Decision 5's *detail* (5a's wording/staff-booker join approach, 5b's
  client-only scoping, 5c's tomorrow-fallback addition as new behavior).
- Decision 6 (fallback/slot-filling/disambiguation three-way split).
- Decision 10 (combining all schema changes into one migration).

---

Not implemented yet — stopping here for approval on the NEW decisions
above (1, 2, 3, 4, 5-detail, 6, 10). Already-approved items (7, 8's kinds,
9, and the 3 capabilities' existence) do not need re-approval but are
included for the plan to read as one coherent whole.

### Critical Files for Implementation

- C:\Users\Wil\Documents\Codex\fitbot\lib\chatbot\types.ts
- C:\Users\Wil\Documents\Codex\fitbot\lib\chatbot\router.ts
- C:\Users\Wil\Documents\Codex\fitbot\app\api\chat\route.ts
- C:\Users\Wil\Documents\Codex\fitbot\lib\chatbot\intents\who-is-booked.ts
- C:\Users\Wil\Documents\Codex\fitbot\supabase\migrations\0003_chat_messages.sql
- C:\Users\Wil\Documents\Codex\fitbot\app\staff\page.tsx
- C:\Users\Wil\Documents\Codex\fitbot\lib\chatbot\chip-labels.ts
