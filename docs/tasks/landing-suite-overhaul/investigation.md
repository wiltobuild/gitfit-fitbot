# Investigation: landing-suite-overhaul

Read `docs/tasks/landing-suite-overhaul/brief.md` in full first (confirmed). This
document is ground truth only — no design recommendations.

## 1. Current `app/page.tsx`

Full file read at `C:\Users\Wil\Documents\Codex\fitbot\app\page.tsx` (58 lines).

- `app/page.tsx:16` — `if (session) redirect("/dashboard");` — signed-in visitors
  never see this page's markup at all (server-side redirect before any JSX
  renders).
- `app/page.tsx:4` — imports `MomentumArc` from `@/app/components/icons`, the
  same swirl component also used as Fitbot's floating-launcher icon
  (`app/components/chatbot-overlay.tsx:39` renders `<MomentumArc className="chatbot-launcher-arc" />` in the closed-launcher button) and as a decorative background icon in the client dashboard's Fitbot quick-action tile (`app/dashboard/client-dashboard.tsx:45`, `.quick-action-arc`).
- `app/page.tsx:22-37` — the `<section className="hero">`: eyebrow "Your team is
  ready" (line 24), `<h1>Make your next move your strongest one.</h1>` (line 25),
  hero-description is Fitbot-only copy ("Fitbot turns..." line 26), a single
  primary CTA `Talk to Fitbot` → `/chat` (line 28) plus a `#how-it-works` anchor
  link (line 29), and the visual is `<div className="hero-momentum">` wrapping
  `<MomentumArc />` and the caption `Move forward` (lines 33-36).
- `app/page.tsx:8,39-53` — `quickStarts` array of 3 strings ("Build a better
  routine", "Find my next workout", "Keep the momentum"), rendered as
  `.starter-card` links that **all** point to `/chat` (line 46: `<Link href="/chat" className="starter-card" ...>` inside the `.map`) — no per-card destination variation.
- `app/page.tsx:55` — footer: `GitFit <span>&bull;</span> Move with purpose.`
  No "Pulse Studio" text anywhere on this page currently.
- Confirms brief's "Preflight state" description is accurate.

## 2. CSS backing this page (`app/globals.css`)

All on one physical line each (minified); citing line numbers only, selectors given verbatim.

- `app/globals.css:387` — `.landing-shell { max-width:1260px; margin:auto; min-height:100vh; padding:26px 44px 22px; overflow:clip; }`
- `app/globals.css:396` — `.hero { position:relative; isolation:isolate; min-height:560px; margin-top:32px; overflow:hidden; padding:88px 7% 72px; display:grid; grid-template-columns:1.1fr .9fr; align-items:center; gap:24px; border-radius:var(--radius-xl); background:var(--color-ink-deep); box-shadow:var(--shadow-lg); }` — dark hero card, 1.1fr/.9fr two-column grid (copy left, visual right).
- `app/globals.css:397` — `.hero::before` — decorative radial-gradient glow overlay using teal/violet/magenta at low alpha, blurred 44px, `pointer-events:none`.
- `app/globals.css:398` — `.hero-copy`, `.hero .eyebrow`, `.hero h1` (paper-colored), `.hero-description` (76%-alpha white) — all styled for the dark hero background.
- `app/globals.css:399-400` — `.eyebrow` / `.eyebrow span` — shared component style (11px uppercase label with a small teal dot); not hero-specific.
- `app/globals.css:401` — `h1,h2 { font-family:var(--font-baloo-2), ui-rounded, sans-serif; letter-spacing:-2.4px; margin:0; font-weight:700; line-height:.99; }`
- `app/globals.css:402` — `.hero h1 { max-width:660px; font-size:clamp(52px,6vw,80px); }`
- `app/globals.css:403` — `.hero-description { max-width:505px; margin:27px 0 31px; color:rgba(255,255,255,.76); font-size:18px; line-height:1.6; }`
- `app/globals.css:404` — `.hero-actions { display:flex; align-items:center; gap:14px; }`
- `app/globals.css:408` — `.hero-momentum { position:relative; z-index:1; display:grid; min-height:360px; place-items:center; color:rgba(255,255,255,.78); font:700 12px/1 var(--font-body); letter-spacing:1.4px; text-transform:uppercase; } .hero-momentum svg { width:min(100%,380px); filter:drop-shadow(0 0 16px rgba(110,63,224,.48)); } .hero-momentum span { margin-top:-38px; }` — sized for an SVG (`<MomentumArc/>`), not an `<img>`; the caption ("Move forward") is negative-margined to overlap the SVG's bottom.
- `app/globals.css:409` — `.starter-section { border-top:1px solid var(--line); display:grid; grid-template-columns:.8fr 1.2fr; gap:50px; padding:55px 6%; align-items:center; } .starter-section h2 { font-size:31px; max-width:300px; } .starter-list { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; } .starter-card { min-height:132px; border:1px solid var(--color-border); border-radius:var(--radius-lg); background:var(--color-surface); padding:17px; display:flex; flex-direction:column; font:700 16px/1.25 var(--font-display); box-shadow:var(--shadow-sm); transition:... } .starter-card:hover {...} .starter-card span { font:700 10px var(--font-body); color:var(--violet); margin-bottom:auto; } .starter-card b { color:var(--teal); align-self:flex-end; font:700 20px var(--font-body); } footer { padding:20px 6% 0; font-size:12px; color:#747c91; font-weight:700; } footer span { color:var(--magenta); padding:0 7px; }`
- `app/globals.css:506-507` — later override: `.starter-card b { color:var(--color-ink-soft); }` and `footer span { color:var(--color-violet-dark); }` (comment above, line 505: "Light brand hues stay out of small text on paper; they remain available for fills, icons, and gradients.") — these are the winning cascade values (later in file) for `.starter-card b` and `footer span`.
- Responsive breakpoints touching these classes:
  - `app/globals.css:416` — `@media (max-width:800px){.landing-shell{padding:22px 20px}.hero{min-height:0;padding:62px 8%;grid-template-columns:1fr}.hero-momentum{min-height:280px;max-width:360px;justify-self:center;grid-row:1}.hero-copy{grid-row:2}.starter-section{grid-template-columns:1fr;padding:40px 2%;gap:26px}...}`
  - `app/globals.css:417` — `@media (max-width:520px){.hero{margin-top:20px;padding:52px 24px}.hero h1{font-size:49px}.hero-momentum{min-height:230px}.hero-actions{align-items:stretch;flex-direction:column}.starter-list{grid-template-columns:1fr}.starter-card{min-height:91px}...}`

## 3. Brand assets in `public/`

Confirmed via `ls` and `file`:
- `public/gitfit-icon.gif` — GIF89a, **598 x 527px**, ~1.06 MB.
- `public/gitfit-lockup.gif` — GIF89a, **598 x 682px**, ~1.06 MB.
- `app/icon.png` — PNG, 256x256, RGBA (this is the Next.js `app/icon.png` favicon convention file, unrelated to in-page usage).
- Both existing GIFs are large (~1.1MB each) full-resolution source files — every existing usage constrains them via CSS (`width`/`height`/`object-fit:contain`), not native dimensions.

Existing usage patterns (all plain `<img>`, never `next/image`):
- `.brand-icon` (icon only, 36x36, inline with wordmark) — `app/globals.css:390`: `.brand-icon { display:block; width:36px; height:36px; margin-right:5px; object-fit:contain; }`. Used in:
  - `app/components/site-nav.tsx:13` — `<img className="brand-icon" src="/gitfit-icon.gif" alt="" />`
  - `app/sign-in/page.tsx:12`, `app/sign-up/page.tsx:12` — identical pattern
  - `app/chat/chat-experience.tsx:25` — same, in the chat header brand link
  - `app/components/chatbot-overlay.tsx:46` — `.chatbot-brand-icon` variant, `app/globals.css:412`: `.chatbot-brand-icon{width:24px;height:24px;margin-right:0}` (smaller, 24x24)
- `.brand` wrapper class — `app/globals.css:390`: `.brand { display:inline-flex; align-items:center; }` — always wraps icon + `.wordmark` span + optional `.brand-org` span.
- `.brand-org` — `app/globals.css:390`: `.brand-org { margin-left:9px; padding-left:9px; border-left:1px solid var(--color-border); color:var(--color-muted); font-size:12px; font-weight:700; letter-spacing:.2px; white-space:nowrap; }` — a small caption-style tag with a left border divider, always reading "Pulse Studio" (see section 6).
- `.studio-mark` / `.studio-mark-caption` (lockup image, larger promotional placement) — `app/globals.css:517`: `.studio-mark { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:14px; border-radius:17px; background:var(--paper); box-shadow:0 12px 24px rgba(0,0,0,.18); } .studio-mark img { width:100%; height:auto; display:block; border-radius:8px; } .studio-mark-caption { margin:2px 0 0; color:var(--muted); font-size:11px; font-weight:800; letter-spacing:1px; text-align:center; text-transform:uppercase; }`. Used once: `app/appointments/appointments-experience.tsx:68` — `<div className="studio-mark"><img src="/gitfit-lockup.gif" alt="GitFit" /><p className="studio-mark-caption">Pulse Studio</p></div>` inside `<aside className="studio-side">` next to the appointments hero (on a dark `.appointments-hero` background, `.studio-mark` gives it a white/paper card backing so the GIF's own background reads correctly against the dark section).
- `.quick-action-arc` — `app/globals.css:433`: `.quick-action-arc { position:absolute; width:130px; height:130px; right:-16px; bottom:-26px; object-fit:contain; opacity:.5; filter:drop-shadow(0 0 12px rgba(110,63,224,.34)); }` — decorative, low-opacity, absolutely positioned background flourish inside the dark `.quick-action-fitbot` tile (`app/dashboard/client-dashboard.tsx:45`), not a primary brand mark placement.

No component anywhere resizes/crops the GIFs via `next/image`; every usage is a plain `<img>` with CSS-driven width/height.

## 4. Real suite capabilities (grounding for copy)

**Client-facing:**
- Dashboard home (`app/dashboard/client-dashboard.tsx`): momentum/streak ring (`:44`, `<MomentumRing target={8} value={streakWeeks}/>`), upcoming booked sessions list (`:50`), recent sessions history (`:51`), promotions feed from the studio (`:53`), quick actions to Fitbot chat and to appointments (`:45`).
- Class booking (`app/appointments/appointments-experience.tsx`): live weekly/monthly class schedule with day tabs (`:70` `<div className="day-tabs">`), search/filter by class/instructor/type, "Available Spots Only" / "My Bookings Only" toggles (`:71`), reserve/cancel a spot with capacity meters (`:73` `updateBooking`), instructor showcase section (`:73` `coaches.map`), studio amenities section.
- Fitbot chat (`app/chat/chat-experience.tsx`): guided assistant scoped to classes/bookings/schedule/goals (`:25` aside copy: "FitBot is a guided assistant, not open-ended chat — it's built to help with classes, bookings, your schedule, and your goals."), suggested-chip quick prompts, rich in-chat cards (schedule rows, member cards per `app/globals.css:493-496` class names), also available as a floating overlay launcher app-wide (`app/components/chatbot-overlay.tsx`).
- Promotions are indeed client-visible (`client-dashboard.tsx:53`, a "Promotions" panel showing subject/body/date sent from studio staff).

**Staff-facing** (`app/staff/page.tsx`, both trainer and manager get some panels, `isManager` branches at `:37`):
- Trainer/instructor track (non-manager, `:327-357`): `MySchedule` (own upcoming classes, `:336`), `ProposeClass` (propose new class, `:337`), `RequestTimeOff` (`:338`), `MyRequests` (own time-off request status, `:339`), `MemberSearch` (`:340`/`:353`), `MyMembersRetention` (retention view scoped to their own students, `:343`), `ClassChangeStatus` / `ClassCreationStatus` (status of their own edit/cancel/creation requests, `:344-345`), `StaffFitBotTiles` (`:346`/`:355`).
- Manager/admin track within the staff console (`isManager`, `:316-326`): `RequestsInbox` (approve/deny time-off, `:321`), `ClassChangeInbox` / `ClassCreationInbox` (approve/deny trainer-submitted class edits/cancellations/new-class proposals, `:321-322`), `LiveRegister` (today's live class roster/attendance, `:323`), `AtRiskMembers` / `ActivityLog` (member retention risk + approval/cancellation history, `:324`), `StudioPulse` (weekly fill-rate/lifecycle stats) / `InstructorLeaderboard` (`:325`), plus `MemberSearch` and `StaffFitBotTiles` (`:326`).
- Studio-ops signal banner (`:308-313`) surfaces pending time-off/class-change/class-creation counts and at-risk member counts right in the header.

**Admin-facing** (`app/dashboard/admin-dashboard.tsx`, `AdminDashboard` component `:71-73`):
- Stat grid (`:72`, `StatTile`×5): weekly fill rate, member lifecycle (active/at-risk/lapsed), membership tiers (basic/premium), members needing re-engagement, pending time-off count.
- `RequestsOffPanel` (`:19-24`): approve/deny staff time-off requests inline.
- `Calendar` (`:26-64`): full month view and rolling-7-day agenda view of studio class schedule, with per-day/per-class fill-level badges.
- `UpcomingSessionsPanel` (`:66-69`): flat upcoming-7-days session list with expand-to-see-more.

Note: `app/staff/page.tsx` is a single page serving both trainer and manager/admin roles (`requireRoleOrRedirect(["staff","admin"])`, `:36`), branching internally on `role === "admin"` — the brief's "staff/admin panel list" for both audiences lives in this one file plus `admin-dashboard.tsx` (which is reached via `/dashboard` when `role === "admin"`, not part of `/staff`). Confirm with Athena which of `/staff` vs `/dashboard`'s admin view the landing copy should point to for "admin/staff tools" — both exist and are real, but they're two different routes/components.

## 5. Design tokens (`app/globals.css` `@theme` block, starting line 24)

Color tokens:
- `--color-ink: #141B3C` / `--color-ink-deep: #0E1430` / `--color-ink-soft: #2C3552`
- `--color-paper: #F8F7F5` / `--color-surface: #FFFFFF` / `--color-surface-subtle: #F3F2EE`
- `--color-border: #E3E5EC` / `--color-border-strong: #C9CCDA`
- `--color-muted: #66708C` / `--color-muted-subtle: #9AA1B5`
- `--color-teal: #1FC2AE` / `--color-teal-dark: #159F90` / `--color-teal-subtle: #D6F6F1`
- `--color-violet: #6E3FE0` / `--color-violet-dark: #5B32BE` / `--color-violet-subtle: #EEEBFA`
- `--color-magenta: #C43FD6` / `--color-magenta-subtle: #FBE9FC`
- `--color-success: #159F90` (subtle `#D6F6F1`), `--color-warning: #D97706` (subtle `#FEF3C7`), `--color-danger: #DC2626` (subtle `#FEE2E2`)
- Short aliases also defined (lines 67-74): `--teal`, `--violet`, `--magenta`, `--ink`, `--ink-deep`, `--paper`, `--muted`, `--line` (= `--color-border`) — these short names are what most of the CSS in this file actually references (e.g. `var(--teal)`, `var(--line)`).

Font tokens (lines 61-62):
- `--font-display: var(--font-baloo-2), ui-rounded, sans-serif` (headings, `h1,h2` per line 401)
- `--font-body: var(--font-inter), ui-sans-serif, system-ui, sans-serif` (body text)

Gradient/motion tokens:
- `--gradient-brand: linear-gradient(105deg, var(--color-teal), var(--color-violet), var(--color-magenta))` (line 76) — used for `.btn-primary` background (line 134), nav active-link underline, `.reserve-button`, credits/capacity progress bars, etc. This is the established "brand gradient" utility, reused throughout rather than any one-off gradient per component.
- `--ease-out`, `--ease-spring` easing tokens (lines 85-86) for transitions.
- `--shadow-lg`, `--shadow-md`, `--shadow-sm`, `--shadow-brand` etc. referenced throughout (not enumerated in `@theme` excerpt read, but consistently used, e.g. `box-shadow:var(--shadow-lg)` on `.hero`).

## 6. SiteNav for signed-out visitor

`app/components/site-nav.tsx` (36 lines, full file read):
- `:8` — `const session = await getSession();`
- `:12-16` — brand link always renders: icon + "GitFit" wordmark + `.brand-org` "Pulse Studio".
- `:17` — `{session ? <NavLinks role={session.role} /> : null}` — nav links (dashboard/staff/etc.) only render when signed in; correctly omitted for signed-out visitors.
- `:18-32` — `.nav-actions`: when `session` is falsy (signed-out case, `:26-31`), renders `Sign in` (`/sign-in`) and `Sign up` (`/sign-up`) links exactly as the brief describes. No session-dependent code path here needs changes for this task.

## 7. Existing "Pulse Studio" phrasing/placement (grep results)

Exact locations, verbatim phrasing:
- `app/components/site-nav.tsx:15`, `app/sign-in/page.tsx:14`, `app/sign-up/page.tsx:14` — `<span className="brand-org">Pulse Studio</span>` (small caption tag beside the GitFit wordmark, per `.brand-org` CSS in section 3).
- `app/appointments/appointments-experience.tsx:68` — hero eyebrow: `<p className="eyebrow"><span /> GitFit at Pulse Studio</p>`; also `<p className="studio-mark-caption">Pulse Studio</p>` beside the lockup image; and footer: `GitFit for Pulse Studio <span>•</span> Move with purpose. Build momentum.`
- Three distinct established phrasings exist: **"Pulse Studio"** (bare, as an org tag), **"GitFit at Pulse Studio"** (eyebrow/context phrasing), **"GitFit for Pulse Studio"** (footer/tagline phrasing). All co-exist in the shipped app; a new landing-page mention should pick from these existing idioms rather than invent a fourth.
- `public/appointments-prototype.html` — an unrelated static prototype file (title "Pulse Studio - Member Booking", indigo "P" logo mark) — confirmed via `docs/agent/decisions.md:198-202` this is a separate historical prototype, not live app source; not relevant to conventions to reuse (its logo/colors are not the shipped brand system).

## 8. Risks / conventions to preserve

- **`<img>` vs `next/image`**: confirmed — every brand-asset usage across the codebase (`site-nav.tsx:13`, `sign-in/page.tsx:12`, `sign-up/page.tsx:12`, `chat-experience.tsx:25`, `chatbot-overlay.tsx:46`, `client-dashboard.tsx:45`, `appointments-experience.tsx:68`, `instructor-avatar.tsx:17`) uses plain `<img>`, none uses `next/image`, and no `eslint-disable` comments for `@next/next/no-img-element` were found anywhere in `app/` — grep for both patterns returned no matches, meaning either the lint rule isn't enabled/configured to flag this, or it's already allowed project-wide. A new landing-page `<img>` for the icon/lockup is consistent and should not need an eslint-disable; **not fully confirmed** whether `npm run lint` would flag a *new* `<img>` — recommend a live lint check after implementation since the absence of existing disables could mean the rule is simply off, not that it's been overridden every time.
- **Reduced motion**: `app/globals.css:89-96` — global rule: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }`. Any new animated elements (e.g. an animated hero flourish) are automatically covered by this blanket rule — no special-casing needed as long as animations use standard `animation`/`transition` properties.
- **Responsive breakpoints**: `.hero`/`.starter-section`/`.landing-shell` currently break at `800px` (`app/globals.css:416`) and `520px` (`app/globals.css:417`). A redesigned hero/suite-grid must either fit within these two existing breakpoints' rules or have them extended — check that any new grid/class names added get corresponding responsive rules, since the current `@media` blocks target specific existing class names (`.hero-momentum`, `.starter-list`, `.starter-card`, etc.) and won't automatically apply to new class names.
- **Tests**: `git ls-files | grep -iE "test|spec"` (excluding `node_modules`) returned only `tests/agent_requirements/*.test.ts` (11 files: activity-log-merge, cancel-flow-order, chat-page-auth-gate, deny-pending-requests-on-cancel, interpret-chat-response, log-class-cancellation, merge-refreshed-classes, resolve-class-type, resolve-instructor, retention-cohort-boundaries, update-class-capacity-below-booked) plus `vitest.config.mts`. None of these test files reference `app/page.tsx`, "landing", `MomentumArc`, or "Talk to Fitbot" (grep for these patterns against `**/*.test.*` returned no matches) — confirmed no existing test asserts on this page's specific text/markup, so the overhaul has no test-suite collision risk on that front. (CLAUDE.md also separately notes the test framework was added 2026-08-24 and a fresh checkout may show "no test files found" until vitest is pointed at these — worth confirming `npm test` actually picks up the `tests/agent_requirements` directory when verifying acceptance criterion 6.)
- **Asset weight**: both `/gitfit-icon.gif` and `/gitfit-lockup.gif` are ~1.1MB each (full-resolution GIFs used elsewhere only at small/medium CSS-constrained sizes: 36px, 24px, 130px, or `.studio-mark`'s `width:100%` inside a constrained aside column). Using the icon/lockup as the *primary, large* hero visual (larger than any current usage) will download the full 1.1MB file at whatever display size is chosen — this is a pre-existing characteristic of the assets (not introduced by this task) but is worth flagging since it's the first time either GIF would be a large/primary visual rather than a small mark.
- **Unknowns**: I could not find any alt-format (WebP/PNG/static) version of the icon/lockup in `public/`; only the two animated GIFs exist. Whether the GIF's animation is desirable as a large hero centerpiece (vs. distracting) is a design judgment call for Athena, not something I can verify from the repo alone.
