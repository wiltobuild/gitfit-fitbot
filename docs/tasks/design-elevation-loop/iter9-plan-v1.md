# Iteration 9 — Elevation Plan v1 (pre-review) — mobile responsiveness (final iteration)

## What was found (live-tested at 375×812)

Mobile has never been deliberately audited since iteration 5 added the
persistent nav. Testing now found:

1. **Real bug: the nav overflows horizontally with no visible scroll
   affordance.** At mobile width, "Dashboard / Book a class / FitBot" show
   but "Staff" is scrolled off-screen with only a faint gray bar hinting
   more content exists. Confirmed via DOM the `/staff` link is present
   (not missing), just invisible without knowing to swipe. For a staff
   member on a phone at the front desk, this is a real navigation dead-end,
   not a cosmetic nit.
2. **Real bug: the staff console's "Today at the studio" class rows
   overflow horizontally** — the fill bar + numeric "15/18" spots text is
   cut off past the viewport edge, unreadable without horizontal scroll.
3. **Confirmed working well already** (no action needed): `/appointments`
   at mobile is genuinely good — single-column cards, photos, badges all
   read cleanly. `/dashboard`'s MomentumRing card also holds up well.

## Scope

**Primary: fix the two confirmed overflow bugs.**
- Nav: redesign for mobile — options include a horizontally-scrollable
  strip WITH a visible affordance (edge fade/gradient mask indicating more
  content), OR collapse to an icon-only row at narrow widths (labels hide,
  icons + active-state remain, all 4 destinations fit), OR a bottom tab
  bar (common professional-app mobile pattern). Reviewers weigh.
- Staff console class rows: stack the fill-bar/numeric info below the
  title/instructor at narrow widths instead of forcing a single row to
  overflow (a responsive flex-wrap or a breakpoint-specific layout swap).

**Secondary: broader mobile audit pass.** Check remaining screens not yet
verified at mobile width for the same class of bug (horizontal overflow,
inaccessible controls, cramped touch targets): sign-in/sign-up, the FitBot
overlay's own responsive behavior (it already has some mobile CSS per
early phases — verify it still holds after all the card/toast additions),
the staff member-search results, and chat cards (schedule/members/workout/
outreach) at overlay width. Fix any real overflow/touch-target bugs found;
don't redesign what already works.

## Guardrails
- This is a BUG-FIX and responsive-audit pass, not a mobile redesign —
  reuse existing components/tokens, add breakpoint-specific CSS only where
  a real overflow/inaccessibility bug exists.
- Touch targets: verify interactive elements meet a reasonable minimum
  (roughly 44×44px per common accessibility guidance) at mobile width —
  don't shrink anything already compliant.
- No new npm dependencies.
- Test at the actual mobile preset (375px), not just "looks responsive in
  theory."

## Open questions for reviewers
- Nav: scrollable-with-fade-mask vs. icon-only collapse vs. bottom tab bar
  — which fits this product best at this point in its identity (given the
  existing gradient-underline active-state pattern)?
- Any other screens/components you'd flag as high-risk for mobile overflow
  given what's shipped in iterations 4-8 (rich cards, toast, staff console)
  that I should specifically re-test?
- Highest-leverage single fix.
