# Brief: Fitbot capability expansion + role-scoped access model

## Scope

A major second expansion of Fitbot, on top of the just-shipped
deterministic upgrade (`docs/tasks/fitbot-deterministic-upgrade/`,
commit `4ae4995`). Five requirements from the user, verbatim intent
preserved:

1. **Distinctive states for staff, members, and admin.** Today the
   schema has exactly two roles (`client`, `staff` — see
   `supabase/migrations/0001_profiles_and_roles.sql`). The user names a
   third: **admin**. This needs investigation before any design — does
   "admin" mean a new tier above staff (e.g. can promote other staff,
   manage the outreach/retention system itself), or is the user using
   "admin" loosely to mean "staff" and actually wants exactly two tiers
   with stricter enforcement? Must be resolved as an explicit decision,
   not assumed.
2. **Strict access boundaries.** "Members should not be able to access
   staff or other member information" — this is a security requirement,
   not a feature request. Must be verified against what's *actually*
   true today (not assumed), and any gap closed. Every new capability
   added in this task must be designed with this boundary in mind from
   the start, not bolted on after.
3. **Capability scope must make sense per role.** Fitbot's visible
   capabilities (both free-text intents and quick-reply chips) should be
   role-appropriate — a client should never see or be able to trigger a
   staff-only action, and the reverse where it doesn't make sense.
4. **Significantly more capable**: more premade cards (today there are
   exactly 5 `RichCard` kinds: `schedule`, `members`, `workout`,
   `time-off`, `outreach` — see `lib/chatbot/types.ts`), and "a lot more
   conversation options" — meaning broader intent/chip coverage across
   more of what the suite's data and pages actually support.
5. **"Pass for AI completely through deterministic code."** This is an
   explicit, ambitious bar: the user wants the experience of talking to
   Fitbot to feel like a real, capable assistant — broad phrasing
   tolerance, natural conversational flow, relevant follow-ups — while
   remaining 100% deterministic/rule-based (no LLM; that stays deferred
   per `docs/tasks/gitfit-suite-buildout/brief.md` Phase 11). Take this
   requirement at face value, not diluted.

## Process for this task

Per this project's standard workflow, and given this task includes a
real architecture/security decision (the role model), this gets the
elevated treatment: **Argus (investigate) → Athena (plan, with explicit
decisions) → user approval → Codex (implement) → Themis (review) →
Apollo (verify)**. This brief scopes investigation and planning only —
no implementation starts until the user approves Athena's plan.

## Out of scope (initial assumption, confirm in plan)

- Still no LLM integration.
- Not necessarily a full schema rewrite — Athena's plan should prefer
  the smallest change that correctly satisfies the role/access
  requirements, per this project's existing pattern of additive
  migrations.

## Preflight state

- Branch: `main`, clean as of commit `4ae4995` (Fitbot deterministic
  upgrade: 12-pool workout library, 3 new data-driven intents,
  guaranteed-answer chip system, booking consolidation).
- Existing role model: `profiles.role` = `client` | `staff` only.
  `is_staff(uid)` helper used throughout RLS. No `admin` concept
  anywhere in the schema, RLS policies, or application code today.
- Existing capability surface: 14 intents (`lib/chatbot/intents/`), 12
  chips (`lib/chatbot/chips.ts`), 5 `RichCard` kinds
  (`lib/chatbot/types.ts`), role-gated via each `Intent`'s `roles` array
  and `chips.ts`'s `staffOnly`/`clientOnly` helpers.
