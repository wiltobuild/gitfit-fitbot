# Brief: Overhaul the root landing page to represent the GitFit suite

## Scope

`app/page.tsx` — the page a signed-out visitor sees at `/`, the first
thing anyone hits at the URL. Today it is a single-feature Fitbot ad: the
hero headline pivots straight to "Fitbot turns...", the only CTA is "Talk
to Fitbot", the sole hero visual is `MomentumArc` (the same swirl used as
Fitbot's own avatar/launcher icon elsewhere in the app), and all three
"starter" cards link to `/chat`. Nothing on the page names Pulse Studio or
describes the rest of the suite (booking/schedule, member dashboard,
staff/trainer tools, studio operations for admins).

This task redesigns that page to:
- Lead with the real GitFit icon/lockup (`/gitfit-icon.gif` /
  `/gitfit-lockup.gif`) as the primary hero visual, replacing `MomentumArc`
  in that role.
- Represent the GitFit suite as a whole — real capabilities that actually
  exist in this app (class booking, member dashboard/streak tracking,
  staff scheduling and retention tools, Fitbot as one feature among
  several) — not just the chatbot.
- State clearly, visibly, that this is Pulse Studio's platform, for Pulse
  Studio clients and staff.

## Out of scope

- `/sign-in` and `/sign-up` pages themselves (already carry the GitFit
  icon + "Pulse Studio" tag from a prior task) — not touched unless the
  approved plan gives a specific reason to.
- Any authenticated page (`/dashboard`, `/staff`, `/appointments`, `/chat`,
  `/retention`) — unaffected.
- Backend/data/schema changes — this is presentational.
- New Fitbot capabilities or chatbot logic changes.
- `SiteNav`'s own markup, beyond it continuing to render unchanged at the
  top of the page.

## Acceptance criteria

1. For a signed-out visitor, `/`'s primary hero visual is the real GitFit
   icon/lockup, not `MomentumArc`.
2. The page's copy and structure represent the suite's actual, real
   capabilities (booking, member dashboard, staff/admin tools) alongside
   Fitbot — not a single-feature pitch.
3. The page visibly states it is Pulse Studio's platform, naming both
   audiences it serves (clients and staff).
4. Fitbot is still represented with its own real CTA — reduced from "the
   whole pitch" to "one strong feature," not removed.
5. Signed-in behavior is unchanged: still redirects to `/dashboard`
   immediately, no new landing screen wedged in for authenticated users.
6. `npx tsc --noEmit`, `npm run lint`, `npm test` all clean; verified live
   in the browser as a signed-out visitor (and confirmed the signed-in
   redirect still fires).

## Preflight state

- Branch: `main`, up to date with `origin/main` as of this task.
- Relevant existing behavior: `app/page.tsx` redirects any signed-in
  session straight to `/dashboard` (unchanged, keep as-is). For signed-out
  visitors it renders `SiteNav`, a hero section (eyebrow "Your team is
  ready" / headline / Fitbot-only description / `MomentumArc` visual /
  single "Talk to Fitbot" CTA + "How it works" anchor), a 3-card
  "starter" section (all three cards link to `/chat`), and a one-line
  footer ("GitFit • Move with purpose."). No mention of Pulse Studio,
  booking, dashboards, or staff/admin tooling anywhere on the page.
