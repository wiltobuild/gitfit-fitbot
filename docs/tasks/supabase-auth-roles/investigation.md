# Investigation: Supabase auth + client/staff roles (Argus)

## Verified facts

**1. App structure (`app/`)**
- `app/page.tsx` — landing page (`/`). Static content, links to `/chat` and `/appointments`. No user concept.
- `app/chat/page.tsx` — renders `<ChatExperience />` (`app/chat/chat-experience.tsx`). No user/session concept; `Message` type only has `role: "assistant" | "user"` for chat bubble styling, not auth (app/chat/chat-experience.tsx:6, 20).
- `app/appointments/page.tsx` — appointments page. No user concept beyond the API's hardcoded member.
- `app/api/chat/route.ts` — `POST` handler, stubbed reply generator, no user identity at all.
- `app/api/appointments/classes/route.ts` — `GET`, calls `getState()` — no request-scoped identity, returns hardcoded member's state.
- `app/api/appointments/reserve/route.ts` — `POST`, calls `reserve(classId)` — no identity in request, mutates the single global in-memory current member.
- `app/api/appointments/cancel/route.ts` — `POST`, calls `cancel(classId)` — same pattern.
- No `app/api/*` route reads cookies, headers, or any auth token today (verified by reading full contents of all three appointment routes and the chat route).

**2. Root layout** (`app/layout.tsx:1-28`)
- Minimal Server Component: loads two Google fonts, sets `<html>`/`<body>`, no providers, no context. `{children}` renders directly inside `<body>` around line 25 — a session/auth provider (client component wrapping `{children}`) can be inserted here without disrupting existing pages.

**3. `lib/appointments-store.ts` — hardcoded identity confirmed**
- `export const CURRENT_MEMBER_ID = "member_001";` — lib/appointments-store.ts:11
- Module-scope lookup at load time (lib/appointments-store.ts:24-30), single module-level mutable `currentMember` object (line 31) and `heldClassIds` filtered to `CURRENT_MEMBER_ID` only (lines 33-40).
- `getState()` (46-60), `reserve()` (62-86), `cancel()` (88-102) all operate on shared in-memory state with no per-request/per-user parameterization — concurrent callers would share/corrupt state. Pre-existing issue, independent of auth.

**4. `.env.example` / `.gitignore`**
- `.env.example` contains only `ANTHROPIC_API_KEY=` (unused placeholder), no Supabase vars.
- `.gitignore` ignores `.env`, `.env.*`, un-ignores `!.env.example`. No secrets committed.

**5. `package.json`**
- `next` resolves to **16.3.1**; `react`/`react-dom` resolve to **19.2.8**.
- No Supabase packages installed (`@supabase/supabase-js`, `@supabase/ssr` both absent).
- Scripts: `dev`, `build`, `start`, `lint`, `format`. No test script.
- **Critical Next.js 16 breaking-change**: `middleware.js/ts` is deprecated/renamed to `proxy.js/ts` in Next.js 16 (node_modules/next/dist/docs/.../file-conventions/proxy.md). Any Supabase SSR guide describing `middleware.ts` is stale for this version — a `middleware.ts` file would not run.
- Proxy execution-order caveat (proxy.md:217-219): Server Actions are POST requests to their defining page route, not separate routes in the proxy chain — a proxy `matcher` excluding a path also skips Server Actions there. Next's own docs recommend checking auth inside each Server Function/Route Handler too, not relying on proxy alone.
- `cookies()` from `next/headers` is async in this version (must be awaited), settable only in Server Functions/Route Handlers, not Server Components — relevant to `@supabase/ssr`'s cookie adapter.
- Next's official App Router auth guide recommends Server Actions + `useActionState` for sign-up/login forms as the idiomatic Next 16 pattern.

**6. Middleware / server-side request handling**
- No `middleware.ts`, `proxy.ts`, or any request-interception file exists anywhere in the repo. No existing auth/session utility under `lib/`. A permission-check helper starts from nothing — and must use `proxy.ts`, not `middleware.ts`, if request interception is used at all.

**7. Docs context**
- `docs/agent/project-profile.md` is stale (still describes the repo as freshly bootstrapped/empty) — decisions log and direct repo inspection are more reliable for current facts.
- Brief's out-of-scope note "chatbot shell doesn't exist yet" is inaccurate — `app/chat/*` and `/api/chat` already exist as a working (stubbed) UI. Doesn't change Phase 1 scope (chat auth integration is still deferred to Phase 3+), but the planner should know the surface already exists.

## Inferences

- `pulse-studio-prototype` is likely embedded at `/appointments` per the `appointments-prototype-embed` task, but its exact relationship to `app/appointments/page.tsx` wasn't confirmed by reading that file directly. **Confidence: low.**
- `app/appointments/data/members.json` likely contains multiple members (only `member_001` is ever selected), hinting the seed data may already anticipate multi-user use. **Confidence: medium**, not confirmed by direct read.

## Unknowns

- Contents of `app/appointments/page.tsx` and `data/*.json` not read in full.
- `next.config.ts` not inspected for settings relevant to a future `proxy.ts`.
- Whether real Supabase credentials have been supplied — not present in the repo at investigation time (they have since been added to a local, gitignored `.env` by the user, out of band from this investigation).

## Risks

1. **Middleware/proxy naming mismatch** — the single biggest risk. Standard `@supabase/ssr` guides use `middleware.ts`; this repo needs `proxy.ts` exporting `proxy()`. Copying guides verbatim would silently break session refresh.
2. **Single shared in-memory demo state** in `lib/appointments-store.ts` — pre-existing, out of scope for Phase 1, but the planner should not assume `/appointments` is safe to test concurrently.
3. **Proxy Server Action gap** — Next's own docs warn Server Actions can bypass proxy-based route matchers. Role enforcement must also check auth inside each Server Action/Route Handler, not rely on proxy interception alone.
4. **`docs/agent/project-profile.md` staleness** — should not be used as ground truth for current repo facts.
