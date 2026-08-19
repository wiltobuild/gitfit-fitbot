import type { SessionUser } from "@/lib/auth/session";
import { intents } from "@/lib/chatbot/intents";
import type { IntentResult } from "@/lib/chatbot/types";

export async function routeMessage(
  message: string,
  session: SessionUser,
): Promise<IntentResult & { intentId: string }> {
  for (const intent of intents) {
    if (intent.roles.includes(session.role) && intent.match(message, session)) {
      const result = await intent.handle(message, session);

      return { ...result, intentId: intent.id };
    }
  }

  return {
    reply: `That’s a strong place to start. You said: “${message}” — what would make that feel like a win this week?`,
    intentId: "fallback",
  };
}
