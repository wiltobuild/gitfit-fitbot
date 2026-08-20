# Loop 4 — proposal: leaning toward the `gitfit-yoga-booking` reference

Not yet implemented. Written per the user's request (2026-08-19) to
propose before touching code, same gate as loops 1–3 and as
`operations-dashboard`'s Phase A. Reference material lives at
`gitfit-booking-static-package/` (gitignored, reference-only, to be
deleted once this loop is done — see `docs/agent/decisions.md`).

## What the reference actually is

A static export of `gitfit-yoga-booking` — a teammate's (`riarusso`,
same author as the earlier `pulse-studio-prototype`) member-booking app.
Its own README recommends iframe-embedding it wholesale, the same pattern
used for the now-deprecated `pulse-studio-prototype` embed. **Not doing
that** — the 2026-08-18 architecture pivot already moved this repo away
from depending on iframed external prototypes, and the user separately
scoped this to visual language only, not the credit/class-pass booking
model the reference actually runs on.

## The tokens already match — this is not a brand departure

The reference's own CSS defines:
```
--color-vital-teal:#1fc2ae   --color-drive-violet:#6e3fe0
--color-energy-magenta:#c43fd6   --color-ink:#141b3c
--font-baloo:"Baloo 2"   --font-inter:"Inter"
```
`app/globals.css` already has the same values under different variable
names (`--color-teal`, `--color-violet`, `--color-magenta`, `--color-ink`,
`--font-display`/`--font-body`), plus a near-identical
`--gradient-brand: linear-gradient(105deg, teal, violet, magenta)` versus
their `bg-signature-gradient: linear-gradient(135deg, ...)`. Both sides
are executing the same `docs/build-doc.md` brand spec — the gap is in how
confidently that spec gets applied at the component level, not in the
tokens themselves.

## Concrete patterns worth adopting (extracted from the actual markup)

1. **Ambient background wash** — `.bg-luxury-pattern`: two radial
   gradients at ~5% opacity (teal top-right, magenta bottom-left) on the
   paper base. Subtle, matches this app's existing restraint, adds
   richness to otherwise flat page backgrounds (dashboard, staff console)
   for near-zero cost.
2. **Badge chip pattern** — pill, `bg-white/90` + `backdrop-blur-md`,
   hairline border, `shadow-sm`, small brand-colored icon + label —
   overlaid on instructor/class photos for credential/status tags. Maps
   cleanly onto this app's existing `--radius-*`/`--shadow-*` tokens.
3. **Single-hue state ladder for buttons** — a "confirmed" button uses one
   accent color at three opacities: `10%` fill, `30%` border, `100%` text
   (their "Spot Confirmed" state, magenta). Reads as a state of the same
   action rather than a separate disabled-grey button — worth adopting
   for this app's own confirmed/pending button states.
4. **Capacity bar with status-colored label** — thin (`h-2`) rounded
   track, fill colored by state (a darker teal for healthy, rose for
   full), paired with an icon + "Capacity" label and an alert icon at
   full. More legible at a glance than the live Staff Console's current
   badge-plus-bar treatment; same information, better encoded.

## Two things that need your call before I touch anything, not mine to decide silently

- **Gradient on primary CTA buttons outside chat.** `docs/build-doc.md`
  says *"don't gradient-fill chat bubbles or buttons... for the chatbot
  specifically"* — the reference gradient-fills its main booking CTA
  (`bg-signature-gradient` on "Reserve Spot"). The brand doc's wording is
  chatbot-scoped, so this may not even conflict, but it's a real brand-rule
  read, not a free choice: should non-chat primary actions (Reserve/Cancel
  a class, Approve a request) get the full gradient fill, or stay flat
  like today and reserve the gradient for chat-only per the doc's literal
  scope?
- **Font on button labels.** The reference sets button label text in
  `font-display` (Baloo 2). `docs/build-doc.md` says *"Inter — every chat
  bubble, every button, every line the user actually reads and replies
  to."* This one reads as a straight deviation, not an ambiguous scope
  question — recommend **not** copying it, keeping buttons on
  `--font-body` as documented, unless you want to formally revise the
  brand doc.

## What I'd leave alone

The reference mixes bespoke hex literals (`text-[#141B3C]`) and raw
Tailwind palette utilities (`slate-100`, `rose-600`) directly in markup
rather than routing everything through named tokens. This app's
`var(--color-*)` system is more disciplined — not something to regress
toward for the sake of matching the reference's surface look.

## Scope boundary

Visual only, per the 2026-08-19 decision: no credit/class-pass booking
model, no CSV import, no amenities/marketing section — none of those are
features this app has or was asked to adopt. If approved, this becomes
Loop 4 iterations following the same adversarial-pair review pattern as
loops 1–3, then `gitfit-booking-static-package/` gets deleted per the
reference-only agreement.
