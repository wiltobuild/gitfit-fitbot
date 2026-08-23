# Plan: retention-campaign-page

Grounded in `docs/tasks/retention-campaign-page/investigation.md`. This is
a plan only — no implementation, per the user's explicit instruction.

---

## Decision 1: What "launch" honestly does against real infrastructure

### Evidence
Investigation §5: no push/email/SMS delivery infrastructure exists
anywhere in GitFit. The existing single-member outreach flow's "send"
(`outreach-send.ts`) only flips `outreach_messages.status` from `'draft'`
to `'sent'`; nothing is delivered to a real member today.

**However, GitFit has a real, already-working delivery surface that was
initially overlooked: FitBot's own chat history.** `chat_messages`
(`0003_chat_messages.sql`) stores every member's conversation with FitBot,
read fresh on every chat open (`GET /api/chat`). Its only relevant RLS
gap is that `chat_messages_insert_own` restricts inserts to
`user_id = auth.uid()` — a staff/admin session cannot currently insert a
row into a different member's chat history. This is the exact same shape
of gap `outreach_messages` already solved (`outreach_messages_insert_own_staff`
lets staff create a record targeting a different member) — closing it for
`chat_messages` is a small, additive, precedented migration: a new
INSERT policy gated on `is_staff(auth.uid())`, write-only (no matching
SELECT broadening, so staff still cannot read another member's chat
history — only deliver into it).

Once that exists, "sending" a message can **insert a real
`role: 'assistant'` row into the target member's `chat_messages`** — the
message is genuinely sitting there the next time they open FitBot. This
is real in-app delivery, not a status-flag illusion, using
infrastructure that already exists everywhere else in the app.

### Options
1. **Ship it exactly as the mockup implies** (push/email claims). Rejected
   — no such infrastructure exists.
2. **Bulk draft creation only, no delivery** (the original recommendation
   before this delivery mechanism was identified) — honest, but strictly
   weaker than what's actually achievable.
3. **Bulk draft creation, and sending a draft (single or bulk) inserts the
   message into the target member's real FitBot chat history**, via the
   new staff-targeted INSERT policy above.

### Recommendation
Option 3. Two-step flow, unchanged from before at the drafting stage:
"Launch" creates one `outreach_messages` draft per cohort member (status
`'draft'`) — staff still reviews before anything goes out, no bulk
blast-without-review. A "Send" action (bulk-send-all-drafts-in-this-campaign,
or reviewed one at a time via the existing per-member flow) does two
things atomically: flips `status` to `'sent'` (unchanged, existing
behavior) **and** inserts a `chat_messages` row for that member with the
composed body. This upgrades the *existing* single-member outreach flow
for free — `outreach-send.ts`'s "send" becomes real delivery for every
past and future use of it, not just this new page.

**Real limitation to surface honestly in the UI**: only members with a
real Supabase Auth account can receive anything this way — investigation
confirmed only ~25 of 300 seeded members hold real accounts. Cohort counts
shown to staff should distinguish "N members in this cohort" from "N of
those have an account and can actually receive this" (the latter is the
number that matters for what will really happen) — members without an
account should still be listed for completeness but clearly marked as
undeliverable via this channel, not silently included in a headline
number that overstates real reach.

### Why
This is a materially better answer to "connect to the dataset and work as
advertised" than plain bulk-drafting — it's genuine delivery, not staff
paperwork with no member-facing effect, and it costs one small additive
RLS policy rather than a delivery-provider integration. It stays honest
by keeping the "not everyone can be reached" limitation visible rather
than implying universal reach the way push/email framing would.

### Approval requested
Confirm: (a) delivery via inserting into the member's real
`chat_messages` history, gated by a new staff-targeted INSERT policy; (b)
this upgrades the existing single-member `outreach-send.ts` flow too, not
just the new bulk page — confirm that's desired, since it's a real
behavior change to already-shipped functionality; (c) the UI must clearly
distinguish cohort headcount from actually-reachable-via-FitBot count,
never implying 100% of a cohort receives it; (d) real push/email/SMS
delivery remains explicitly out of scope — this is in-app-only delivery.

---

## Decision 2: Cohort definition — day-range staleness, powered by real data

### Evidence
Investigation §5 (corrected): `search_members_by_attributes`
(`0013_members_by_attribute_search.sql`) already has a `p_stale_after_days`
parameter filtering `last_visit_date <= current_date - p_stale_after_days`.
It's a lower-bound-only filter today, not a bounded range.

### Options
1. **Add an upper-bound parameter to the existing RPC** (e.g.
   `p_stale_before_days`), so `7–14 days` becomes one clean SQL call:
   `last_visit_date between current_date - 14 and current_date - 7`.
2. **Filter in application code**: call the existing RPC once with a wide
   `p_stale_after_days` floor, then bucket the results by computing
   `daysSinceVisit` per row in TypeScript. No migration needed.
3. **Collapse to `lifecycle_status`** (`at_risk`/`lapsed`) instead of day
   ranges. Rejected — investigation found this is a real capability
   downgrade from what's already buildable, and doesn't match the
   mockup's own framing (which the user asked to be integrated, not
   replaced).

### Recommendation
Option 1 — extend the existing RPC with a bounded range. It's a small,
additive migration (one new optional parameter, backward compatible with
every existing caller since it defaults to null/unbounded), and keeps the
bucketing logic in the database next to the data instead of duplicated in
application code across however many places end up needing it.

### Why
A real migration is barely more work than the application-code filter
(Option 2) and is more reusable — any future staff-facing "how stale" view
gets the same clean query instead of re-deriving day math from
`last_visit_date` client-side every time.

### Approval requested
Confirm extending `search_members_by_attributes` with a bounded upper-day
parameter (small migration) rather than filtering client-side.

---

## Decision 3: Cohort bucket boundaries and count display

### Evidence
Mockup uses exactly 3 buckets: 7–14, 14–30, 31–60 days inactive, each with
a live member count shown in the UI.

### Recommendation
Keep the same 3 buckets (7–14 / 14–30 / 31–60 days) — they're a reasonable
segmentation and match what the user asked to be integrated "as
advertised." Each bucket's member count comes from a real query (Decision
2's RPC), not a hardcoded number. Members with `last_visit_date is null`
(never visited, or the field wasn't seeded) are excluded from all three
buckets rather than guessed into one — an explicit, separate "no visit on
record" state if ever surfaced, not silently folded into "31-60 days."

### Approval requested
Confirm the 3 buckets stay as-is (no re-tuning the day ranges) and that
never-visited members are excluded rather than bucketed.

---

## Decision 4: Activity trend chart

### Evidence
Investigation §2, §5: the mockup's canvas line chart has 11 hardcoded data
points with no real backing time-series anywhere in the schema. Building a
real version requires new aggregation logic and a product decision about
what "activity" means (bookings created per week? distinct members with a
booking per week?) that doesn't exist today.

### Options
1. **Build it for real** — new weekly-aggregation query (e.g., distinct
   members with ≥1 booking per ISO week, over the last 8 weeks), rendered
   with the same canvas approach. Real, but the single largest net-new
   piece of backend work in this entire page — a genuinely new stat, not
   a wiring exercise.
2. **Drop it from this page** — keep the chart out of scope entirely; the
   page's real value (cohort selection, drafting, batch-drafting) doesn't
   depend on it.
3. **Keep it, but honestly labeled as illustrative** — visually present,
   clearly captioned as "Illustrative — trend tracking isn't wired up
   yet," not implying real numbers.

### Decision (user confirmed: build it for real)
Option 1. Concrete definition of "activity," resolving the open product
question: **distinct members with ≥1 booking created that ISO week**,
computed from `bookings.created_at` (not `classes.class_date` — booking
activity is when a member engaged with the app, which is what this chart
is meant to represent; class date would instead measure studio traffic on
a given day, a different metric), grouped by ISO week (same Monday–Sunday
boundary math already used elsewhere in this codebase, e.g.
`app/dashboard/page.tsx`'s existing week calculation), over a trailing
8-week window — matching the mockup's own "Last 8 weeks" label and its
axis span (`Jun 25` through `Aug 20`, roughly 8 weeks apart).

New function, e.g. `getWeeklyActivityTrend(supabase, { weeks: 8 })` →
`Array<{ weekStart: string; activeMembers: number }>`, a `count(distinct
user_id)` grouped-by-week query against `bookings`. Rendered with the
mockup's existing canvas-chart approach (`ActivityTrend` in `App.jsx`,
ported and re-pointed at real data instead of the hardcoded `values`
array) — the chart's visual design was already approved via `design-qa.md`
and needs no rework, only a real data source.

### Why
Real member-activity trend is a genuinely useful, honest addition to an
admin-facing retention tool — seeing the trend that justifies "this cohort
is worth a campaign" is core to the page's stated purpose, not decoration.
Defining "activity" as booking-creation events (not class attendance,
which doesn't exist as trackable data per the investigation's earlier
finding) keeps this buildable with zero new schema.

### Approval requested (resolved)
User confirmed: build for real, using distinct-members-with-a-booking-per-week
as the activity definition.

---

## Decision 5: Visual/brand integration — remap, don't port

### Evidence
Investigation §4: mockup uses bespoke hex values (not GitFit's real
`--color-*` tokens), Fredoka (not GitFit's Baloo 2), and
`@phosphor-icons/react` (a new dependency; GitFit has no icon library
today, only hand-authored inline SVGs in `app/components/icons.tsx`).

### Recommendation
- **Colors**: rebuild every surface against GitFit's real `@theme` tokens
  (`--color-ink`, `--color-teal`, `--color-violet`, `--color-magenta`,
  `--color-surface`, etc.) — no new hex values introduced.
- **Typography**: use GitFit's real Baloo 2 (display) + Inter (body) via
  the existing `next/font/google` setup in `app/layout.tsx` — do not add
  `@fontsource/fredoka`.
- **Icons**: do not add `@phosphor-icons/react`. Author the small number of
  icons this page actually needs (roughly: users/audience, target/goal,
  send/paper-plane, calendar, phone, envelope, sparkle, check, info,
  pencil, chevron — ~11 glyphs, all common shapes) as new hand-authored
  SVGs in `app/components/icons.tsx`, matching the existing file's style
  exactly. This is more work than `npm install` but keeps GitFit's
  zero-icon-library convention intact rather than introducing the first
  exception for one page.
- **Layout**: keep the three-column information architecture (audience
  rail / workspace / preview rail) — it's a good, clear structure and
  the user asked for a clean integration, not a redesign — but built from
  `.surface-card`, `.badge-*`, `.btn-*` and new page-scoped classes
  following the existing `app/globals.css` section-comment convention
  (see `/* Staff operations console */`-style banners), not a ported
  `src/styles.css`.

### Approval requested
Confirm: (a) no new npm dependencies (`@fontsource/fredoka`,
`@phosphor-icons/react`) — hand-author icons and use existing fonts
instead; (b) keep the three-column layout structure, remap only the visual
tokens.

---

## Decision 6: Route, naming, and nav placement

### Evidence
Investigation §6: flat top-level routes only (`/dashboard`,
`/appointments`, `/chat`, `/staff`), `requireRoleOrRedirect` as the
established staff/admin gate, `nav-links.tsx`'s role-conditional array as
the established nav-registration pattern.

### Recommendation
New top-level route `/retention` (server page:
`app/retention/page.tsx`, gated `requireRoleOrRedirect(["staff","admin"])`
matching `app/staff/page.tsx:21` exactly; client component
`app/retention/retention-experience.tsx` holding the interactive
cohort/composer/preview UI, receiving server-fetched data as props —
same server/client split as `/appointments` and `/staff`). Nav entry added
to `nav-links.tsx`'s existing staff/admin conditional array, alongside the
existing `/staff` link. Page title/copy: "Retention Campaigns" or similar
GitFit-native naming (not "Reconnect" — that name is tied to the mockup's
own "Fitbot Reconnect" branding pairing; a fresh, GitFit-native name avoids
carrying over an implicit "Fitbot" association even after the literal
string is removed).

### Approval requested
Confirm the route path (`/retention`), the page's display name (proposing
"Retention Campaigns" — open to a different name), and nav placement
alongside the existing Staff link.

---

## Decision 7: Demo member preview → real data

### Evidence
Investigation §2, Unknowns: the mockup's live-preview rail shows a
hardcoded demo member "Maya" with a real generated avatar image. Not
flagged by the user's branding instruction (which named only "Fitbot"),
but meaningless as a hardcoded name once the page is wired to real data.

### Recommendation
Replace the hardcoded "Maya" preview with a **real member drawn from the
currently-selected cohort** (e.g., the first result, or a manually
selectable one from the cohort list) — showing their actual first name in
the message preview (reusing the existing `[First name]` token-replacement
pattern the mockup already has, `App.jsx:142`) and initials-based avatar
(reusing `InstructorAvatar`-style initials fallback conventions already
established elsewhere in the app, though this is a member not an
instructor, so a small new avatar component or a shared generic-initials
helper is the right shape — not reusing `InstructorAvatar` directly, which
is instructor-specific). Drop the `maya-avatar.png` asset entirely — it's
a stock/generated image of a specific fictional person with no connection
to any real GitFit member, and keeping it would be presenting a fake photo
as if previewing a real one.

### Approval requested
Confirm previewing a real cohort member (name + initials) instead of the
hardcoded "Maya," and dropping the Maya avatar image.

---

## Decision 8: Incentive toggle

### Evidence
Investigation §2: the mockup's incentive toggle only changes displayed
copy ("7-day premium pass added") — no incentive/coupon/credit system
exists anywhere in GitFit (`members.membership_tier` is a static
`basic`/`premium` field, not a redeemable-credit mechanism; recall this
session's earlier appointments work found a "Studio Credits" balance
concept, but nothing resembling a grantable one-off pass).

### Options
1. **Drop the incentive toggle entirely** — cleanest, avoids implying a
   capability that doesn't exist.
2. **Keep it as a message-copy toggle only** — it changes what text gets
   included in the drafted message (e.g. appends an incentive line to the
   body), but grants nothing mechanically. Staff would need to manually
   honor any promised incentive outside the app, same as if they wrote it
   into the message by hand today.

### Recommendation
Option 2. It costs nothing extra to keep (it's purely a message-text
toggle) and preserves a feature the user's source mockup clearly
considered a core part of the concept, as long as the UI copy is honest
that it only affects the drafted message text — not "7-day premium pass
added" phrasing that implies an actual grant happened.

### Approval requested
Confirm keeping the incentive toggle as message-copy-only (not implying
any real grant/credit mechanism).

---

## Decision 9: Client dashboard "Promotions" area (NEW)

### Evidence
The current client-facing `/dashboard` (`app/dashboard/page.tsx`) is a
single generic page with no promotional/messaging surface at all. A
separate, not-yet-approved task (`docs/tasks/dashboard-role-refactor/`)
is planning a full role-specific dashboard rebuild, but that shouldn't
block this — a promotions card is a self-contained addition to whatever
`/dashboard` looks like today, and simply moves into the client-specific
dashboard section if/when that other task ships.

### Recommendation
A new "Promotions" card on the client dashboard, sourced from the same
`outreach_messages` rows Decision 1 already creates — **no new table**.
Query: `outreach_messages` where `target_member_id` resolves to the
logged-in user (via their linked `members` row) and `status = 'sent'`,
most recent first, rendered as small cards (subject + body + sent date).
This reuses the exact same real data the FitBot delivery (Decision 1)
already produces — the dashboard card and the chat message are two
displays of the same underlying record, not two parallel systems to keep
in sync.

**Read/seen state**: rather than a new schema column, track "last seen"
client-side (a timestamp in `localStorage`, keyed per user) — simplest
option, no migration, and losing "seen" state on a new device/cleared
storage is a low-stakes failure mode for a promotions card (worst case:
an old promotion shows as unread once more, not a real problem).

### Approval requested
Confirm: (a) reuse `outreach_messages` as the promotions data source, no
new table; (b) client-side (`localStorage`) seen-tracking instead of a
new DB column; (c) this can be built against the current single generic
`/dashboard` now, independent of whether `dashboard-role-refactor` is
ever approved.

---

## Decision 10: FitBot auto-popup on new promotion (NEW)

### Evidence
`ChatbotOverlay` (`app/components/chatbot-overlay.tsx`) is already
mounted globally for every authenticated page load
(`app/layout.tsx:33`: `{session && <ChatbotOverlay />}`), and already
listens for a custom `fitbot:open` window event (used today by
in-page "Ask FitBot" tiles) to open itself and optionally pre-fill a chip
or preset message. This is exactly the hook an auto-popup needs — no new
mounting mechanism required.

There is no live/push mechanism in this app (no websockets, no
server-sent events) — a member's browser can only learn "a promotion just
arrived" the next time it loads or polls a page, not the instant staff
clicks send. Auto-popup is therefore "opens automatically on the member's
next page load/visit while a promotion is unseen," not "pops up live on
their screen the moment staff sends it while they're mid-session
elsewhere."

### Options
1. **No distinguishing marker** — treat any new `chat_messages` row since
   last page load as "auto-open worthy." Rejected: this would also
   auto-pop the overlay after completely ordinary chatbot replies (e.g. if
   a member asks something in one tab and has another tab open), which is
   not what "promotion pushed" means and would be an annoying false
   trigger.
2. **New boolean column** (e.g. `chat_messages.is_promotional`), set true
   only by the retention-delivery insert path (Decision 1), false for
   every normal chatbot reply. Auto-popup logic checks specifically for
   unseen `is_promotional = true` rows.

### Recommendation
Option 2. On every authenticated page load, a small check (likely inside
or alongside `ChatbotOverlay`, since it already has the right lifecycle
and the existing `GET /api/chat` history fetch to extend) looks for any
`is_promotional = true` message newer than the same `localStorage`
"last seen promotion" timestamp from Decision 9. If found: dispatch the
existing `fitbot:open` event automatically (no user click needed) and the
overlay opens showing that message already in the conversation.

### Why
Reusing the existing global mount point and open-event mechanism means
this is additive to `ChatbotOverlay`, not a new UI surface — the overlay
already knows how to open itself and render history; this just adds one
more trigger condition (an unseen promotional message) alongside the
existing manual-click trigger. The boolean marker (Option 2) is a single
cheap column and avoids the false-trigger problem of treating every new
message as popup-worthy.

### Approval requested
Confirm: (a) the `is_promotional` boolean column on `chat_messages`
(folds into Decision 1's migration); (b) "auto-open on next page load
while unseen," not real-time/instant, given no push infrastructure
exists; (c) shared `localStorage` "last seen" state with Decision 9's
promotions card (one seen-tracking mechanism, not two).

---

## Cross-cutting: files touched

- New: `app/retention/page.tsx` (server), `app/retention/retention-experience.tsx`
  (client).
- Modified: `app/components/nav-links.tsx` (new nav entry),
  `app/components/icons.tsx` (new hand-authored icons per Decision 5),
  `lib/members/queries.ts` (extend `searchMembersByAttributes` for the
  bounded day-range per Decision 2), `lib/chatbot/intents/outreach-send.ts`
  (add the `chat_messages` insert alongside the existing status flip, per
  Decision 1), `app/dashboard/page.tsx` (new Promotions card, Decision 9),
  `app/components/chatbot-overlay.tsx` (auto-open check, Decision 10).
- New migration: one file combining (a) the bounded-range parameter to
  `search_members_by_attributes` (Decision 2), (b) the new staff-targeted
  `chat_messages` INSERT policy (Decision 1), and (c) the
  `chat_messages.is_promotional` boolean column (Decision 10) — all
  additive/backward compatible, no data migration needed, reasonable to
  ship as one small migration together.
- Not touched: `outreach_messages` schema itself (Decision 1 uses the
  existing `status`/`sent_at` columns exactly as they exist today — no new
  columns needed for bulk-draft creation).

## Phased implementation plan (for the eventual EXECUTE pass — not started)

**Phase 1 — Schema**: the bounded day-range parameter (Decision 2) and the
staff-targeted `chat_messages` INSERT policy (Decision 1), combined into
one small migration. Isolated, reviewable alone before any application
code depends on it.

**Phase 2 — Data layer**: `getCohortMembers(supabase, { minDays, maxDays
})`, `createBulkOutreachDrafts(supabase, { memberIds, subject, body,
staffUserId })`, and `getWeeklyActivityTrend(supabase, { weeks: 8 })`
(Decision 4) in `lib/members/queries.ts` / a new `lib/outreach/queries.ts`
— plain functions, no chatbot involvement, reusable if a future chatbot
intent ever wants bulk drafting or a trend summary too.

**Phase 3 — Page shell**: `app/retention/page.tsx` server component
(role gate, initial cohort-counts fetch), nav entry, route wiring — no
real interactivity yet, just confirms the page loads and is properly
gated.

**Phase 4 — Icons + visual system**: hand-author the ~11 new icons
(Decision 5), establish the page's CSS section in `app/globals.css`
against real tokens.

**Phase 5 — Interactive experience**: `retention-experience.tsx` — cohort
selection (real counts), campaign field editing, composer, incentive
toggle (message-copy-only), live preview (real cohort member, Decision 7),
and the activity trend chart wired to `getWeeklyActivityTrend` (Decision 4)
instead of hardcoded values.

**Phase 6 — Batch draft creation + real delivery**: wire "Launch" to
Decision 1's bulk-draft creation, with honest UI copy distinguishing
cohort headcount from actually-reachable count; update `outreach-send.ts`
so sending (single or bulk) inserts the `chat_messages` row; confirm
created drafts are visible/actionable through the existing single-member
outreach flow.

**Phase 7 — Promotions card + auto-popup (Decisions 9–10)**: the
dashboard Promotions card sourced from `outreach_messages`, the
`localStorage` seen-tracking mechanism, and the `ChatbotOverlay` auto-open
check keyed on `is_promotional`. Depends on Phase 1's `is_promotional`
column and Phase 6's real delivery existing to have something to show.

**Phase 8 — QA pass**: role gating (client account cannot reach
`/retention`), real cohort counts against seeded data, a full
create-cohort → compose → launch → send → verify-message-appears-in-that-member's-chat-AND-on-their-dashboard-AND-triggers-auto-popup
walkthrough (both for the new bulk page and the pre-existing single-member
flow), responsive check, branding audit (grep for any leftover
"Fitbot"/"Maya" string).

## Acceptance criteria

- [ ] `/retention` is reachable only by staff/admin; a client account is
      redirected, matching `/staff`'s existing behavior.
- [ ] All 3 cohort buckets show real, live counts from `members` via the
      extended `search_members_by_attributes` — no hardcoded 312/248/176.
- [ ] "Launch" creates one real `outreach_messages` draft row per cohort
      member; sending (single or bulk) inserts a real `chat_messages` row
      into that member's FitBot history, verified by querying it directly.
- [ ] UI clearly shows cohort headcount vs. actually-reachable-via-FitBot
      count (members without an account are never silently counted as
      reached).
- [ ] The existing single-member outreach flow (`outreach-send.ts`) also
      delivers via `chat_messages` after this change — verified with a
      pre-existing draft, not just new bulk-created ones.
- [ ] Zero occurrences of "Fitbot" anywhere in the new page's rendered
      output or source (grep-verified).
- [ ] No new npm dependencies (`@fontsource/fredoka`, `@phosphor-icons/react`)
      — icons hand-authored, fonts reused from the existing setup.
- [ ] Live preview shows a real member from the selected cohort, not a
      hardcoded "Maya"; the Maya avatar asset is not copied into the repo.
- [ ] Page visually matches GitFit's existing token system (colors,
      radii, shadows) — spot-checkable against the GitFit Design project
      synced earlier this session.
- [ ] The activity trend chart renders real weekly distinct-booking-member
      counts from `getWeeklyActivityTrend`, not the mockup's hardcoded
      11-point array.
- [ ] The client dashboard's Promotions card shows real `outreach_messages`
      rows for the logged-in member, most recent first.
- [ ] A newly-sent promotional message causes `ChatbotOverlay` to
      auto-open on the recipient's next page load, showing the message;
      an ordinary (non-promotional) chatbot reply never triggers auto-open.
- [ ] `npm run lint` and `npx tsc --noEmit` pass.

---

## Approval status

All 10 decisions above are confirmed by the user, with one deviation from
the original recommendation: **Decision 4 (activity trend chart) is
building for real**, not dropped — see its updated section above for the
concrete "distinct members with ≥1 booking per ISO week" definition. Every
other decision (1–3, 5–10) is confirmed exactly as originally recommended.

Ready for the EXECUTE phase (Codex handoff) whenever implementation
begins — no code has been written yet.
