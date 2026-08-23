# Investigation: retention-campaign-page

## Verified facts

### 1. What the mockup actually is

Source: `C:\Users\Wil\Downloads\fitbot-reconnect-team-export\` (extracted
from `fitbot-reconnect-team-export.zip`). A standalone Vite 6 + React 19
SPA, package name `fitbot-reconnect`. Plain client-render mount
(`src/main.jsx:6-10`: `createRoot(...).render(<App />)`), no routing
library, no server, no real API calls anywhere — confirmed by reading
`src/App.jsx` in full (351 lines, one component tree, all state is local
`useState`).

**Its own README is explicit about its status** (`README.md:36-45`,
"Future integration boundary"): *"The current experience uses local React
state and realistic mock data. When integrating into Fitbot, replace the
cohort and campaign state with adapters for: 1. Member/cohort data... 2.
Delivery providers for push, email, and SMS. 3. Authentication and
operator permissions. 4. Campaign persistence, scheduling, and
analytics."* — i.e., the mockup's own authors flagged every one of these
as not-yet-real, which matches what reading the code confirms.

### 2. Feature inventory (`src/App.jsx`)

- **Cohort selector** (`:19-23`): 3 hardcoded buckets — `"7–14 days
  inactive"` (312 members), `"14–30 days inactive"` (248), `"31–60 days
  inactive"` (176) — each with a canned "insight" string. Clicking a
  cohort just swaps which hardcoded object is "selected"; nothing is
  queried.
- **Campaign fields** (`:25-31`, `:239-247`): goal, channel (a string like
  `"Push notification + email"`), send time (a free-text string, not a
  real datetime), and message body — all editable via a generic modal
  (`:304-323`) that writes back into local state only.
- **Composer** (`:249-264`): push/email tab toggle (cosmetic only — same
  message text is used for both previews), a 240-char-limited textarea, an
  "Add an incentive" toggle that only changes displayed copy
  (`"7-day premium pass added."`) — no real incentive/coupon system
  exists anywhere in GitFit.
- **Actions** (`:265-269`, `:325-335`): "Save draft" / "Send test" / "Launch
  comeback" all just call `notify(...)` (a 2.6s toast, `:146-149`) or open
  a success modal claiming *"`{count}` demo members will receive the
  campaign on `{sendTime}`"* — no network call, no persistence, nothing
  survives a page reload.
- **Live preview rail** (`:273-301`): a hardcoded demo member "Maya"
  (`/maya-avatar.png`, a real generated raster image, not a placeholder),
  a push-notification preview card, an email preview card, and a static
  4-item "readiness checklist" that's always checked.
- **Activity trend chart** (`:33-115`): a hand-rolled canvas line chart
  with **11 hardcoded data points** (`values` array, `:46`) and hardcoded
  axis labels (`"Jun 25"` through `"Aug 20"`, `:105-111`) — not derived
  from any data source.

### 3. Branding to strip (per the user's explicit instruction)

- Header brand mark: `<span>Fitbot</span><strong>Reconnect</strong>`
  (`:170-173`).
- Section label: `"FITBOT INSIGHT"` (`:228`).
- Default message body ends `"– Your Fitbot"` (`:30`).
- Push preview sender name: `"Fitbot"` with app-mark letter `"F"`
  (`:283-284`).
- Email preview sign-off: `"– Your Fitbot"` (`:292`).
- Document title: `"Fitbot Reconnect"` (`index.html:8`), meta description
  "A standalone Fitbot re-engagement campaign workspace."
- The demo member avatar filename `maya-avatar.png` and the name "Maya"
  itself are not GitFit-branding per se (it's a generic demo-person name,
  distinct from the "Fitbot" assistant-branding issue) — not flagged for
  removal by the user's instruction, but worth a decision either way in
  planning since "Maya" is meaningless in GitFit's context (no member by
  that name is guaranteed to exist).

### 4. Visual design vs. GitFit's real tokens

`AGENTS.md:14` claims the mockup is "grounded in the live GitFit/Fitbot
site" (warm off-white page, deep navy text, cyan-to-violet accents, teal
status). In spirit, yes — but the actual hex values in `src/styles.css`
are **entirely bespoke, not GitFit's real CSS custom properties**:

| Mockup color (approx role) | Mockup hex | GitFit's real token |
|---|---|---|
| Ink/text | `#101d4b` | `--color-ink` `#141B3C` |
| Teal accent | `#1ac1d2` / `#1cc7ce` / `#1ebbb8` / `#2bc9d1` | `--color-teal` `#1FC2AE` |
| Violet accent | `#5e6ae7` / `#7442ea` / `#7c34df` / `#7c42e8` / `#9d35eb` | `--color-violet` `#6E3FE0` |
| Magenta accent | `#b526e2` / `#b629e1` | `--color-magenta` `#C43FD6` |
| Page background | `#faf9f7` | `--color-paper` `#F8F7F5` |

Close in hue family (someone clearly eyeballed the real site), but every
single value needs remapping to GitFit's actual `@theme` tokens
(`app/globals.css:20-59`) during integration — reusing the mockup's CSS
file as-is would introduce a second, drifting color system.

Fonts: mockup uses `@fontsource/fredoka` (display) + `@fontsource/inter`
(body) as **self-hosted npm font packages** (`package.json:14-15`).
GitFit's real fonts are **Baloo 2** (not Fredoka — a different rounded
display face, similar vibe but not the same typeface) and **Inter**
(matches), loaded via `next/font/google` in `app/layout.tsx:2,9-17`, not
self-hosted npm packages. The Inter match is free; the display face is
not — Fredoka and Baloo 2 are visually similar (both rounded, geometric)
but are different type families with different letterforms and metrics.

Icons: `@phosphor-icons/react` (`package.json:16`). GitFit's existing
codebase uses hand-authored inline SVGs (`app/components/icons.tsx`,
confirmed throughout this whole project's history — `MomentumArc`,
`IconCalendar`, `IconShield`, etc.) — no icon library dependency exists
anywhere in GitFit today. Adding Phosphor would be the first icon-library
dependency in the app.

### 5. GitFit's real data model for this feature

**`outreach_messages`** (`supabase/migrations/0009_outreach.sql:4-13`,
retargeted in `0012_retarget_outreach_and_search_members.sql:3-11`):
`id`, `target_member_id` (FK → `members`), `staff_user_id` (FK →
`auth.users`), `subject`, `body`, `status` (`'draft'|'sent'` only —
**two states, not the mockup's draft/test-sent/scheduled/launched
spectrum**), `created_at`, `sent_at`. RLS: staff-wide select, own-row
insert (`0009_outreach.sql:17-24`).

**Critically: no channel field, no scheduled-send-time field, no
per-member/per-cohort batching concept, no incentive field.** The
existing outreach flow (`lib/chatbot/intents/outreach-draft.ts`,
`outreach-send.ts`) is **strictly one message to one member at a time** —
draft it, then a separate "send" flips `status` to `'sent'` and stamps
`sent_at`. There is no bulk/cohort operation anywhere in the schema or
codebase today.

**No delivery infrastructure exists at all.** "Sent" (`outreach-send.ts`)
only means "the `status` column flipped to `'sent'` in the database" — no
push notification service, no email service (no SendGrid/Resend/SES
integration, no `RESEND_API_KEY`-shaped env var, nothing), no SMS. Grepped
the whole repo for any delivery-provider reference — none. A real member
receives literally nothing when an existing outreach message is "sent"
today; it's an internal staff record only, not a member-facing send.

**Cohort/segmentation data that exists**: `members.lifecycle_status`
(`'active'|'at_risk'|'lapsed'`, `0011_members_table.sql:15`) — a
3-bucket categorical status, **not** the mockup's day-range buckets
(7–14/14–30/31–60 days inactive). `getRetentionCandidates`
(`lib/chatbot/intents/retention-lookup.ts:7-8`) filters purely on
`lifecycle_status in ('at_risk','lapsed')`, no day-range math.

**However — day-range staleness IS already a first-class, live query
mechanism**, just not surfaced as cohort buckets anywhere in the UI yet:
`search_members_by_attributes` (`supabase/migrations/0013_members_by_attribute_search.sql:1-9`,
already wired to `lib/chatbot/intents/members-by-attribute.ts` via
`lib/members/queries.ts`'s `searchMembersByAttributes`) takes a
`p_stale_after_days int` parameter and filters
`m.last_visit_date <= current_date - p_stale_after_days`, ordered by
`last_visit_date asc`. This is a lower-bound-only filter today ("at least
N days stale"), not a bounded range — but a bounded range (`7–14 days`,
`14–30 days`, `31–60 days`) is a trivial extension (add an upper-bound
parameter, or just filter the already-fetched result set in application
code by computing `daysSinceVisit` from the returned `last_visit_date`).
**This means the mockup's day-range cohort model is realistically and
cheaply buildable against real data — it does not need to collapse back
to the coarser `lifecycle_status` model**, correcting the "medium
confidence" inference below.

**No activity-trend / time-series data exists.** Nothing in the schema
tracks weekly member-activity counts historically; the mockup's canvas
chart has no real backing data source to draw from without new
aggregation logic (which itself would need to decide what "activity"
even means server-side — bookings created per week? distinct active
members per week? neither is computed anywhere today).

### 6. Existing staff/admin page conventions to match

- **Server/Client split**: every existing staff-facing page follows
  Server Component (data fetch + role gate) → Client Component (`"use
  client"`, interactivity) — e.g. `app/staff/page.tsx` (server,
  `requireRoleOrRedirect(["staff","admin"])`) renders `<MemberSearch />`
  and `<StaffFitBotTiles role={role} />` (both client). `app/appointments/
  page.tsx` (server) renders `<AppointmentsExperience bookedThisWeek
  userEmail />` (client). The mockup's `App.jsx` is a single monolithic
  client component with zero data-fetching — would need to be split the
  same way, with a new server page component doing the real Supabase
  reads and passing them as props.
- **Role gating**: `requireRoleOrRedirect(role: "staff" | "admin" |
  Array<"staff"|"admin">)` (`lib/auth/session.ts:72`) is the established,
  reusable gate — same one used by `/staff`. A staff/admin-only page is a
  ~1-line addition (`await requireRoleOrRedirect(["staff","admin"])`,
  matching `app/staff/page.tsx:21`), no new auth mechanism needed.
- **Nav registration**: `app/components/nav-links.tsx:12-21` — the nav
  link array is role-conditional (`role === "staff" || role === "admin"
  ? [...links, staffLink] : links`); a new page's nav entry would extend
  this exact pattern, one line.
- **Existing route namespace**: current top-level routes are flat
  (`/dashboard`, `/appointments`, `/chat`, `/staff` — no nested routes
  anywhere in `app/`). A new page most naturally continues that
  convention as a new top-level route rather than nesting under `/staff`.
- **Card/badge/button CSS classes**: `.surface-card`, `.badge-*`,
  `.btn-*`, `.empty-state`, `.skeleton` (all in `app/globals.css`,
  cataloged in this session's earlier GitFit Design project sync) are the
  established primitives every other page composes from — the mockup's
  bespoke component CSS (`src/styles.css`, 357 lines of hand-rolled
  classes like `.cohort-row`, `.campaign-table`, `.push-preview`) would
  need to be re-authored against these existing primitives, not ported
  wholesale, to avoid a second parallel design language living in the
  same app.

### 7. Non-app files in the export (Sites-platform plumbing, not relevant to Next.js integration)

`.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`,
`tests/sites-worker.test.mjs`, `.npmrc`, `pnpm-workspace.yaml`,
`pnpm-lock.yaml`, `dist/` (a prebuilt output) — all specific to deploying
this standalone Vite app to "OpenAI Sites" hosting (per `AGENTS.md:9`
explicitly referencing "a Sites handoff"). None of this is needed for or
relevant to integrating into the existing Next.js app; only `src/App.jsx`
and `src/styles.css` (and the visual reference PNGs, for design
comparison) are actually useful source material. `design-qa.md` confirms
the QA was performed against this standalone build, not against GitFit
itself — its "passed" verdict is about mockup-vs-mockup-design fidelity,
not about correctness against the real app or real data.

## Inferences

- **High confidence**: "connect to the dataset and work as advertised"
  cannot mean literally what the mockup shows (real push/email delivery
  to real members, real scheduled sends, real day-bucketed cohorts) —
  none of that infrastructure exists in GitFit today. The planner needs
  to define what "launch" honestly means against the real
  `outreach_messages` table (most plausible: creating one draft
  `outreach_messages` row per cohort member, staff-reviewed the same way
  a single-member draft is today — an internal record, not a real send)
  and present that gap to the user explicitly rather than silently
  building something that looks like it sends real notifications but
  doesn't.
- **High confidence** (upgraded from medium after finding
  `search_members_by_attributes`'s existing `p_stale_after_days` param):
  the mockup's day-range cohort model is realistically buildable against
  real data now, likely by extending the existing RPC or filtering its
  result set in application code — not a speculative future feature.

## Unknowns

- Whether the user wants the activity-trend chart at all, given it has no
  real backing data source today and would require new aggregation logic
  (and a decision about what "activity" means) to be genuinely real rather
  than another hardcoded visual.
- Whether "Maya" (the demo member name/avatar) should be replaced with a
  real dynamic preview (e.g., the first/an example matching real member)
  or kept as a clearly-labeled illustrative placeholder — not addressed by
  the user's branding instruction, which named only "Fitbot" specifically.

## Risks

- Building this as advertised (real push/email delivery, real scheduling)
  would require entirely new infrastructure (a delivery provider
  integration, a scheduler/queue, a channel field, a scheduled-send
  mechanism) — a materially larger scope than "integrate an existing page
  cleanly." The plan must draw an explicit line around what ships now
  (an honest internal-draft-creation tool) vs. what would be a separate,
  much larger future task (real delivery).
- Porting `src/styles.css` wholesale (bespoke hex values, Phosphor icons,
  Fredoka font) would create a second, drifting visual language inside
  GitFit — every color, icon, and the display font need deliberate
  remapping to existing tokens/components, not a copy-paste.
- The mockup's day-range cohorts and GitFit's `lifecycle_status` are two
  different, not-necessarily-aligned segmentation models (`lifecycle_status`
  is set once per member in seed data, not recomputed live from
  `last_visit_date`) — the plan should pick the live day-range model as
  authoritative for this page (it's real-time and matches the mockup's own
  framing) and treat `lifecycle_status` as a separate, secondary signal if
  shown at all, rather than conflating the two.
