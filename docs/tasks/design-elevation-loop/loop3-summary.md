# Design Elevation Loop 3 — Summary (iterations 7-9)

Third run of the plan → 2 independent adversarial Sonnet-5 reviews →
reconciled plan → Codex implements → verify → commit loop, fully
autonomous per the user's standing instruction. As in loops 1-2, the
adversarial reviews materially reshaped every iteration.

## Iteration 7 — commit 43cd724 (finished chat cards + scoped toast + favicon)
v1 proposed a broad toast/notification system plus a favicon. The art
director rejected the broad scope: appointments already confirms
reserve/cancel via inline text + animation, so a toast there is redundant
chrome — the toast's ONE legitimate use is the outreach card's "Send when
ready" button, a genuine no-op with zero feedback. The bigger, real
finding: the workout and outreach chat cards (built iter 4, never visually
verified) looked visibly unfinished next to the schedule card. Reconciled
scope: redesigned both cards properly (workout gets real per-block-type
badges instead of a flat `<ol>`; outreach gets a member-context row +
bounded draft area), toast scoped to exactly the outreach-send call site
with strict aria-live structure (empty regions mounted at root, message
text isolated from the dismiss button, no auto-dismiss on errors), plus a
solid-teal static favicon (gradients dither at 16-32px) and a bonus fix
for a real pre-existing bug (appointments' error text had no aria-live at
all).

## Iteration 8 — commit 6718f02 (complete rich-card coverage, correctly)
v1 proposed cards for 5 more intents ("5 for 5"). The art director called
this completionism and corrected real mistakes: `who-is-booked`'s
single-match case is one sentence with a load-bearing caveat that a card
would strip; `retention-lookup`'s naive reuse of the `members` card was
"actively wrong," not just under-designed (cramming a list-level honesty
disclosure into a `badge-neutral` pill misrepresents urgency). The
reviewers also caught things v1 missed entirely: `time-off`'s lookup
branch is a genuine, previously-unnoticed card candidate (3 real statuses
mapping to existing badge tokens), and usability found a real functional
bug — `OutreachCardActions` had no way to know a card was already sent
server-side, so a `sent:true` card would still show a live, clickable send
button (double-send risk). Final scope: cards for `my-appointments` and
`who-is-booked`'s multi-match case only; `retention-lookup` fixed with a
distinct `reason` field and its own aria-label instead of overloading
`status`; a new justified `time-off` card kind; and the outreach
double-send bug fixed by making the component honor server state.

## Iteration 9 — commit f0e0723 (mobile nav + staff-row bug fixes, final)
Scoped as a bug-fix pass, not a redesign. Both reviewers independently
found that the two reported mobile bugs already had partial fixes sitting
in the CSS: the nav had a scrollable-with-fade attempt (insufficient —
gesture-only discovery, iOS Safari hides scrollbars by default, ~33px
touch targets) and the staff class-row had a stacking rule with a real
arithmetic bug (`flex-basis:100%` + `margin-left:53px` pushed content 53px
past the row's edge). Fixed precisely rather than patched: nav replaced
with icon-only collapse (44×44px targets, sr-only label preserving the
accessible name, restored visually above 761px — live-verified at both
375px and 1280px, zero desktop regression), staff-row's margin arithmetic
corrected (live-verified: fill bar fits fully inside the row). The
chatbot overlay was confirmed already correct and deliberately left
untouched. Four pre-existing sub-44px touch targets and a "full-bleed
mobile FitBot" idea were explicitly flagged as follow-ups rather than
silently fixed (scope creep) or silently ignored.

## Net result
Loop 3 corrected a pattern from loop 2: rather than always building new
surface area, two of three iterations were substantially about *finishing
what was already started* (chat cards) and *fixing what already existed
but was subtly broken* (mobile nav, staff-row) rather than adding more.
The adversarial pairing kept catching this same shape of error —
completionism/scope creep from the art-director lens, contract/a11y
regressions and functional bugs from the usability lens — across all
three iterations. All changes live-verified (JS-level DOM assertions for
the mobile fixes, not just visual screenshots); lint/build green
throughout.

Committed on `main`, iterations 7-9 not yet pushed as of this summary.
