# Brief: GitFit Suite landing page + shared navigation (Phase 2)

## Scope

Replace `/`'s single-product marketing framing with a role-aware suite
entry point, and establish a shared nav/layout pattern later phases reuse.

- **Unauthenticated visitors**: keep the existing marketing hero
  (brand-correct, already built), add clear Sign in / Sign up CTAs in the
  nav.
- **Authenticated visitors**: replace the marketing hero with a role-aware
  module grid — visually consistent cards linking to the suite's current
  modules:
  - Fitbot (`/chat`) — all authenticated users.
  - Book a Class (`/appointments`) — all authenticated users.
  - Your Dashboard (`/dashboard`) — all authenticated users.
  - Staff Console (`/staff`) — staff only, hidden entirely from clients
    (not just visually de-emphasized — the module grid itself queries
    `getSession()` server-side and omits the card).
- **Shared nav**: a nav bar usable across pages (not just `/`) showing the
  brand mark, auth-aware state (Sign in/Sign up when logged out; user
  email + Sign out when logged in), reusable enough that Phase 3's chatbot
  shell and later phases' pages can adopt it without rebuilding it.
- **Shared design tokens**: extract the landing page's existing brand
  tokens (Vital Teal, Drive Violet, Energy Magenta, Ink, Paper, Baloo
  2/Inter) into a form other modules' pages can reference consistently
  (e.g. a shared `globals.css` token block, already partially present —
  audit and consolidate rather than introduce a second system).

## Out of scope

- Chatbot shell/overlay (Phase 3).
- Rebuilding `/appointments` off the `pulse-studio-prototype` iframe onto
  native Supabase-backed booking (Phase 6) — Phase 2 only adds a nav link
  to it, doesn't touch its implementation.
- Full visual redesign/polish beyond what's needed for the module grid and
  nav to look consistent (Phase 12 owns suite-wide visual polish).
- Any new Supabase schema — this phase only reads the existing `role`
  claim via `getSession()`.

## Decision: `pulse-studio-prototype` fate (resolves the open flag from the architecture-pivot decision)

Leave `/appointments` as the existing iframe embed for now. The landing
page's "Book a Class" module card links to it unchanged. Phase 6 (native
Supabase-backed appointments) is where this actually gets resolved —
Phase 2 shouldn't block on a decision that phase owns. Recorded in
decisions.md.

## Acceptance criteria

1. Unauthenticated visit to `/` shows the existing marketing hero + working
   Sign in / Sign up links in the nav.
2. Authenticated client visit to `/` shows the module grid with Fitbot,
   Book a Class, Your Dashboard — no Staff Console card.
3. Authenticated staff visit to `/` shows all four cards including Staff
   Console.
4. Nav shows correct auth state (email + sign out when logged in; sign
   in/up links when logged out) and is present/consistent if reused on at
   least one other page (verifies it's actually reusable, not landing-page-only markup).
5. No client-side role-gating only — the server component fetches
   `getSession()` and conditionally renders; confirm by reading source, not
   just visually (a client-role user viewing page source/dev tools should
   not find Staff Console markup present-but-hidden).
6. `npm run lint` and `npm run build` pass.
7. `/chat`, `/appointments`, `/dashboard`, `/staff`, `/sign-in`, `/sign-up`
   all still work unchanged.

## Preflight state

- Branch `main`, Phase 1 complete and committed (5 commits).
- `app/page.tsx` currently: static marketing hero, no auth-awareness, nav
  links to `/chat` and `/appointments` only.
- `app/layout.tsx`: minimal, loads brand fonts, no nav/provider.
- `getSession()` from `lib/auth/session.ts` is the correct primitive to
  call from this Server Component page.
