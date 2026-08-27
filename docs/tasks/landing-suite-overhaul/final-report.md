# Final report: landing-suite-overhaul

## What changed

`app/page.tsx` and `app/globals.css` — the signed-out root landing page,
previously a single-feature Fitbot ad, now represents the GitFit suite as
Pulse Studio's platform:

- **Hero**: the `MomentumArc` swirl (Fitbot's own icon elsewhere in the
  app) is replaced by the real GitFit lockup image in a tilted white card.
  Eyebrow is now "GitFit at Pulse Studio"; headline/description broadened
  from Fitbot-only copy to the whole suite (booking, momentum, running the
  studio). Two hero actions: primary → `/sign-up`, secondary "Talk to
  Fitbot" → `/chat` (demoted from sole CTA to one of two).
- **Suite section**: the 3 identical `/chat`-only "quickStart" cards are
  replaced with 3 distinct, capability-grounded cards — Members
  (booking + dashboard, → `/sign-up`), Staff & Studio Leads (schedule,
  time-off, retention, → `/sign-up`), Fitbot (guided assistant framing
  reused from `chat-experience.tsx`, → `/chat`).
- **Footer**: now reads "GitFit for Pulse Studio • Move with purpose."

## How it was built

Followed this project's full `/start-task` workflow for a UI change:
Argus investigated the current page/assets/real capabilities/design
tokens; Athena turned that into a plan with 7 explicit decisions, each
presented for approval; the user approved all of them (hero asset choice,
3-column suite structure with staff+admin combined, CTA destinations);
implementation was handed off to Codex (`codex exec`) with the approved
plan as its scope.

## What was caught and fixed after the Codex handoff

1. Codex used `next/image` despite the handoff explicitly forbidding it
   (this codebase uses plain `<img>` everywhere for brand assets, no
   exceptions) — corrected to `<img>`, no layout impact since sizing was
   already CSS-driven.
2. Live responsive verification at 500px width found the floating "One
   place for every next move" note pill overlapping the hero card's
   caption text — fixed by making the note flow below the card instead of
   floating over it at narrow widths, re-verified clean at 1280px/780px/500px.

## Verified

Full detail in `docs/tasks/landing-suite-overhaul/verification.md`. All 12
acceptance criteria pass: real lockup image as hero visual, suite-wide
copy (not Fitbot-only), "Pulse Studio" named 12× on the page, 3 suite
cards with distinct real destinations, Fitbot's `/chat` CTA still works,
signed-in visitors still redirect straight to `/dashboard`, `tsc`/lint/all
36 tests clean, no new files outside the two approved.

## What remains open

- Nothing outstanding against this task's scope. `/sign-in` and
  `/sign-up` were explicitly out of scope and untouched.
- Not committed/pushed yet — pending your review of the live page.
