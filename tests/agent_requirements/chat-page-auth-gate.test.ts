import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Requirement (Step 2): app/chat/page.tsx must be a server component that gates
 * access behind authentication. Before rendering ChatExperience it must call
 * requireUserOrRedirect() from lib/auth/session.ts (mirroring
 * app/appointments/page.tsx and app/dashboard/page.tsx). Any authenticated user
 * (client/staff/admin) may access chat — there is NO role restriction, so the
 * page must call requireUserOrRedirect (not requireRoleOrRedirect).
 *
 * Contract the builder must satisfy:
 *   app/chat/page.tsx
 *     - default export is an async function (server component).
 *     - On invocation it calls requireUserOrRedirect() from "@/lib/auth/session"
 *       exactly once, and awaits it BEFORE producing any render output.
 *     - When requireUserOrRedirect resolves with a session ({ user, role }), the
 *       page resolves to rendered JSX (truthy) and does NOT throw.
 *     - When requireUserOrRedirect throws/rejects (which is how the real helper
 *       signals an unauthenticated redirect — next/navigation's redirect() throws
 *       an internal control-flow error), the page propagates that throw/rejection
 *       rather than rendering the chat UI.
 *
 * We mock "@/lib/auth/session" entirely, so no real Next.js redirect machinery,
 * Supabase server client, or cookies() are needed — we only exercise the page's
 * two branches through the mocked helper's two behaviours.
 */

const requireUserOrRedirect = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireUserOrRedirect,
}));

async function loadFreshPage() {
  vi.resetModules();
  const mod = await import("@/app/chat/page");
  return mod.default;
}

describe("app/chat/page.tsx — server-side auth gate", () => {
  beforeEach(() => {
    requireUserOrRedirect.mockReset();
  });

  it("Case A: renders chat JSX when the user is authenticated, and calls requireUserOrRedirect exactly once", async () => {
    requireUserOrRedirect.mockResolvedValue({
      user: { id: "u1", email: "a@b.com" },
      role: "client",
    });

    const ChatPage = await loadFreshPage();

    const result = await ChatPage();

    // Auth gate must have been consulted before rendering.
    expect(requireUserOrRedirect).toHaveBeenCalledTimes(1);
    // Authenticated path renders something (JSX element), not nothing.
    expect(result).toBeTruthy();
  });

  it("Case B: propagates the redirect throw when unauthenticated (never renders the chat UI)", async () => {
    // Simulate next/navigation redirect(): the real requireUserOrRedirect throws
    // an internal control-flow error when there is no session.
    const redirectError = new Error("NEXT_REDIRECT");
    requireUserOrRedirect.mockRejectedValue(redirectError);

    const ChatPage = await loadFreshPage();

    await expect(ChatPage()).rejects.toBe(redirectError);
    expect(requireUserOrRedirect).toHaveBeenCalledTimes(1);
  });
});
