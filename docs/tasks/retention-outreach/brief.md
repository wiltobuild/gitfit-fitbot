# Brief: Retention + promotional outreach (Phase 10)

## Scope

Staff-only. Identify members needing re-engagement, draft outreach, and
stage it — with any send action gated behind an explicit, separate staff
confirmation. **No message is ever delivered externally** — there's no
email/SMS provider configured anywhere in this app (a real send would be
a new external dependency needing its own approval gate, out of scope
here). "Sending" means marking a staged draft as sent in our own system
of record, honestly scoped to what actually exists.

**Data-model honesty note**: there is no attendance-tracking table —
`bookings` (Phase 6) records reservations, not check-ins. "Hasn't
attended recently" is therefore a proxy: members with no bookings at all,
or none within a recent window. This is stated explicitly in the
intents' replies, not silently presented as real attendance data — same
honesty pattern as Phase 6/7's "member names not available" disclosures.

- `supabase/migrations/0009_outreach.sql` — `outreach_messages` table
  (id, target_user_id references auth.users, staff_user_id references
  auth.users, subject, body, status text default 'draft' check in
  ('draft','sent'), created_at, sent_at nullable). RLS: staff-only
  select/insert/update (this is internal staff tooling, not client-
  visible data — no client-facing "you were retention-targeted" surface).
- `lib/chatbot/intents/retention-lookup.ts` (staff) — "who hasn't
  attended recently", "attendance dropped", "who needs re-engagement" —
  lists client-role members with zero bookings, honestly caveated as a
  bookings-based proxy for attendance.
- `lib/chatbot/intents/outreach-draft.ts` (staff) — "draft outreach for
  [member]" — resolves the target via the Phase 7 `search_members` RPC,
  generates a deterministic templated draft (not LLM — a fill-in-the-name
  template, consistent with the deterministic-first mandate), inserts it
  as `status='draft'`, shows the draft text, and explicitly instructs the
  staff member how to send it ("say 'send outreach to [name]' to send").
  Drafting alone never sends anything.
- `lib/chatbot/intents/outreach-send.ts` (staff) — "send outreach to
  [member]" / "send the promotion to [member]" — resolves the target,
  finds their most recent `status='draft'` row, flips it to `'sent'` with
  `sent_at`. This is a genuinely separate action from drafting — the
  brief's confirmation requirement is satisfied by requiring a distinct,
  explicit staff message naming the send action, not an automatic
  follow-up to drafting. If no draft exists for the resolved member, says
  so and asks the staff member to draft one first (a deterministic guard
  against sending nothing / erroring confusingly).

## Out of scope

- Real message delivery (email/SMS) — no provider configured; adding one
  is a new external dependency requiring its own approval gate.
- Bulk "send this week's promotion to eligible members" as a single
  multi-recipient action — this phase handles one resolved member at a
  time (consistent with how book-class/member-lookup resolve to exactly
  one match); a true bulk campaign flow is a larger feature than this
  phase's budget.
- Any client-facing visibility into outreach — staff-only in every sense.
- Real attendance tracking (a dedicated check-in table) — noted as a gap,
  not built here.

## Acceptance criteria

1. "Who hasn't attended recently?" (staff) lists client-role members with
   no bookings, with the proxy caveat stated in the reply.
2. "Draft outreach for [a resolvable member]" creates a `status='draft'`
   row and shows the draft text; does NOT create a `status='sent'` row.
3. "Send outreach to [same member]" — a separate, explicit message —
   correctly flips the most recent draft to `'sent'` with `sent_at` set.
4. Attempting to send when no draft exists for the resolved member
   returns a clear "draft one first" message, not an error.
5. A client-role user cannot trigger any of the three intents.
6. `npm run lint` / `npm run build` pass; existing intents unaffected —
   apply the schedule-collision lesson from Phases 8-9 if this phase's
   matchers risk the same class of overlap (unlikely here, no bare date
   words involved, but verify).

## Preflight state

Phases 1-9 complete and committed. `search_members` RPC exists (Phase 7)
and is reusable here for target resolution. No outreach/messaging data
exists anywhere yet.
