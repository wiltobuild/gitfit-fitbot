# Plan

STATUS: COMPLETE
TASK: Fix Activity Log text truncation — .staff-activity-text forces
single-line ellipsis truncation in a narrow grid column, cutting off the
useful (trailing) part of audit messages like the date. Found via user
inspecting live HTML output. Implemented directly by the orchestrator (no
chuck/cas/dean loop, per established pattern for small CSS-only fixes).

## Steps

- [x] 1. Let .staff-activity-text wrap instead of single-line-truncating
  - Do: app/globals.css's .staff-activity-text rule uses
    white-space:nowrap + text-overflow:ellipsis + overflow:hidden, forcing
    long activity messages onto one line and truncating the trailing
    (most useful) part. Switch to wrapping: white-space:normal +
    overflow-wrap:break-word, drop text-overflow:ellipsis. Change
    .staff-activity-row's align-items:center to align-items:flex-start so
    a wrapped multi-line message aligns cleanly with the badge/timestamp.
  - Done when: rule change reviewed by reading the diff; npm run build
    and npm run lint clean (no automated visual test possible, CSS-only
    change verified by read + build/lint per established convention for
    non-testable steps).
  - Touches: app/globals.css.

## Notes
- No chuck/cas/dean loop — CSS-only visual fix, implemented directly,
  verified by build/lint. Same low-cost pattern as batches 3-4.
