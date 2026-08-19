# Iteration 7 — Elevation Plan v1 (pre-review) — Loop 3 begins

## Where the design stands after loops 1-2

Landing, dashboard (ring-charge), appointments (photos), auth (arc), nav
(route-aware), FitBot (rich cards), and staff console are all elevated.
Found by inspecting current code:

1. **No app icon/favicon exists at all.** No `app/icon.*`, no
   `public/favicon.ico`, no `icons`/`themeColor` in `app/layout.tsx`'s
   `Metadata`. The browser tab still shows the generic Next.js default —
   a real "unfinished software" tell for a product this polished
   everywhere else.
2. **No toast/notification system.** Every mutation (class reserve/cancel,
   sign-in/up errors, staff outreach send) surfaces feedback as plain
   inline text near the triggering control. Every genuinely professional
   product in this niche (Whoop, Strava, ClassPass) confirms actions with
   a transient, branded toast — this app has none.
3. **Workout and outreach chat cards (built iter 4) have never been
   visually verified live** — only the schedule card has been screenshot-
   checked. Worth confirming they actually render well, and fixing on
   sight if not (bounded — no new design, just verification + fix).

## Scope

**Primary: a branded toast/notification system.**
- A small `<Toaster>` mounted once (root layout, client component),
  imperative API (e.g. a tiny event-based or context hook) so any
  client component can fire `toast.success(...)`/`toast.error(...)`.
- Used for: booking reserve/cancel confirmation (replacing/augmenting the
  current inline text), sign-in/sign-up errors (currently inline red
  text — keep inline AND toast, or just elevate the pattern — reviewers
  weigh), staff outreach "Send when ready" confirmation.
- Visual: consistent with the design system (surface-card treatment,
  brand-accent left rule by kind — success=teal, error=danger), slide/fade
  in, auto-dismiss, dismissible, ONE at a time or stacked (reviewers weigh).
- No new dependency — hand-rolled (small, well-scoped surface area).

**Secondary: app icon + browser chrome.**
- Real favicon/app icon using the brand mark (gradient GitFit
  "G"-adjacent glyph or the MomentumArc), `app/icon.tsx` (Next 16 supports
  generating icons — verify convention) or a static `app/icon.png`/
  `public/favicon.ico`. Add `themeColor` (ink) to metadata for mobile
  browser chrome.

**Tertiary: verify + fix workout/outreach chat cards live** if anything
looks broken/unstyled — bounded fix, not new design.

## Guardrails carried forward
- Reduced-motion respected for any toast animation.
- No new npm dependency.
- No color-only encoding (success/error always paired with icon/text).
- No new heavy client bundle; keep the toast primitive small.

## Open questions for reviewers
- Toast stacking (one at a time vs multiple) and placement (corner vs
  top-center)?
- Should inline error text be REPLACED by toasts or complemented (a11y:
  toasts can be missed by screen readers if not done right — is inline
  still needed as the primary a11y channel, with toast as visual
  reinforcement)?
- Icon: literal wordmark-derived glyph vs an abstract mark — what reads
  best at 16x16/32x32 favicon size (the wordmark's gradient text won't
  survive that scale)?
- Highest-leverage single change.
