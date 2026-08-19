# Brief: Fitness guidance + workout planning (Phase 8)

## Scope

Deterministic, rule-based workout-plan generation — the scaffolding Phase
11's LLM integration later plugs into (same `IntentResult` shape, same
intent slot; Phase 11 swaps the generation logic, not the contract). Per
the user's explicit deterministic-first requirement, this phase does NOT
call an LLM — it builds a real, useful rule-based generator now, honest
about being template-based rather than personalized AI advice.

- `lib/chatbot/intents/workout-plan.ts` — matches phrasing like "build me
  a workout", "I need a quick workout" (an existing chat starter prompt),
  "workout plan", "help me plan my week" (another existing starter
  prompt), "give me a workout". Deterministically extracts, with
  sensible defaults when absent:
  - **Duration**: parse "X minutes"/"X min" from the message; default 30.
  - **Goal**: keyword match — strength, cardio, flexibility/mobility, or
    general/default.
  - **Equipment**: keyword match — bodyweight/none (default), dumbbells,
    full gym.
  - **Level**: keyword match — beginner (default), intermediate, advanced.
  - Generates a plan from a small hand-authored exercise-block library
    (warmup, main block(s) scaled to fit the duration, cooldown),
    filtered by goal/equipment/level. Returns both a readable text `reply`
    and a structured `data` payload (exercise blocks) — Phase 4's
    `IntentResult.data` field exists for exactly this, even though
    rendering it as rich UI is Phase 12's job; populating it now means
    Phase 12 doesn't have to touch this intent's logic later.
- General fitness guidance ("I want to get stronger but I hate running")
  is explicitly LLM territory per the user's own examples and is NOT
  built as a rule-based intent in this phase — it correctly falls through
  to the existing fallback until Phase 11. Document this clearly so it
  isn't mistaken for a gap.

## Out of scope

- Real LLM-generated, personalized plans (Phase 11).
- Persisting generated plans (no "save my workout" feature yet).
- Safety-boundary copy review beyond basic sanity (no medical claims,
  a light disclaimer) — deeper safety review is a product-level concern
  beyond this phase's scope.

## Acceptance criteria

1. "Build me a 45-minute workout for today" returns a plan whose total
   estimated time is reasonably close to 45 minutes, with warmup/main/
   cooldown structure.
2. "I need a quick workout" (no duration specified) uses the 30-minute
   default and still returns a coherent plan.
3. Goal/equipment/level keywords correctly influence exercise selection
   (verify at least one case each).
4. "I want to get stronger but I hate running" — an open-ended, LLM-shaped
   request — correctly does NOT match this intent and falls through to
   fallback (confirms the deterministic/LLM boundary is where the brief
   says it should be, not accidentally over-matched).
5. `npm run lint` / `npm run build` pass; existing intents unaffected.

## Preflight state

Phases 1-7 complete and committed. No exercise data exists anywhere yet —
this phase introduces a small in-code exercise library (not a DB table;
no user-specific state, no reason to pay for a Supabase round-trip for
static content).
