# Review: retention-campaign-page

Each phase's Codex diff was reviewed manually and verified live (not just
read) before commit. Findings below are what survived that review — every
issue was caught and fixed in the same phase it was found, nothing was
deferred.

## Phase 1 (schema)

- **Fixed — function overload left stranded:** `create or replace function`
  with a changed parameter list creates a new Postgres overload rather than
  replacing the original. Applying the migration as written left two live
  versions of `search_members_by_attributes` side by side. Confirmed only
  one caller exists in the codebase (already updated to always pass all 4
  params), dropped the stale 3-arg overload live, and added an explicit
  `drop function if exists` to the migration file so a fresh apply doesn't
  hit the same issue.

## Phases 2–5

No findings — data layer, page shell, and the full interactive experience
(cohort selection, composer, incentive toggle, real member preview,
data-driven activity chart) all matched spec on review and live testing.

## Phase 6 (real delivery)

- **Fixed — personalization token never resolved:** bulk campaign bodies
  are stored as a reusable `"[First name]"` template (one row, many
  recipients), but `outreach-send.ts` inserted `draft.body` into the
  target member's `chat_messages` unmodified — confirmed live by sending
  to a real member and finding the literal string `"Hey [First name],"` in
  their delivered message. Added a `personalize()` step resolving the real
  recipient's first name at send time (this codebase's single-member
  drafts never had this problem, since they interpolate the name once at
  draft-creation time — the token only exists for the new bulk path).

## Phase 7 (dashboard card + auto-popup)

- **Fixed — structural RLS gap, found live as a real member:** signed in
  as a seeded member who had genuinely received a promotion and the
  dashboard showed "No promotions right now." `outreach_messages` had only
  ever had a staff-wide SELECT policy — no client could read their own
  rows at all, making the entire feature non-functional for every real
  member regardless of how correct the application code was. Added
  migration 0017: an own-row SELECT policy scoped to `status = 'sent'`
  only, so a member still can't see a draft targeting them before staff
  sends it.
- **Fixed — same unresolved-token bug, different surface:** the dashboard
  preview read `outreach_messages.body` directly (the stored template),
  showing the same literal `"[First name]"` the chat-delivery bug did.
  Extracted the Phase 6 fix into a shared `personalizeOutreachBody()`
  helper in `lib/outreach/queries.ts` and applied it in both the chat
  delivery path and the dashboard read path, instead of leaving two
  divergent copies of the same logic.

## What was not built

Per the approved plan, real push/email/SMS delivery remains explicitly out
of scope — "delivery" throughout this feature means inserting into the
recipient's own FitBot chat history, which is real and verified, not an
external notification.
