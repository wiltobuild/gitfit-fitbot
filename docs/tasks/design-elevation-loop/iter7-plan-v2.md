# Iteration 7 — Plan v2 (reconciled): finish the workout/outreach cards + scoped toast + favicon

Both reviews reframed this hard. The art director: the toast system as
originally scoped is mostly redundant (appointments already confirms
reserve/cancel via inline text + the `booking-confirmed` spring animation)
— toast has exactly ONE legitimate use, the outreach "Send when ready"
button, which is currently a hard no-op. The bigger, real gap: the workout
and outreach chat cards (built iter 4, never visually verified) look
visibly unfinished next to the schedule card — a bare `<ol>`, no
composition, no per-block treatment, no sense that outreach goes to a real
person. Usability: toast must supplement (never replace) inline feedback,
needs specific aria-live/dismiss-button structure, and error toasts must
never auto-dismiss.

## Primary: finish the workout + outreach chat cards

**Workout card**: differentiate block types visually (warmup / main /
cooldown or however `card.blocks` are shaped — check `lib/chatbot/types.ts`
and `workout-plan.ts`'s actual data) instead of one flat numbered list —
e.g. a small kind-badge or left-accent per block, consistent number
treatment, tighter alignment (name left, sets×reps/detail right, as
originally speced in iter4's plan but apparently not fully realized).
Baloo for the plan title, matching card-header weight used elsewhere.

**Outreach card**: give it real composition — a member-context row (reuse
member-card language: initials avatar + name, NOT a photo — PII rule
stands), a "channel" indicator if the data has one (email/SMS — check
`outreach-draft.ts`), the message body in a clearly-bounded quote/draft
area (visually distinct from UI chrome — e.g. a dashed border or subtle
inset, matching iter4's "dashed or warning-accent, send-gate" spec), and
"Nothing sent yet" microcopy already speced. Character count if useful.

## Secondary: toast — scoped to outreach send ONLY

- A small `<Toaster>` primitive, root-mounted, but used at exactly ONE call
  site: the outreach card's "Send when ready" button. NOT used for
  appointments reserve/cancel (already has adequate inline+animated
  confirmation) or auth errors (must stay inline/persistent).
- Visual (art director): reuses `.surface-card` + `.badge` conventions —
  NOT gradient-branded (gradient stays reserved for CTAs/signature ring
  motion). 3px left rule in success/danger color + matching icon (never
  color-only). ~340px, bottom-right or bottom-center (implementer's call,
  single visible toast).
- Structure (usability, non-negotiable):
  - Two EMPTY live regions mounted at root from first render (before any
    toast exists): one `aria-live="polite"` for success, one
    `aria-live="assertive"` for error. Only mutate text content per toast
    — don't dynamically insert/remove the container itself.
  - The `aria-live` attribute sits on an INNER span holding ONLY the
    message text. Any dismiss/undo button is a live-region SIBLING outside
    that span — mirrors the iter-4 reply/card split exactly. No
    interactive control inside the announced node.
  - Single visible toast, queued (not a stack) — avoids overlapping
    announcements racing on AT.
  - Success toasts: minimum 5s, pause-on-hover/focus, user-dismissible.
  - Error toasts: NO auto-dismiss — user-dismiss only.
  - Motion: CSS transition/animation ONLY if at all possible (rides the
    existing blanket `prefers-reduced-motion` rule for free — no new JS
    motion code needed). If a JS-timed animation is used anyway, it MUST
    follow the iter-5 `matchMedia` + change-listener pattern, no
    exceptions.
- Bonus fix while touching this area (usability flagged a real
  pre-existing bug): `appointments-experience.tsx`'s `.appointments-error`
  paragraph has NO `aria-live` at all today (worse than sign-in/up, which
  correctly has one) — add `aria-live="polite"` to it. Small, independent,
  low-risk fix.

## Tertiary: app icon / favicon
- Static (non-animated, non-gradient) mark: a partial-circle arc (same
  visual language as MomentumRing, echoing the brand's signature motif),
  SOLID `--color-teal` stroke on transparent — gradients dither badly at
  16-32px and browsers often composite favicons on unpredictable
  backgrounds. Optional ink-navy circular backing plate only if needed for
  contrast insurance in dark browser tab bars.
- `app/icon.png` (or `app/icon.tsx` IF it cleanly rasterizes to a static
  PNG at build — verify, don't fight the framework) at minimum 32×32;
  Next 16 convention — check docs. Add `themeColor` (ink) to
  `app/layout.tsx`'s `Metadata` for mobile browser chrome.

## Explicitly NOT doing (per art director's redirect)
- No broad toast usage beyond outreach send.
- No new notification-library dependency.
- No stat band / scroll-reveal / other previously-cut items.

## Verification
- lint + build green.
- Live: outreach card in FitBot renders with real composition (member
  context row, bounded draft area); clicking "Send when ready" shows a
  single toast, error case doesn't auto-dismiss, success case does after
  ≥5s or on manual dismiss; workout card shows differentiated blocks.
  Favicon visible in browser tab.
- Regression audit: focus-visible/aria-label/aria-live counts; confirm no
  interactive control sits inside an aria-live node (toast or otherwise);
  appointments error now has aria-live.
