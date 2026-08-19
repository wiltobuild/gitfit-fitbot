# Checkpoint: Phases 1-10 complete, adversarial review done

Per user authorization to run Phases 2-10 autonomously with a stop at
this checkpoint for an adversarial review ("I want you to run this on my
own. I will intervene if you go astray. Make sure to do an adversarial
once you hit phase 10 and stop there, commit as you go.").

## What's built (11 commits since Phase 1 approval, each independently
lint/build-verified and live-tested against the real Supabase project)

1. Supabase auth + client/staff roles
2. GitFit Suite landing page + shared navigation
3. Persistent Supabase-backed chatbot overlay
4. Deterministic intent router
5. Schedule query intent
6. Real per-user bookings + native `/appointments` page
7. Staff member lookup (with a `full_name` field added to make it real)
8. Deterministic workout-plan generator
9. Staff time-off request workflow
10. Retention lookup + staged, confirmation-gated outreach
11. Adversarial-review fixes (this entry)

12 chatbot intents total: help, schedule, my-appointments, book-class,
who-is-booked, member-lookup, workout-plan, time-off, retention-lookup,
outreach-draft, outreach-send — all deterministic, no LLM calls anywhere.

## Adversarial review (3 parallel independent reviewers)

**Security/RLS** — clean. No role-escalation path, no RLS gaps (all 6
tables covered), no IDOR, no auth-bypass surface, no SQL injection. Two
Low findings: unescaped ILIKE wildcards in `search_members` (fixed) and
live secrets sitting in the local `.env` (already gitignored, never
committed — flagged only as an operational reminder to rotate if that
file is ever shared).

**Correctness/data-integrity** — found one HIGH bug (a real overbooking
race condition — two concurrent bookings for the last open spot could
both pass the capacity check before either committed) and one
MEDIUM-HIGH bug (an intent collision: "cancel my day off" was being
claimed by `book-class` instead of `time-off`). Both fixed and verified
— the race fix was tested with an actual concurrent two-connection
script against the live database, not just reasoned about. Also
confirmed and fixed a known minor UX bug from Phase 6 (already-booked +
full class showed the wrong error).

**Architecture-adherence** — deterministic-first and validated-action
principles are solid, no drift. Two real (not cosmetic) findings, not
yet fixed, flagged for your call:
- Date-parsing logic (today/tomorrow/weekday resolution) is duplicated
  near-identically across 4 intent files rather than shared, and has
  already begun to diverge in small ways (e.g. `time-off.ts` doesn't
  recognize "tonight" the way `schedule.ts` does).
- `schedule.ts`'s intent-collision exclusion list has already needed
  broadening twice (Phase 8, Phase 9) and is documented in its own code
  comment as expected to keep growing.
- All date parsing uses the server's local timezone, not a studio-
  specific one — could produce a wrong "today" near midnight depending
  on deployment region.
- The original task's "surface promotions... to clients" capability was
  never built as client-facing — outreach ended up staff-only by design
  (a reasonable interpretation, recorded in decisions, but worth
  confirming that's what you actually want before Phase 12 ships without
  it).

## Recommendation before Phase 11 (LLM integration)

Consider a small cleanup pass — extracting a shared
`lib/chatbot/date-utils.ts` — before adding the LLM fallback, since
Phase 11 will need its own date/intent-collision handling and inherits
whichever pattern exists at that point. Not urgent, no live bug from it
today, but it's exactly the kind of debt that compounds once a fifth
"intent" (the LLM) needs the same logic.

## Stopped here per instruction, pending user check-in before Phase 11.
