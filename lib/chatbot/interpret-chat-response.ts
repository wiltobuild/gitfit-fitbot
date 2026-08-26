import type { ChipId } from "@/lib/chatbot/chip-labels";
import type { RichCard } from "@/lib/chatbot/types";

type Role = "client" | "staff" | "admin";

const FALLBACK_REPLY = "I’m here. Let’s take the next step together.";
const GENERIC_SNAG = "I hit a small snag. Try that again and we’ll keep moving.";
const SIGNED_OUT_MESSAGE = "Looks like your session signed out. Sign back in and we'll pick up where we left off.";

const DEFAULT_SUGGESTED_CHIPS: ChipId[] = ["quick-workout", "plan-my-week", "menu"];

type ChatResponseData = {
  reply?: string;
  role?: Role;
  card?: RichCard;
  suggestedChips?: ChipId[];
};

type InterpretChatResponseResult =
  | { kind: "reply"; content: string; card?: RichCard; suggestedChips?: ChipId[]; role?: Role }
  | { kind: "error"; content: string; suggestedChips: ChipId[] };

export function interpretChatResponse(input: {
  ok: boolean;
  status: number;
  data: unknown;
}): InterpretChatResponseResult {
  if (input.ok) {
    const data = input.data as ChatResponseData;
    return {
      kind: "reply",
      content: data.reply ?? FALLBACK_REPLY,
      card: data.card,
      suggestedChips: data.suggestedChips,
      role: data.role,
    };
  }

  if (input.status === 401) {
    return {
      kind: "error",
      content: SIGNED_OUT_MESSAGE,
      suggestedChips: DEFAULT_SUGGESTED_CHIPS,
    };
  }

  return {
    kind: "error",
    content: GENERIC_SNAG,
    suggestedChips: DEFAULT_SUGGESTED_CHIPS,
  };
}
