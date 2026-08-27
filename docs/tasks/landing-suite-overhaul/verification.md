# Verification: landing-suite-overhaul

Verified against the 12 acceptance criteria in `plan.md` / `brief.md`.

1. **No `MomentumArc` reference; `gitfit-lockup.gif` as hero `<img src>`** — ✅
   `grep MomentumArc app/page.tsx` returns nothing; live DOM check confirms
   `.hero-lockup-card img[src="/gitfit-lockup.gif"]`.
2. **Hero visual is the GitFit lockup image, not an SVG swirl** — ✅ confirmed
   live (screenshot, desktop + 780px + 500px).
3. **Copy mentions booking/schedule, dashboard, and staff/team capabilities**
   — ✅ hero description ("book a class... run a stronger studio"), suite
   cards explicitly cover booking+dashboard (Members) and
   schedule/retention (Staff & Studio Leads).
4. **3 distinct suite cards with distinct destinations** — ✅ live DOM check:
   `["/sign-up", "/sign-up", "/chat"]` — Members, Staff & Studio Leads,
   Fitbot.
5. **"Pulse Studio" appears at least twice** — ✅ live DOM count: 12
   occurrences (nav tag, hero eyebrow, hero copy, hero visual caption,
   suite heading, footer).
6. **Fitbot retains a real, working `/chat` CTA** — ✅ live DOM check: 2
   links to `/chat` (hero secondary action + Fitbot suite card).
7. **Signed-in redirect to `/dashboard` unchanged** — ✅ verified live:
   signed in as `dora.ledner@gitfit.demo`, navigated to `/`, landed on
   `/dashboard` (confirmed via `window.location.pathname`).
8. **`npx tsc --noEmit` clean** — ✅ no output.
9. **`npm run lint` clean (warnings only, same pattern as elsewhere)** — ✅
   10 warnings total (was 9 before this task), the one new warning is the
   same `@next/next/no-img-element` warning already present on every other
   brand-image `<img>` in this codebase (site-nav, sign-in, sign-up, chat
   header, chatbot overlay, client dashboard, appointments). 0 errors.
10. **`npm test` clean** — ✅ 11 files, 36 tests, all pass.
11. **800px / 520px reflow without overlap or overflow** — ⚠️ found and
    fixed, twice. First pass: Codex's original `.hero-visual-note`
    absolute positioning overlapped `.hero-lockup-card`'s caption text at
    narrow widths; patched by making the note static only inside the
    ≤800px media block. That was incomplete — a user report caught the
    same overlap still present at full desktop width (1280px), confirmed
    via `getBoundingClientRect()`: the note's `bottom:28px` was measured
    from `.hero-brand-visual`, a container sized to the card itself (the
    note is `position:absolute`, so it never contributes to the
    container's height) — so the offset always landed inside the card's
    box, at every viewport width, by construction. Root-caused and fixed
    properly: removed the absolute positioning from the base rule
    entirely (not just the media-query override), added `gap:16px` to
    `.hero-brand-visual` so the note flows below the card as a normal
    second grid item at every width. Re-verified 0px vertical overlap at
    1280px and 500px after this second fix.
12. **No new files outside `app/page.tsx` and `app/globals.css`** — ✅
    `git status --short` shows only those two files modified.

## Deviation from the approved handoff (caught and corrected)

Codex's implementation used `next/image` (`<Image src="/gitfit-lockup.gif"
... priority />`) despite the handoff's explicit instruction not to, and
despite Argus's investigation confirming zero `next/image` usage anywhere
else in this codebase. Corrected to a plain `<img>` (matching every other
brand-asset usage in the app) before this verification pass — the CSS
already sized the image via `width:100%; height:auto` on `.hero-lockup-card
img`, so the fix was a drop-in tag swap with no layout impact.

## Not verified (out of Apollo's mechanical/live-browser scope)

- Actual production Lighthouse/LCP impact of the ~1.1MB GIF as a large
  hero visual — flagged by Argus as a pre-existing asset characteristic,
  accepted by the user during plan approval, not something this
  verification pass measures.
- Cross-browser rendering beyond the Chromium-based browser pane used here.
