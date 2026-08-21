# Verification: retention-campaign-page

All verification below was run against the real dev server and live
Supabase project — no separate test database exists for this repo.
Sessions used: `wil.sheppard@pursuit.org` (admin) and
`dora.ledner@gitfit.demo` / `stuart.kutch@gitfit.demo` (real seeded
members with actual accounts).

## Automated checks (every phase, after every fix)

- `npm run lint` — clean on every phase's final state (3 pre-existing,
  unrelated warnings only).
- `npx tsc --noEmit` — clean on every phase's final state.

## Role gating

- `/retention` reachable by admin; loads with real, non-hardcoded data.
- A client-role session (`dora.ledner@gitfit.demo`) hitting `/retention`
  directly is redirected to `/dashboard?error=forbidden`, matching
  `/staff`'s existing behavior exactly — confirmed via `window.location`
  after navigation, not just reading the gate code.

## Cohort data

- All 3 buckets (7–14 / 14–30 / 31–60 days inactive) show live counts from
  `search_members_by_attributes`'s new bounded-range query: 93 / 24 / 72
  members respectively against the current seed data — not hardcoded.
- Cohort selection is genuinely interactive: clicking a different bucket
  updates the member count, the live preview member, and the "inactive for
  N days" figure — verified via DOM inspection after a real click, not
  just reading the handler code (e.g. switching to 31–60 days correctly
  swapped the preview member and showed "Inactive for 60 days").

## Composer and preview

- Message composer, channel tabs, and incentive toggle are all real client
  state; the incentive toggle demonstrably changes the rendered preview
  text (confirmed the appended line appears after toggling).
- The activity trend chart renders real weekly booking data — confirmed
  via direct canvas pixel inspection (15,460 non-transparent pixels
  rendered from real `getWeeklyActivityTrend` data), not just "did it
  throw an error."

## Real delivery (the core of this feature)

- Launched a real campaign against the live 24-member "14–30 days
  inactive" cohort: created 24 real `outreach_messages` draft rows
  (confirmed via direct DB query), UI correctly reported "24 drafts
  created. 4 of 24 members have an account and can be reached via FitBot
  once sent" — the honest reachable-count requirement, verified against
  real data, not asserted.
- Sent two of those drafts via the existing single-member chatbot flow
  (`send outreach to Dora Ledner`, `send outreach to Stuart Kutch`) and
  confirmed via direct query that each recipient received a real
  `chat_messages` row: correct `role: "assistant"`, `is_promotional:
  true`, and — after the personalization fix — correctly personalized
  content ("Hey Dora," / "Hey Stuart," not the literal token).

## Dashboard Promotions card + auto-popup

- Signed in as the real recipient (Dora Ledner) and confirmed the
  Promotions card shows her actual sent promotion with correctly
  personalized body text — this required the Phase 7 RLS fix; before it,
  the card was structurally empty for every real member regardless of
  data correctness.
- Cleared the "last seen" localStorage key and reloaded: `ChatbotOverlay`
  auto-opened (confirmed via DOM query, `.chatbot-overlay` present)
  without any click. Reloaded again without clearing storage: overlay
  correctly did NOT re-open for the already-seen message.

## Responsive

- `/retention` at a 375–393px mobile viewport (admin session): no
  horizontal overflow (`document.body.scrollWidth === window.innerWidth`).

## Branding audit

- Grepped `app/retention/`, `app/dashboard/page.tsx`,
  `app/components/chatbot-overlay.tsx`, `lib/outreach/`,
  `lib/promotions/`, `app/api/retention/` for "fitbot"/"maya"
  (case-insensitive). Every hit is a legitimate reference to the app's
  real product name "FitBot" (pre-existing throughout the app, e.g. "Chat
  with FitBot," the chat UI's own wordmark) — none are the mockup's
  "Fitbot Reconnect" branding or its "– Your Fitbot" sender identity,
  which is what the user asked to remove. Zero occurrences of "Maya"
  anywhere.

## Not automated / manual-only

- No automated test suite exists for this repo (consistent with the
  project's established testing approach throughout this session) — all
  verification above is live/manual against real data.
