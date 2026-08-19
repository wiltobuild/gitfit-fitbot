# Plan: GitFit Suite landing page + shared navigation (Phase 2)

Light plan — low architectural risk (pure UI + reads the existing
`getSession()` primitive from Phase 1; no schema/auth changes). Authored
directly rather than through a full Argus/Athena cycle, per the user's
authorization to run Phases 2-10 autonomously.

## Design

- `app/components/site-nav.tsx` — a shared Server Component nav (brand
  mark + auth-aware right side: "Sign in" / "Sign up" links when logged
  out, `{email} · Sign out` when logged in). Calls `getSession()` itself
  so any page can drop it in without re-deriving auth state. Used on `/`
  in this phase; other pages adopt it opportunistically in later phases
  without another decision needed (it's just a component import).
- `app/components/module-card.tsx` — a small presentational card
  (icon/label/description/href) for the module grid, reused for all four
  cards.
- `app/page.tsx` becomes a Server Component that calls `getSession()`:
  - `null` → existing marketing hero unchanged, using the new shared nav
    instead of its inline nav markup.
  - Session present → module grid: Fitbot, Book a Class, Your Dashboard
    always; Staff Console appended only when `role === 'staff'` — the
    conditional lives in the server-rendered JSX itself (not CSS
    `display:none`), so a client-role user's HTML response never contains
    the Staff Console card.
- Design tokens: audit `app/globals.css` for the brand tokens already
  used by the existing landing page (colors, fonts) and confirm the new
  components reference the same custom properties rather than
  hardcoding hex values a second time.

## Acceptance criteria

Per brief.md — unauthenticated hero + auth links; authenticated role-aware
grid with correct card set per role; nav auth-state correct; server-side
(not client-side) role gating verified by reading source; lint/build
pass; existing pages unchanged.
