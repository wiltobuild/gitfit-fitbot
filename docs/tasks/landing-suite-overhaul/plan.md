# Plan: landing-suite-overhaul

Read in full: `docs/tasks/landing-suite-overhaul/brief.md` (authoritative scope) and
`docs/tasks/landing-suite-overhaul/investigation.md` (Argus's findings — cited
throughout as "Argus §N"). Also read directly: `app/page.tsx` (58 lines, current
state confirmed identical to Argus's paraphrase) and the cited `app/globals.css`
blocks (`.landing-shell` line 387, `.hero`/`.hero-copy`/`.hero-momentum` lines
396–408, `.starter-section` line 409, responsive blocks lines 416–417, footer
rule inside line 409's chain).

This plan resolves 7 decisions (the 6 the role packet named, plus one it didn't
that surfaced while cross-checking scope: CTA destinations for signed-out
visitors). Nothing below has been implemented — this is the specification for
approval.

---

## Decision: Hero visual — which asset, size, and how to absorb the GIF weight

### Evidence
- Brief (line 15) permits either `/gitfit-icon.gif` or `/gitfit-lockup.gif`.
- Argus §3: `gitfit-icon.gif` is 598×527px, `gitfit-lockup.gif` is 598×682px,
  both ~1.06MB. Every existing usage of both files is a plain `<img>` sized
  down via CSS — nothing resizes the source file itself, and no alt-format
  (WebP/PNG/static) exists in `public/`.
- Argus §3: `gitfit-icon.gif` at 36px/24px is *always* paired with the
  "GitFit" wordmark text and (via `.brand`) the "Pulse Studio" org tag —
  it's the small inline mark, never used large or alone.
- Argus §3: `gitfit-lockup.gif` has exactly one existing large usage —
  `app/appointments/appointments-experience.tsx:68`, `.studio-mark` — a
  white/paper card (`background:var(--paper)`, rounded corners, drop shadow)
  wrapping the GIF plus a `Pulse Studio` caption underneath, placed on a dark
  hero background (`.appointments-hero`) specifically so the GIF's own
  background renders correctly against dark. This is the established pattern
  for "large brand mark on a dark section."
- `app/page.tsx`'s `.hero` (globals.css:396) has `background:var(--color-ink-deep)`
  — dark, same category of surface as `.appointments-hero`.
- Argus §8 (asset weight risk): using either GIF as a large primary visual
  is the first time either file is a large/primary visual rather than a
  small mark; this is a pre-existing asset characteristic, not something
  introduced by this task, and no lighter-weight alternative exists in the
  repo today.

### Options
1. **`gitfit-icon.gif`, large, no card backing** — icon alone, floating on
   the dark hero like `MomentumArc` did (drop-in replacement, same slot).
2. **`gitfit-lockup.gif`, large, wrapped in a `.studio-mark`-style paper
   card** — reuses the exact pattern already proven for "large mark on dark
   background" in `appointments-experience.tsx`.
3. **`gitfit-lockup.gif`, large, no card backing, floating directly on the
   dark hero** — simpler markup than option 2, but untested against this
   GIF's actual transparency/background (Argus did not confirm whether the
   GIF has a transparent or white background baked in).

### Recommendation
Option 2 — `gitfit-lockup.gif`, in a `.studio-mark`-style card, sized to
roughly fill the hero's existing right-hand `.hero-momentum` grid slot
(`min-height:360px`, cap image width around 320–360px, matching the scale
`MomentumArc` currently occupies — `width:min(100%,380px)` per
globals.css:408).

### Why
The lockup (icon + wordmark, per its name and its one existing large
placement) states the brand more completely than the icon alone in the
one spot on this page positioned as the primary visual statement — and
`.studio-mark`'s card treatment is not a new pattern to invent, it's the
exact fix Argus found already shipped for "this GIF, large, on a dark
background." Reusing it costs no new CSS beyond adapting `.hero-momentum`'s
layout math to a fixed card instead of an SVG.

On the ~1.1MB weight: no resize/compress/convert is proposed. Argus
confirmed no lighter asset exists, and producing one (re-exporting a
smaller GIF, or a static PNG fallback) is asset-creation work, not a
presentational edit to `page.tsx`/`globals.css` — it would need original
source files or an export pipeline neither of us has visibility into. This
task ships with the existing file at its existing weight.

### Approval requested
1. Confirm `gitfit-lockup.gif` (not `gitfit-icon.gif`) as the hero visual.
2. Confirm shipping the existing ~1.1MB GIF as-is is acceptable for this
   task, given the Friday ship date and no lighter asset being available —
   or say if a smaller/optimized asset should be produced first (which
   would need to happen outside this task's file scope, before
   implementation starts).

---

## Decision: Suite structure — representing 3 audiences without a wall of text

### Evidence
- Argus §4 (Client-facing): dashboard streak ring, upcoming/recent sessions,
  promotions feed, Fitbot quick action (`client-dashboard.tsx`); class
  booking with day tabs, filters, reserve/cancel with capacity meters,
  instructor showcase (`appointments-experience.tsx`); Fitbot chat scoped to
  "classes, bookings, your schedule, and your goals" (`chat-experience.tsx:25`).
- Argus §4 (Staff-facing): `app/staff/page.tsx` — trainer track (own
  schedule, propose classes, request time off, retention view scoped to own
  students) and manager/admin track within the same page (approve/deny
  time-off and class changes, live attendance register, at-risk members,
  studio-wide fill-rate/leaderboard stats).
- Argus §4 (Admin-facing): `admin-dashboard.tsx` — stat grid (fill rate,
  member lifecycle, tiers, re-engagement, pending time-off), time-off
  approval panel, month/agenda calendar, upcoming-sessions panel.
- Current `.starter-section` (globals.css:409) is already a 2-column grid
  (`.8fr 1.2fr`: heading left, 3-card `.starter-list` right) that collapses
  to 1 column at 800px and the card list to 1 column at 520px — a
  responsive scaffold already exists for a "heading + N cards" layout.
- Brief (lines 18–21) requires client dashboard, booking, staff tools, and
  Fitbot all represented, not just Fitbot.

### Options
1. **3-column "who this is for" grid** (Members / Staff & Studio Leads /
   Fitbot) — one card per audience/feature-set, 2–3 grounded capability
   bullets each, one CTA each. Replaces the existing `.starter-list` 3-card
   row with heavier cards (bullets, not just a single line + arrow).
2. **Tabbed interface** (click "Members" / "Staff" / "Admin" to swap visible
   content in one panel) — more compact vertically, but requires new
   client-side interactivity (state, tab component) in a page that is
   currently a server component with zero client JS.
3. **Long-form stacked sections**, one per audience, each with its own
   sub-heading and paragraph — most text-heavy, closest to "wall of text"
   the role packet was told to avoid.

### Recommendation
Option 1 — 3-column grid, extending/replacing `.starter-section` and
`.starter-list` rather than introducing a new section from scratch.

### Why
It fits the existing responsive scaffold (`.starter-section` already
collapses correctly at both breakpoints), needs no new client-side
JavaScript (`page.tsx` stays a server component — tabs would require a
`"use client"` boundary this page doesn't have today and the brief doesn't
ask for), and three cards is small enough to stay scannable while still
surfacing distinct, grounded capabilities per audience instead of one
generic pitch. Column content, grounded in Argus §4:
- **For members** — book classes, track your dashboard/streak, ask Fitbot.
- **For staff & studio leads** — manage your schedule, handle time off and
  class changes, keep an eye on retention. (See the "staff vs admin"
  decision below for why this is one column, not two.)
- **Fitbot** — kept as its own card/feature (see next decision) rather than
  folded into the members column, since the brief explicitly wants it
  demoted to "one strong feature," which reads more clearly as its own
  card than as a bullet under Members.

### Approval requested
Confirm the 3-column structure (Members / Staff & Studio Leads / Fitbot)
and that this replaces the current 3 "quickStarts" strings entirely rather
than appending a 4th section.

---

## Decision: Fitbot's new role — from whole pitch to one feature

### Evidence
- Brief (lines 46–47, acceptance criterion 4): Fitbot must keep "its own
  real CTA," reduced to "one strong feature," not removed.
- Current hero (app/page.tsx:26,28): hero description is 100% Fitbot copy
  ("Fitbot turns..."), and `Talk to Fitbot → /chat` is the *only* primary
  CTA in the hero.
- Argus §4: Fitbot chat is "a guided assistant, not open-ended chat... built
  to help with classes, bookings, your schedule, and your goals" — real,
  narrow, grounded copy already exists in `chat-experience.tsx:25` to draw
  from instead of inventing new claims about it.

### Recommendation
Two placements, not one:
1. Hero: headline and description broaden to suite-level copy (mentions
   booking/dashboard/team, not just Fitbot); the hero keeps two actions —
   a primary CTA now pointing at sign-up (see the CTA-destination decision
   below) and a secondary "Talk to Fitbot" action, demoted from sole primary
   to one of two hero actions.
2. Suite section: Fitbot gets its own card in the 3-column grid (previous
   decision) with a real CTA (`/chat`) and copy grounded in the
   `chat-experience.tsx:25` framing ("a guided assistant for classes,
   bookings, your schedule, and your goals").

### Why
This satisfies "keeps a real CTA, demoted to one feature" literally: Fitbot
still gets a direct link to `/chat` in the suite grid (a full-weight
feature card, not a passing mention), and the hero's secondary action still
lets a visitor jump straight to chat without reading further, but the hero
copy itself no longer makes Fitbot the entire pitch.

### Approval requested
Confirm two Fitbot touchpoints (hero secondary CTA + suite-grid feature
card) rather than one or the other.

---

## Decision: Pulse Studio placement and phrasing

### Evidence
- Argus §7: three phrasings already ship in the app — bare **"Pulse
  Studio"** org tag (`site-nav.tsx:15`, sign-in/sign-up), **"GitFit at Pulse
  Studio"** (appointments hero eyebrow), **"GitFit for Pulse Studio"**
  (appointments footer tagline).
- `SiteNav` (Argus §6) already renders the bare "Pulse Studio" org tag at
  the top of every page including this one, unchanged by this task (brief
  line 35: `SiteNav`'s own markup is out of scope).
- Current landing hero eyebrow: "Your team is ready" (app/page.tsx:24) — no
  Pulse Studio mention. Current footer: "GitFit • Move with purpose."
  (app/page.tsx:55) — no Pulse Studio mention.
- Brief (line 22–23, acceptance criterion 3): the page must "state clearly,
  visibly" that this is Pulse Studio's platform, naming both audiences
  (clients and staff).

### Options
1. Rely solely on `SiteNav`'s existing bare "Pulse Studio" tag (already
   present, zero new work) — but that tag is small caption text
   (`.brand-org`, 12px) beside the wordmark, arguably not "clearly,
   visibly" stating the platform claim brief asks for on this specific page.
2. Replace the hero eyebrow ("Your team is ready") with **"GitFit at Pulse
   Studio"**, reusing the appointments-hero idiom verbatim in the same slot
   role (eyebrow), plus update the footer to **"GitFit for Pulse Studio"**,
   reusing the appointments footer idiom verbatim.
3. Invent new landing-specific phrasing not seen elsewhere in the app.

### Recommendation
Option 2.

### Why
Argus explicitly flagged (§7) that a new mention "should pick from these
existing idioms rather than invent a fourth" — option 3 is out. Between 1
and 2: option 1 alone doesn't satisfy "clearly, visibly" for this page
specifically (brief calls this out as this page's job, not something to
defer to the nav that's present on every page including the current
Fitbot-only version). Option 2 places Pulse Studio in the single most
prominent unmissable spot (hero eyebrow, first line a visitor reads) and
reinforces it in the footer, using phrasings with in-app precedent so nothing
sounds invented. The audience-naming half of acceptance criterion 3
("clients and staff") is satisfied separately, by the 3-column suite
section naming both audiences directly — not by the Pulse Studio phrasing
itself.

### Approval requested
Confirm "GitFit at Pulse Studio" as the new hero eyebrow (replacing "Your
team is ready") and "GitFit for Pulse Studio" as the new footer text
(replacing "GitFit • Move with purpose.", or appended to it — pick one).

---

## Decision: /staff vs admin-dashboard ambiguity in landing copy

### Evidence
- Argus §4 (closing note): `app/staff/page.tsx` serves both trainer and
  manager/admin roles via internal branching
  (`requireRoleOrRedirect(["staff","admin"])`); `admin-dashboard.tsx` is a
  *separate* component reached via `/dashboard` only when `role === "admin"`.
  These are two different routes/components covering overlapping "staff and
  admin tooling" territory.
- A signed-out first-time visitor has no way to know these are two routes —
  they only see marketing copy, not a site map.

### Options
1. Split landing copy into two cards/claims — "for trainers" vs "for
   admins" — mapped precisely to the two real routes.
2. One combined card/claim — "for staff & studio leads" — describing
   capabilities pulled from both `app/staff/page.tsx` and
   `admin-dashboard.tsx` without asserting which route serves which role.

### Recommendation
Option 2.

### Why
Splitting into two cards would imply a level of route-level precision the
page cannot actually deliver to a signed-out visitor (they can't click
through to see which is which pre-signup), and would double the surface
area of the 3-column grid to 4 columns, working against the "not a wall of
text" goal from the suite-structure decision. A single combined column
describing real, grounded capabilities ("manage schedules and time off,
review requests, track retention") is accurate without overclaiming
structure the visitor can't verify anyway.

### Approval requested
Confirm one combined "staff & studio leads" column (not a staff/admin
split) for the suite-grid.

---

## Decision: CTA destinations for signed-out visitors (added — not in the original 6)

### Evidence
- All of `/dashboard`, `/staff`, `/appointments` are authenticated routes
  (Argus §4 cites `requireRoleOrRedirect` gating on `/staff`; `app/page.tsx`
  itself redirects *signed-in* users to `/dashboard`, implying the inverse —
  signed-out users hitting these routes directly would be gated, though
  Argus's investigation did not trace exactly where `requireRoleOrRedirect`
  sends an unauthenticated request).
- Brief's out-of-scope list (line 27) explicitly excludes changing
  `/sign-in`/`/sign-up` themselves, but says nothing about which page the
  *new* landing CTAs should point to.
- The only real live-and-reachable destination for a signed-out visitor
  besides `/chat` (public, per current code) is `/sign-in` / `/sign-up`.

### Options
1. Point the Members/Staff suite-grid cards at `/sign-up` (the natural
   "get access to this" action for a signed-out visitor).
2. Point them directly at the authenticated routes (`/dashboard`, `/staff`)
   and rely on whatever gate already exists there to bounce to sign-in.
3. Make the cards non-links (descriptive only, no CTA) for the two
   non-Fitbot columns, since Fitbot (`/chat`) is confirmed public but the
   others' unauthenticated behavior isn't confirmed by Argus.

### Recommendation
Option 1 — Members and Staff & Studio Leads cards link to `/sign-up`;
Fitbot card keeps its confirmed-public `/chat` link.

### Why
This needs your confirmation because Argus's investigation didn't verify
`requireRoleOrRedirect`'s unauthenticated behavior (option 2 might work
identically to option 1 today, but that's a guess, not evidence), and I'd
rather ask than have Codex implement a link into a page whose signed-out
behavior wasn't confirmed as part of this investigation. `/sign-up` is
confirmed to exist, is explicitly in-scope-adjacent (brief says it's
untouched but doesn't say it can't be linked to), and is the semantically
correct destination for "I want this" regardless of what the protected
routes actually do when hit while signed out.

### Approval requested
Confirm CTA destinations: Members card → `/sign-up`, Staff & Studio Leads
card → `/sign-up`, Fitbot card → `/chat`. (Or say if Argus/Codex should
first confirm the protected-route redirect behavior and link there
instead.)

---

## Decision: Scope boundary — file layout for the new markup/CSS

### Evidence
- Brief (lines 25–35) scopes this to `app/page.tsx` and does not mention
  new component files; out-of-scope list doesn't forbid new CSS in
  `globals.css` (already the only stylesheet touched for this page today).
- Argus §2/§8: this codebase's convention (matching `chat-experience.tsx`,
  `appointments-experience.tsx`, `client-dashboard.tsx`) is large
  single-file JSX per page with minimal component extraction; `page.tsx`
  itself is already a single 58-line file with no sub-components.
- Argus §8: new class names introduced must get explicit rules added to
  the existing `800px`/`520px` `@media` blocks (globals.css:416–417), since
  those blocks target specific class names, not tag selectors.

### Options
1. Keep everything inline in `app/page.tsx`, add new/modified rules to
   `app/globals.css` only (no new files).
2. Extract the new suite-grid section into a new
   `app/components/suite-section.tsx` component.

### Recommendation
Option 1.

### Why
Matches the codebase's established convention exactly (Argus confirmed
this is how every comparable large page is written), and the new markup
here isn't reused anywhere else on the site — there's no reuse pressure
that would justify breaking from convention to extract a component the
rest of the codebase's pattern doesn't call for.

### Approval requested
Confirm no new component files — all markup stays in `app/page.tsx`, all
new/changed CSS stays in `app/globals.css`.

---

## Phased plan

Each phase is a small, independently reviewable diff. All phases together
touch only `app/page.tsx` and `app/globals.css`.

### Phase 1 — Hero rework
- `app/page.tsx`: remove `MomentumArc` import; replace
  `<div className="hero-momentum">…</div>` with a `<div className="hero-visual">`
  (new class) containing `<img src="/gitfit-lockup.gif" alt="GitFit" />` in a
  `.studio-mark`-style card, dropping the "Move forward" caption (no longer
  applicable to a static brand mark the way it was to the `MomentumArc`
  swirl).
- `app/page.tsx`: change eyebrow text to "GitFit at Pulse Studio"; change
  `<h1>` and `.hero-description` to suite-level copy (mentions booking,
  dashboard, and team/staff tools, grounded in Argus §4, not just Fitbot);
  keep two `.hero-actions`: a new primary CTA → `/sign-up`, and "Talk to
  Fitbot" → `/chat` demoted to secondary/outline button.
- `app/globals.css`: add `.hero-visual` rules adapted from `.hero-momentum`
  (same `min-height:360px`/`place-items:center` slot) wrapping a
  `.studio-mark`-style card sized to `width:min(100%,340px)`; update the
  `800px`/`520px` media blocks' `.hero-momentum` references to
  `.hero-visual` (or add parallel rules) so responsive behavior isn't lost.

### Phase 2 — Suite section
- `app/page.tsx`: replace the `quickStarts` string array and 3
  identical-destination `.starter-card` links with 3 explicit objects
  (label, grounded capability bullets, href, eyebrow/heading text updated
  from "Start where you are" to something reflecting "who this is for").
  Cards: Members (→ `/sign-up`), Staff & Studio Leads (→ `/sign-up`),
  Fitbot (→ `/chat`).
- `app/globals.css`: extend `.starter-card` (or add a `.suite-card`
  variant) to fit 2–3 bullet lines instead of one label line; verify the
  existing `800px` (`.starter-section{grid-template-columns:1fr}`) and
  `520px` (`.starter-list{grid-template-columns:1fr}`) rules still apply
  correctly to any renamed classes.

### Phase 3 — Footer
- `app/page.tsx`: update footer text to include "GitFit for Pulse Studio"
  per the approved phrasing decision.

### Phase 4 — Verification pass
- Run `npx tsc --noEmit`, `npm run lint`, `npm test` — all clean.
- Browser check, signed out: load `/`, confirm hero shows the lockup image
  (not `MomentumArc`), confirm suite-grid renders 3 cards with real
  capability copy, confirm "Pulse Studio" appears in the eyebrow and
  footer, confirm both hero CTAs and all 3 suite-card CTAs navigate to
  their intended destinations.
- Browser check, signed in (any role): load `/` directly, confirm the
  server-side redirect to `/dashboard` still fires immediately — no landing
  markup ever renders.
- Resize/inspect at both 800px and 520px breakpoints, confirm no layout
  break in the new hero-visual or suite-grid markup.

---

## Acceptance criteria (mechanically checkable, for Apollo)

1. `app/page.tsx` contains no reference to `MomentumArc` (grep returns
   nothing); it contains `gitfit-lockup.gif` as the hero's `<img src>`.
2. Live in browser, signed out at `/`: the hero's visual is the GitFit
   lockup image, not an SVG swirl.
3. `app/page.tsx` copy (grep or visual read) includes at least one mention
   each of a booking/schedule capability, a dashboard capability, and a
   staff/team capability — not exclusively Fitbot language in the hero.
4. The suite section renders 3 distinct cards (Members / Staff & Studio
   Leads / Fitbot) with distinct destinations, not 3 identical `/chat`
   links (contrast with current `quickStarts.map` all pointing to `/chat`).
5. `app/page.tsx` contains the string "Pulse Studio" at least twice
   (eyebrow + footer), independent of `SiteNav`'s own always-present tag.
6. Fitbot retains a real, working CTA to `/chat` somewhere on the page
   (hero secondary action and/or suite-grid Fitbot card).
7. Signed-in behavior unchanged: hitting `/` while signed in (any role)
   redirects server-side to `/dashboard` with no landing markup ever
   rendered — verified live in browser (Network tab shows a 307/308 to
   `/dashboard`, or the rendered page is the dashboard, not this page).
8. `npx tsc --noEmit` exits clean.
9. `npm run lint` exits clean, including no new `@next/next/no-img-element`
   warnings on the new `<img>` usage (Argus flagged this as unconfirmed —
   must be checked live, not assumed).
10. `npm test` exits clean (no test currently targets this page; this
    criterion confirms the overhaul didn't break the existing
    `tests/agent_requirements/*.test.ts` suite).
11. At 800px and 520px viewport widths, the hero visual and suite-grid
    cards reflow without overlap or overflow (checked via browser resize
    or the `@media` rules added in Phase 1/2 covering the new class names).
12. No new files created outside `app/page.tsx` and `app/globals.css`
    (per the scope-boundary decision, pending approval).

---

## Summary of approvals needed before implementation

1. Hero asset: `gitfit-lockup.gif` in a `.studio-mark`-style card; ship at
   existing ~1.1MB weight, no optimization in this task.
2. Suite structure: 3-column grid (Members / Staff & Studio Leads /
   Fitbot), replacing the 3 `quickStarts` cards.
3. Fitbot: two touchpoints (hero secondary CTA + suite-grid feature card),
   demoted from sole hero pitch.
4. Pulse Studio phrasing: hero eyebrow → "GitFit at Pulse Studio", footer →
   include "GitFit for Pulse Studio".
5. Staff/admin ambiguity: one combined "Staff & Studio Leads" column, not
   split by route.
6. CTA destinations: Members/Staff cards → `/sign-up`; Fitbot card →
   `/chat`; hero primary CTA → `/sign-up`, hero secondary → `/chat`.
7. Scope: no new component files; all changes stay in `app/page.tsx` +
   `app/globals.css`.

Once these are confirmed (or amended), implementation proceeds via Codex
per the phased plan above, followed by Themis review and Apollo
verification against the acceptance-criteria list.
