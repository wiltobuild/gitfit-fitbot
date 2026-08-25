# Plan

STATUS: ACTIVE
TASK: Fix /chat auth gate — batch 2 of 4 from the full-app audit (2026-08-24).
/chat is the only protected page with no server-side auth check (no redirect
to /sign-in unlike every sibling page), and chat-experience.tsx's sendMessage
never checks response.ok, so a 401 gets rendered as a normal-looking bot
reply instead of prompting sign-in.

## Steps

- [x] 1. Extract the /api/chat response interpretation into a testable pure
      function, and use it in sendMessage
  - Do: Introduce an exported pure helper (no React, no fetch) that takes
    the raw Response outcome from a POST /api/chat call and returns the
    Message object to append (or signals an error). Wire sendMessage so a
    non-ok response is never rendered as a normal assistant reply. The
    helper must distinguish a 401 (session lost) from other failures so the
    client can show a sign-in-appropriate message.
  - Contract: exported function e.g. `interpretChatResponse({ ok, status,
    data }): { kind: "reply"; content: string; card?; suggestedChips?;
    role? } | { kind: "error"; content: string; suggestedChips: ChipId[] }`.
    - ok:true, data={reply:"hello", role:"client", card, suggestedChips} ->
      {kind:"reply", content:"hello", role:"client", card, suggestedChips}
    - ok:true, data={} (no reply) -> {kind:"reply"} with content = existing
      fallback string "I'm here. Let's take the next step together."
      (match source literal exactly)
    - ok:false, status:401, data={error:"Unauthorized"} -> {kind:"error"}
      with a distinct sign-in-oriented content, NOT the generic snag
      message and NOT data.reply/data.error text verbatim
    - ok:false, status: 400|403|500 (any non-401 non-ok) -> {kind:"error"}
      with content = existing generic snag message "I hit a small snag.
      Try that again and we'll keep moving." (match source literal)
    - In every kind:"error" case, content must never equal an error/reply
      string taken verbatim from data
    - sendMessage must call this helper and append the returned message;
      on kind:"error" append an assistant message with the error content
      rather than data.reply ?? fallback
  - Done when: vitest test importing the helper passes for all 5 cases
    (200-with-reply, 200-without-reply, 401, non-401 error e.g. 400, 500),
    asserting exact content strings and that 401 differs from generic
    error. `npm run build` passes (authoritative typecheck; ignore
    .next/types/ noise per GUARDRAILS.md). Reading chat-experience.tsx,
    sendMessage no longer contains `content: data.reply ?? "..."` as its
    unconditional success path.
  - Touches: app/chat/chat-experience.tsx (refactor sendMessage, extract
    helper — may live in same file or new lib/chatbot/ module), possibly
    new file under lib/chatbot/.
  - Requirement test: tests/agent_requirements/interpret-chat-response.test.ts (GREEN)

- [x] 2. Add server-side auth gate to app/chat/page.tsx
  - Do: Convert app/chat/page.tsx to an async server component that calls
    requireUserOrRedirect() from lib/auth/session.ts before rendering
    ChatExperience, mirroring app/appointments/page.tsx /
    app/dashboard/page.tsx. No role restriction — any authenticated user
    may access chat, so use requireUserOrRedirect (not requireRoleOrRedirect).
  - Contract: page.tsx default export is async, awaits
    requireUserOrRedirect() before returning any JSX. Unauthenticated:
    redirect("/sign-in") fires (matches /appointments, /dashboard).
    Authenticated: renders ChatExperience as before, no behavior change to
    the chat UI itself. No new role gate — client-role users must still
    reach chat, not redirected to /dashboard?error=forbidden.
  - Done when: vitest test importing the page module with
    @/lib/auth/session stubbed/mocked asserts (a) unauthenticated ->
    redirect path fires, ChatExperience not returned; (b) authenticated
    (any role incl. client) -> invokes without redirecting. If mounting
    the RSC proves impractical in node env, acceptable fallback evidence:
    test asserts the page module calls requireUserOrRedirect exactly once
    on invocation, before render. Live cross-check (manual, not
    necessarily automated): `curl -D - http://localhost:<port>/chat`
    unauthenticated returns 307 to /sign-in, matching /appointments.
    `npm run build` passes.
  - Touches: app/chat/page.tsx.
  - Requirement test: tests/agent_requirements/chat-page-auth-gate.test.ts (GREEN)

## Notes carried from planning
- Test env is vitest `environment: "node"`, no jsdom/RTL — house style is
  hand-rolled DI stubs on imported functions, not mounting React components
  or driving live HTTP. Step 1's contract is built around an extracted pure
  interpretation function for exactly this reason.
- Step 2 testability caveat: RSC auth-gate pages are awkward to unit-test
  under node (pull in next/navigation, Supabase server client, cookies).
  No sibling protected page has a unit test for its auth gate today — the
  convention is trusting requireUserOrRedirect plus manual/curl
  verification. Fallback: assert the page calls the helper, plus a manual
  curl check documented in the verify step, rather than burning attempts
  trying to fully render an RSC under node.
- No shared-contract approval gate triggered: no tool-manifest/JWT/error-
  response-shape change — the 401 body `{"error":"Unauthorized"}` is
  unchanged, only how the client reacts to it changes.
