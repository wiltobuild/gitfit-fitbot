# Brief: Appointments page visual redesign (match teammate's booking UI)

## Scope

Restyle the existing, real, Supabase-backed `/appointments` page
(`app/appointments/appointments-experience.tsx`) to visually match a
teammate's "GitFit Yoga" booking portal design, delivered as a static
export (`C:\Users\Wil\Downloads\gitfit-booking-static-package`) plus
reference screenshots supplied directly by the user in chat.

This is a **visual/component redesign of the real page**, not an embed of
the static export — the static package's own README recommended an
iframe embed of its bundled mock data; that was explicitly rejected (see
Decisions below) because it would disconnect the page from real classes,
bookings, and capacity.

New sections to build, styled to match the reference screenshots:
1. Hero band — eyebrow, two-line gradient headline, welcome copy,
   stat pills, a studio-logo card, and a credits card (static content —
   see Decisions).
2. Weekly schedule strip — Mon–Sun day cards with a class count per day
   (real data — the existing 20 seeded classes span exactly Mon Aug 17
   through Sun Aug 23, 2026).
3. Search + filter bar — text search (matches on class name/instructor;
   real), "Available Spots Only" / "My Bookings Only" toggles (real,
   filters the already-loaded class list client-side), category pills for
   All Practice / Yoga / Pilates / Cycling / HIIT / Boxing / Strength
   (visual — only Yoga/Cycling/HIIT have real data; the other pills are
   real UI that will just show an honest empty state, not fake classes).
4. Class list header + class cards — capacity bar, intensity badge
   (static/randomized-but-consistent per class, not real data), spot
   states (reserved / full+waitlist-disabled / available+reserve),
   matching the reference screenshots' exact states.
5. Instructor showcase — 4 cards using GitFit's **real** 3 instructors
   (Sofia Martinez, Marcus Lee, Avery Thompson) styled in the mockup's
   card format, not the mockup's 4 fictional names/photos (keeps
   consistency with the real schedule below it) — reuse the existing
   `InstructorAvatar` component instead of real photography.
6. Amenities section — purely decorative marketing copy, pixel-matched,
   no data dependency.
7. Footer — matches existing GitFit footer pattern; drop "Reset Demo
   State" (mock-data-only feature with no real equivalent).

## Decisions (already made by user this session)

1. **Navigation**: keep the shared `SiteNav` used on every other page.
   Drop the mockup's own custom header bar (GitFit Yoga logo, location
   badge, pass badge, credits widget, Import CSV, avatar dropdown)
   entirely — do not add a second/different header on this one page.
2. **Credits/pass system**: fake it visually. Show a credits-style widget
   and "(1 Credit)" button copy for pixel fidelity, but it is **not**
   wired to any real schema — no new tables/columns for this task. (Note
   for a future task: this is the same tier-vs-pass fork flagged in
   `docs/tasks/shared-member-data/plan.md` — not resolved here.)
3. **Data depth** (rooms/locations, instructor photos+bios+intensity,
   extra class types): visual only. Use placeholder/static content for
   fields with no real backing data. Do not add new schema/columns for
   room/location or instructor profiles in this task.

## Out of scope

- No embed/iframe of the static export — real page only.
- No new Supabase schema (rooms, instructor profiles, credits/passes,
  additional class types as real data).
- No change to `SiteNav`, `/dashboard`, `/staff`, `/chat`.
- No change to booking logic itself (reserve/cancel, capacity
  enforcement) — only its presentation.
- Does not block or get blocked by the in-progress shared-member-data
  task (`docs/tasks/shared-member-data/`) — separate, unrelated change
  to a different page.

## Acceptance criteria

1. `/appointments` visually matches the reference screenshots for: hero,
   weekly day strip, search/filter bar, class cards (all 3 capacity
   states), instructor showcase, amenities, footer — using GitFit's
   existing design tokens (`--teal`/`--violet`/`--magenta`/`--ink`/
   `--paper`/`--font-baloo-2`/`--font-inter` from `app/globals.css`), not
   new hardcoded colors, since the mockup's palette already matches
   GitFit's brand tokens exactly (verified: `#1FC2AE`/`#6E3FE0`/`#C43FD6`/
   `#141B3C`).
2. The shared `SiteNav` renders at the top of the page; no second header.
3. Real data still works end-to-end: schedule loads real `classes`,
   reserve/cancel still writes real `bookings`, capacity/full states
   reflect real `booked_count`/`capacity`, "My Bookings Only" filters to
   the signed-in user's real bookings.
4. Category pills for types with no real data (Pilates/Boxing/Strength)
   show an honest "no classes" empty state when clicked — never fake
   classes.
5. Instructor showcase shows GitFit's 3 real instructors, not the
   mockup's fictional ones.
6. `npm run lint` passes with no new errors.
7. Visually verified in the browser at desktop width against the
   reference screenshots (not just code review).

## Preflight state

- Branch: `main`.
- Current file: `app/appointments/appointments-experience.tsx` (91
  lines) — real, functional, Supabase-backed. CSS for it already exists
  in `app/globals.css` under `.appointments-shell`/`.class-card`/etc.
  (~line 339 onward) using the exact same token names this task reuses.
- Reference: static export at
  `C:\Users\Wil\Downloads\gitfit-booking-static-package\gitfit-booking-static`
  (mock-data-only, not used as a runtime dependency) plus 4 screenshots
  supplied directly by the user in chat (hero+credits, schedule+cards,
  instructor grid, amenities+footer).
