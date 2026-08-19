# Iteration 5 — Elevation Plan v1 (pre-review) — the real Staff Console

## Problem

`/staff` is still the Phase-1 "verification fixture" placeholder. Iter-4's
review was explicit: a staff console that's just a grid of cards all opening
FitBot is a "fake menu wearing four costumes." To be real, it needs actual
operational content on the page — at minimum a working inline member search.

## Scope

Replace `app/staff/page.tsx`'s placeholder with a real operations console
built on the existing design system (surface-card, Baloo hero, badges).

1. **Real inline member search (the anchor).** A search field on the page →
   a staff-gated server action (or route) calling the EXISTING
   `search_members` RPC (already `is_staff`-gated in SQL) → results rendered
   as member cards, reusing the iter-4 members card visual language. Real
   search-to-results, not a chat handoff. Empty state before searching,
   no-results state, and a loading state.

2. **"Today at the studio" glance.** A real panel reusing the existing
   `classes` data: today's classes (or the seed's active day) with
   instructor (photo, reusing InstructorAvatar) and a fill indicator
   (booked/capacity) so staff see the day at a glance. Genuine ops content,
   not a launcher.

3. **Honest secondary tools.** Retention and time-off ARE chatbot intents;
   present them as honestly-labeled "Ask Fitbot" cards with a concrete
   example prompt, as `<button>`s that open the FitBot overlay (focus moves
   to the overlay; if a preset is seeded, either auto-send or announce via a
   live status). Copy says "Ask Fitbot" — no dressing a chat launcher as a
   native tool.

## Guardrails carried from prior reviews
- Member search must stay staff-only server-side (reuse the gated RPC; the
  page is already `requireRoleOrRedirect("staff")`).
- No member PROFILE PHOTOS (real user data / PII) — member cards use
  initials avatars, unlike instructor photos.
- Launcher tiles are `<button type="button">`, not `<Link>`; overlay-open
  must manage focus and not trap.
- Reuse existing tokens; no new solid teal/magenta text fills.
- Search input needs a label, results a concise live-region announcement of
  count ("3 members found").

## Open questions for reviewers
- Is a server action or a small `/api/staff/members` route the cleaner
  approach for the inline search, given the overlay already uses `/api/chat`?
- Does "Today at the studio" earn its place or is it filler — what would a
  real gym ops person want on this screen first?
- Layout: search-led (search is the hero) vs. dashboard-of-panels?
- Highest-leverage single element.
