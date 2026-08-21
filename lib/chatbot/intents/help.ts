import type { Intent } from "@/lib/chatbot/types";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";
const helpKeywords = ["help", "what can you do", "what can you help with"];
export const helpIntent: Intent = {
  id: "help",
  description: "Explains the chatbot's current capabilities.",
  roles: ["client", "staff", "admin"],
  match: (message) => {
    const normalized = message.toLowerCase();
    return /\bplan\b.*\b(week|workout)\b|\b(workout|week)\b.*\bplan\b/.test(
      normalized
    )
      ? 0
      : scoreTriggerFamily(
          normalized,
          helpKeywords.map((keyword) => new RegExp(keyword, "i"))
        );
  },
  handle: (_message, session, pendingAnswer) => {
    void pendingAnswer;
    if (session.role === "admin")
      return {
        reply:
          "I can help run the studio and support your fitness routine: schedules, class details, instructor lookups, booking, studio capacity, roster summaries, member lookup, outreach, and time-off tools. You can also approve or deny pending staff time-off by naming the person and date."
      };
    if (session.role === "staff")
      return {
        reply:
          "I can help with fitness goals, booking, schedule questions, class details, instructor lookups, today's studio capacity, roster summaries, member lookup, outreach, and time-off coverage."
      };
    return {
      reply:
        "I can help with fitness goals, booking, schedule questions, class details, and instructor class lookups. Ask about a day, instructor, or class type to get started."
    };
  }
};
