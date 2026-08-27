import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent } from "@/lib/chatbot/types";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";
import { resolveDate, resolveWeekday } from "@/lib/chatbot/entity-extraction";

const timeOffRequestPatterns = [
  /\bday(?:s)? off\b/i,
  /\btime off\b/i,
  /\boff work\b/i,
  /\brequest(?:\s+\w+){0,3}\s+off\b/i,
  /\bpto\b/i,
  /\btake\s+(?:\w+\s+)?off\b/i,
  /\b(?:need|want)\s+(?:\w+\s+){0,3}off\b/i,
  /\bwon(?:'t| not)\s+be\s+able\s+to\s+work\b/i
];

const timeOffLookupPatterns = [
  /\bmy time off(?: requests)?\b/i,
  /\bwhat time off(?: have i)?(?: requested)?\b/i,
  /\bmy requests\b/i
];

type TimeOffRequestRow = {
  requested_date: string;
  status: "pending" | "approved" | "denied";
};

function hasWord(message: string, word: string) {
  return new RegExp(`\\b${word}\\b`, "i").test(message);
}

export const resolveRequestedDate = resolveDate;

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

function extractReason(message: string) {
  const becauseMatch = message.match(/\bbecause\s+(.+)/i);
  if (becauseMatch) {
    return becauseMatch[1].trim() || null;
  }

  const forMatch = message.match(/\bfor\s+(.+)/i);
  if (!forMatch) {
    return null;
  }

  const reason = forMatch[1].trim();
  return Boolean(resolveWeekday(reason)) ||
    hasWord(reason, "today") ||
    hasWord(reason, "tomorrow")
    ? null
    : reason || null;
}

function isLookup(message: string) {
  return timeOffLookupPatterns.some((pattern) => pattern.test(message));
}

export const timeOffIntent: Intent = {
  id: "time-off",
  description: "Lets staff submit and review their time-off requests.",
  roles: ["staff", "admin"],
  match: (message) =>
    !/\b(approve|approved|deny|denied|reject|rejected)\b/i.test(message)
      ? scoreTriggerFamily(message, [
          ...timeOffLookupPatterns,
          ...timeOffRequestPatterns
        ]) *
        (1 +
          scoreEntity(message, [
            /\b(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
          ]))
      : 0,
  handle: async (message, session, pendingAnswer) => {
    void pendingAnswer;
    const supabase = await createSupabaseServerClient();

    if (isLookup(message)) {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select("requested_date, status")
        .eq("user_id", session.user.id)
        .order("requested_date", { ascending: true });

      if (error) {
        console.error("Unable to query time-off requests", error);
        return {
          reply:
            "I couldn’t retrieve your time-off requests right now. Please try again shortly."
        };
      }

      const requests = (data ?? []) as TimeOffRequestRow[];
      if (requests.length === 0) {
        return { reply: "You don’t have any time-off requests yet." };
      }

      return {
        reply: `Here are your time-off requests:\n${requests
          .map(
            (request) =>
              `${formatDate(request.requested_date)} — ${request.status}.`
          )
          .join("\n")}`,
      };
    }

    const requestedDate = resolveRequestedDate(message);
    if (!requestedDate) {
      return {
        reply:
          "Please specify a day for your time off, such as this Friday, next Monday, or tomorrow."
      };
    }

    const { error } = await supabase.from("time_off_requests").insert({
      user_id: session.user.id,
      requested_date: requestedDate,
      reason: extractReason(message)
    });

    if (error) {
      console.error("Unable to create time-off request", error);
      return {
        reply:
          "I couldn’t submit your time-off request right now. Please try again shortly."
      };
    }

    return {
      reply: `Your time-off request for ${formatDate(requestedDate)} has been submitted and is pending review.`
    };
  }
};
