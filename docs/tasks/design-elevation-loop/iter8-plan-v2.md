# Iteration 8 — Plan v2 (reconciled): complete rich-card coverage, correctly

Both reviews rejected parts of v1's "5 for 5" completionism and caught a
real bug. Final scope, per-intent verdict:

## 1. `my-appointments` → schedule card (both reviews: do this, highest value)
Identical `classes` columns to `schedule.ts`. Reuse the existing `schedule`
RichCard kind unchanged — zero new design. Highest-traffic client query,
currently the worst text wall in the product.

## 2. `who-is-booked` → schedule card for MULTI-candidate only
When it resolves multiple candidate classes ("I found a few possible
classes..."), emit a `schedule` card (list-shaped, same reuse as above).
**The single-match case stays TEXT** (both reviews agree): one sentence
with a load-bearing caveat ("Member names aren't available...") — wrapping
it in card structure adds DOM/AT navigation overhead for zero new
information. Rule applied: a card earns its overhead at ≥2 comparable rows;
one row is a sentence, not a table.

## 3. `retention-lookup` → members card, but FIXED, not blindly reused
Art director found the naive reuse actively wrong: stuffing a
list-level caveat ("no dedicated attendance tracking exists yet") and a
per-member re-engagement reason into the `status` field (rendered as a
`badge-neutral` gray pill designed for short tokens like "active") both
misrepresents urgency and breaks the badge's visual contract.
Usability's fix, adopted: extend the `members` RichCard kind ADDITIVELY
with an optional `reason` field, separate from `status`
(`{ name, email, status, reason?: string }`), rendered as a distinct text
line (not crammed into the badge). Use a DISTINCT `aria-label`
("Members needing re-engagement") on this card instance, not the generic
"Member results" — a retention list is a different job from a lookup
result and mislabeling the region misleads AT users about what they're
navigating.

## 4. `time-off` — split by branch (both reviews missed this distinction in
different ways; reconciled from art director's actual code read)
- **Request confirmation** (submitting a new request): stays TEXT. One
  fact, already gets a toast per iter-7. A card is unjustified surface
  area — both reviews agree.
- **Lookup branch** (`isLookup`): THIS is a genuine, previously-unnoticed
  card candidate — a real list of `{date, status}` where status is one of
  `pending | approved | denied`, mapping cleanly to the EXISTING
  `warning/success/danger` badge tokens. Add a new, justified RichCard
  kind: `{ kind: "time-off"; requests: Array<{ date: string; status:
  "pending" | "approved" | "denied" }> }`. This satisfies the "no new kind
  without clear justification" guardrail — the justification is a
  genuinely distinct data shape with an existing 3-value status enum that
  already maps to established semantic tokens.

## 5. `outreach-send` → reuse outreach card with `sent: true`, ship the
type fix AND the component fix TOGETHER (usability: shipping one without
the other is worse than skipping this intent)
- `RichCard`'s outreach variant: change `sent: false` (hardcoded literal)
  to `sent: boolean` — a real, deliberate type change, not silently
  additive; call it out.
- `OutreachCardActions` (built iter 7) currently derives "queued" purely
  from local `useState`, blind to server state — a card arriving with
  `sent: true` today would still show an active, clickable "Send when
  ready" button. FIX: accept `sent` as a prop; if `true`, render a static
  `badge-success` "Sent" badge and NO buttons at all (not merely disabled
  — remove the dead affordance), matching the existing queued-state
  pattern already in that component. Use the real `sent_at` timestamp
  (already in the outreach_messages table per outreach-draft.ts) for
  "Sent {relative time}" text, replacing "Nothing sent yet".
- This directly prevents the double-send divergence usability flagged:
  one source of truth (server `sent` state), not two independent disable
  paths.

## Mandatory guardrail: reply-completeness audit (usability, non-negotiable)
For EVERY handler touched (my-appointments, who-is-booked, retention-lookup,
time-off lookup), `reply` must remain the full, self-sufficient text
listing it is today — verify by confirming each data point that appears in
the new `card` (class titles/dates, member names, request dates) also
appears as a substring in `reply`. This is the exact regression iter-4
banned; report explicit before/after `reply` content for each touched
handler, not just "it still returns reply".

## Explicitly not doing
- No card for who-is-booked's single-match case.
- No card for the time-off request-confirmation branch.
- Retention's `status` field is NOT overloaded — `reason` is separate.

## Verification
- lint + build green.
- Live: my-appointments returns a schedule card with full reply intact;
  outreach-send's sent:true state shows NO active send button + a "Sent"
  badge with real timestamp (test both a fresh draft AND simulate/verify
  the sent path); retention card has distinct aria-label + reason text
  visible, status badge unaffected.
- Regression audit: focus-visible/aria-label/aria-live before/after; confirm
  reply-completeness for all 4 touched handlers; confirm no double-send
  path exists (OutreachCardActions honors server `sent` state).
