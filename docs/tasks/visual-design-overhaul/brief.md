# Brief: Visual design overhaul (Phase 12, requested out of order)

## Scope

Full design-system overhaul of the GitFit Suite: elevate every screen to a
premium, cohesive fitness-tech product, per the user's detailed request
(branding change, design tokens, motion, FitBot redesign, restraint
principles). All existing functionality/flows preserved exactly — this is
presentation only, no behavior changes.

## Current-state findings (why this matters)

Inspected `app/globals.css` and every page/component. Found a real,
user-visible inconsistency the redesign must fix, not just polish:

- **Landing (`/`), chat (`/chat`), appointments (`/appointments`)** use a
  bespoke brand-token CSS system: custom properties (`--teal`, `--violet`,
  `--magenta`, `--ink`, `--paper`), Baloo 2 for display type, Inter for
  body, a hand-rolled component-class system (`.button`, `.card`-ish
  classes, `.module-card`, etc.).
- **Sign-in, sign-up, dashboard, staff pages** (built in Phase 1, before
  the brand system existed on this page) use **raw generic Tailwind slate
  utilities** (`bg-slate-900`, `text-slate-700`, `rounded-md`) with zero
  connection to the brand — no Baloo font, no teal/violet/magenta, a
  plain `teal-600` button that isn't even the real brand teal. This is
  exactly the "doesn't feel like one product" problem in the user's ask.
- Existing scale is inconsistent: border-radius values in the wild range
  8/9/10/12/13/14/16/18px with no system; shadows are ad hoc per
  component; magenta is used interchangeably as both a brand accent color
  AND an error/danger color (conflates brand identity with error
  semantics — a real refinement opportunity).
- Icons are Unicode glyphs (✦ ◌ ↗ ◆ →), not a real icon system.

## Design system plan

**No new npm dependency for icons** — hand-authored inline SVG icon
components (consistent 24×24 viewBox, ~1.75px stroke, line-style),
matching this project's existing zero-new-dependency posture rather than
pulling in an icon library, which would itself be a dependency-approval
question this presentation-only task shouldn't need to raise.

**Tokens** (Tailwind v4 `@theme` block in `globals.css`, so utilities like
`bg-ink`/`text-violet` become available everywhere, replacing the
disconnected slate utilities on the auth pages):
- Brand colors kept (teal/violet/magenta/ink/paper) plus refined
  surface/border/muted-text tokens.
- **New**: a dedicated `danger` (red) token separate from magenta —
  magenta stays a brand accent, not an error color; a `warning` (amber)
  token for pending/draft states; teal continues to mean
  positive/available/success.
- Gradient (`--gradient-brand`) reserved for: the GitFit wordmark, primary
  CTA buttons, the FitBot launcher, and a small number of accent moments
  — not swept across every surface.
- Consolidated radius scale (sm/md/lg/xl/full) and elevation/shadow scale
  (sm/md/lg/xl, ink-tinted not black), replacing the current ad hoc mix.
- Type scale built on the existing Baloo 2 (display/headings) + Inter
  (body) pairing — no new fonts.

**Component primitives** (semantic classes + Tailwind, matching this
codebase's existing pattern rather than switching to a different styling
approach mid-project): buttons (primary/secondary/ghost/danger), inputs +
field/label/error pattern, cards (static + interactive-hover), status
badges/pills (success/warning/danger/neutral/brand), nav bar, empty
states, loading skeletons, a confirm/modal panel pattern, table/list rows
for any tabular presentation.

**Motion**: kept deliberately restrained per the user's explicit "avoid
constant animation" — hover/press states on interactive elements, card
entrance/hover lift, panel open/close transitions for FitBot, a proper
loading-skeleton instead of plain "Loading…" text, `prefers-reduced-motion`
respected.

## Branding change (explicit user requirement)

- Remove the standalone "G" mark (`.brand-mark`) everywhere it appears
  (nav, appointments header).
- The "GitFit" wordmark becomes the primary brand element, rendered with
  the brand gradient applied directly to the text (`background-clip:
  text`), not a background chip.

## Sequencing (staged Codex handoffs, each visually verified via browser
screenshots before proceeding, each committed once verified)

1. Design-system foundation in `globals.css` (tokens + primitives) +
   wordmark/branding change + `SiteNav` + `ModuleCard` + landing page
   (`/`) — the marketing surface, proves the system out first.
2. Auth pages (sign-in, sign-up, dashboard, staff) migrated from raw
   Tailwind slate onto the new system — this is where the inconsistency
   is worst, highest-impact fix.
3. `/chat` (full-page) + FitBot overlay — the AI-interface-specific
   polish the brief calls out by name.
4. `/appointments` — schedule cards, day tabs, confirm panel, empty/
   loading states.
5. Final consistency pass across all pages together, fix any drift found
   during review.

## Acceptance criteria

1. Every authenticated and public page visually reads as the same
   product — verified by screenshot comparison across pages, not just
   individual-page review.
2. No standalone "G" icon remains anywhere; wordmark carries the gradient.
3. Sign-in/sign-up/dashboard/staff no longer use generic slate Tailwind
   classes — they use the same token system as the rest of the app.
4. All existing functionality verified still works after the visual
   changes (sign-in/up, chat send, booking reserve/cancel, FitBot open/
   close/send) — this is a presentation-only change, functionality must
   be provably unaffected.
5. `npm run lint` / `npm run build` pass after every stage.
6. Motion is present but restrained — no `prefers-reduced-motion`
   violations, no janky/excessive animation.
