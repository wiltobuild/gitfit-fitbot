import { describe, expect, it } from "vitest";

import { interpretChatResponse } from "@/lib/chatbot/interpret-chat-response";
import type { RichCard } from "@/lib/chatbot/types";
import type { ChipId } from "@/lib/chatbot/chip-labels";

/**
 * Requirement (Step 1): extract the /api/chat response interpretation out of the
 * React component into an exported PURE helper (no React, no fetch) that maps the
 * raw outcome of a `POST /api/chat` call to the Message to append — or an error
 * signal — and that distinguishes a 401 (session lost) from every other failure.
 *
 * Contract asserted here (informs the builder):
 *   interpretChatResponse({ ok, status, data }: {
 *     ok: boolean; status: number; data: unknown;
 *   }):
 *     | { kind: "reply"; content: string; card?: RichCard;
 *         suggestedChips?: ChipId[]; role?: Role }
 *     | { kind: "error"; content: string; suggestedChips: ChipId[] }
 *
 * The exact string literals below are copied verbatim from the current
 * `sendMessage`/`sendChip` bodies in app/chat/chat-experience.tsx (including the
 * U+2019 right-single-quotation apostrophes) so the extraction must preserve
 * them, not paraphrase them.
 */

// Verbatim from chat-experience.tsx (data.reply ?? "..."):
const FALLBACK_REPLY = "I’m here. Let’s take the next step together.";
// Verbatim from the catch blocks in chat-experience.tsx:
const GENERIC_SNAG = "I hit a small snag. Try that again and we’ll keep moving.";

const sampleCard: RichCard = {
  kind: "notice",
  tone: "info",
  title: "Heads up",
  body: "A note",
};

describe("interpretChatResponse — pure /api/chat outcome interpreter", () => {
  it("200 with a reply payload yields a reply carrying content/role/card/suggestedChips", () => {
    const suggestedChips: ChipId[] = ["quick-workout", "menu"];
    const result = interpretChatResponse({
      ok: true,
      status: 200,
      data: {
        reply: "hello",
        role: "client",
        card: sampleCard,
        suggestedChips,
      },
    });

    expect(result.kind).toBe("reply");
    if (result.kind !== "reply") throw new Error("expected reply");
    expect(result.content).toBe("hello");
    expect(result.role).toBe("client");
    expect(result.card).toEqual(sampleCard);
    expect(result.suggestedChips).toEqual(suggestedChips);
  });

  it("200 without a reply falls back to the exact existing fallback string", () => {
    const result = interpretChatResponse({ ok: true, status: 200, data: {} });

    expect(result.kind).toBe("reply");
    if (result.kind !== "reply") throw new Error("expected reply");
    expect(result.content).toBe(FALLBACK_REPLY);
  });

  it("401 yields a distinct sign-in-oriented error, not the generic snag and not the body text", () => {
    const data = { error: "Unauthorized" };
    const result = interpretChatResponse({ ok: false, status: 401, data });

    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("expected error");

    // Distinct from the generic snag message.
    expect(result.content).not.toBe(GENERIC_SNAG);
    // Never echoes any string taken verbatim from the input data object.
    expect(result.content).not.toBe(data.error);
    expect(Object.values(data)).not.toContain(result.content);
    // Sign-in oriented (session lost), so it must read differently than a retry nudge.
    expect(result.content.length).toBeGreaterThan(0);
    // Error branch must still supply chips to render.
    expect(Array.isArray(result.suggestedChips)).toBe(true);
  });

  it("400 (a non-401 failure) yields the exact existing generic snag message", () => {
    const data = { error: "Bad Request", reply: "should-not-render" };
    const result = interpretChatResponse({ ok: false, status: 400, data });

    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("expected error");
    expect(result.content).toBe(GENERIC_SNAG);
    // Error bodies are never rendered as replies.
    expect(Object.values(data)).not.toContain(result.content);
    expect(Array.isArray(result.suggestedChips)).toBe(true);
  });

  it("500 lands on the same generic branch as 400, and never echoes the body", () => {
    const data = { error: "Internal Server Error", reply: "leak-me" };
    const result = interpretChatResponse({ ok: false, status: 500, data });

    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("expected error");
    expect(result.content).toBe(GENERIC_SNAG);
    // 401 must NOT collapse into this branch — sign-in copy differs from the snag.
    const unauth = interpretChatResponse({
      ok: false,
      status: 401,
      data: { error: "Unauthorized" },
    });
    if (unauth.kind !== "error") throw new Error("expected error");
    expect(unauth.content).not.toBe(result.content);
    // No verbatim body text leaks through.
    expect(Object.values(data)).not.toContain(result.content);
    expect(Array.isArray(result.suggestedChips)).toBe(true);
  });
});
