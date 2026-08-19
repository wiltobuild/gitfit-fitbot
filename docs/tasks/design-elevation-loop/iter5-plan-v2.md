# Iteration 5 — Plan v2 (post-review, reconciled): pro nav + progress bar + ring-charge

Both motion reviews (art director + perf/a11y) converged and cut the plan
down to what's honest, performant, and a real identity leap. This is
tighter than v1 and better.

## Ship (3 things)

### 1. Persistent, route-aware top nav (highest-leverage "pro software" signal)
- Today `SiteNav` is wordmark + sign-out only, zero route awareness — the
  biggest "not pro software" tell in the app.
- Add a real authenticated nav: destinations Dashboard, Book a class,
  FitBot, and Staff (staff-role only), each icon + label (reuse existing
  icons). Active route gets a 2px `var(--gradient-brand)` underline —
  REUSE the existing `day-tab.active::after` pattern, promoted to primary
  nav. Active state needs the current path → a small CLIENT subcomponent
  using `usePathname()`; `SiteNav` stays a server component that fetches
  session and passes `role` + email into it.
- Consistency: use this nav on the authenticated hub pages that already use
  SiteNav (dashboard, staff, landing) AND on `/appointments` (replace its
  wordmark-only header). Leave `/chat`'s immersive header as-is (it's a
  focused view with its own exit). Signed-out users keep the current
  sign-in/sign-up nav.

### 2. Top progress bar (the "loading screen between pages," done right)
- NOT a full-screen interstitial (both reviewers: on a fast web app a splash
  reads as broken/slower). A thin 2px `var(--gradient-brand)` bar fixed at
  `top:0`, driven by navigation state.
- Behavior: appears on navigation start, eases toward ~90% over ~600ms
  `--ease-out`, snaps to 100% + fades on completion. A CLIENT component in
  the ROOT layout (`app/layout.tsx`) so it's global (works on every page incl
  chat).
- Implementation: verify the correct Next 16 App Router API in
  `node_modules/next/dist/docs` FIRST (the middleware→proxy lesson) — use
  `useLinkStatus` / navigation-pending if cleanly available; otherwise a
  `usePathname()`-change-driven sweep is an acceptable, robust fallback.
- HARD BANS (perf review): no minimum-display timer (never manufacture
  latency); no full-screen gate on fast routes. Reduced-motion: no animated
  crawl — show a brief solid state or nothing.
- `app/loading.tsx`: optional and minimal ONLY — a quiet centered wordmark,
  and only if a genuinely slow route exists; must not flash on fast nav.
  Prefer to rely on the bar and skip loading.tsx unless trivial.

### 3. Signature "ring charge" motion (the one ownable branded gesture)
- Couple the dashboard MomentumRing's EXISTING stroke-fill (already a CSS
  `stroke-dashoffset` transition on `--ease-spring`) with a NEW count-up on
  the numeric value, same ~700ms timing, landing together — the gradient
  visibly "charges" as the number ticks up. Whoop-ring-grade, legible,
  repeatable.
- Guard it: nothing else in the app borrows this gesture (not buttons,
  cards, or the decorative MomentumArc icon). If everything charges, nothing
  does.
- The number count-up is NEW JS → needs the reduced-motion pattern below +
  `tabular-nums`.

## Cut (per both reviews — do NOT build)
- Full-screen loading interstitial (top bar instead).
- KPI stat band — only ONE honest metric exists (bookings-this-week); a band
  forces vanity/fabricated numbers → violates the no-mocked-data rule. Give
  the ring more primacy on the dashboard instead.
- Scroll-reveal / IntersectionObserver (theater on 3 near-fold cards).
- Blanket `template.tsx` entrance (perf: replays annoyingly on every
  navigation, reads slower). Keep existing per-page hand-done entrances.
- framer-motion or any animation dependency (hand-rolled CSS + a ~30-line
  rAF count-up hook covers everything one-shot here).

## Mandatory guardrails (perf/a11y review)
- Every JS/rAF animation (the count-up; the bar if JS-timed) uses:
  `const m = matchMedia('(prefers-reduced-motion: reduce)'); if (m.matches)
  { render final state synchronously, skip the rAF loop }` — and LISTENS for
  the media query changing mid-session, not a one-time read.
- Count-up numerals: `font-variant-numeric: tabular-nums` (add token) and a
  fixed-size container so digits don't cause CLS as they grow.
- Animate only `transform`/`opacity` (compositor) — plus the bar's width and
  the ring's existing stroke-dashoffset. No animating height/top/layout.
- The ring number must show its real final value immediately under
  reduced-motion.
- No new heavy work on the render path; no INP regression.

## Verification
- lint + build green.
- Live: nav shows active-route underline moving between pages; progress bar
  sweeps on navigation (and does NOT flash-block fast routes); dashboard ring
  number counts up in sync with the fill on load; reduced-motion (emulated)
  shows final states with no animation.
- Regression audit: focus-visible / aria-label / aria-live preserved; nav
  links keyboard-reachable with visible focus + `aria-current="page"` on the
  active link.
