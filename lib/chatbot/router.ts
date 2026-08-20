import type { SessionUser } from "@/lib/auth/session";
import { intents } from "@/lib/chatbot/intents";
import type { IntentResult } from "@/lib/chatbot/types";

export async function routeMessage(
  message: string,
  session: SessionUser,
): Promise<IntentResult & { intentId: string }> {
  let matchedIntent: typeof intents[number] | undefined;
  let highestScore = 0;
  for (const intent of intents) {
    if (!intent.roles.includes(session.role)) continue;
    const score = intent.match(message, session);
    if (score > highestScore) { matchedIntent = intent; highestScore = score; }
  }
  if (matchedIntent) {
    const result = await matchedIntent.handle(message, session);
    return { ...result, intentId: matchedIntent.id };
  }

  return {
    reply: `That’s a strong place to start. You said: “${message}” — what would make that feel like a win this week?`,
    intentId: "fallback",
  };
}
