import { resolveRequestedDate } from "@/lib/chatbot/intents/time-off";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent } from "@/lib/chatbot/types";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";

type TimeOffRequestRow = {
  id: string;
  requested_date: string;
  status: "pending" | "approved" | "denied";
};
type StaffProfile = { id: string; full_name: string | null };
const reviewPattern = /\b(approve|approved|deny|denied|reject|rejected)\b/i;
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(year, month - 1, day));
}
// Staff/admin identity lives in profiles, not the members table (members
// holds the 300 synthetic gym members + instructors — real staff/admin
// accounts, like the 4 promoted @pursuit.org ones, are never rows there).
function matchingProfiles(message: string, profiles: StaffProfile[]) {
  const normalized = message.toLowerCase();
  return profiles.filter(
    (profile) =>
      profile.full_name &&
      profile.full_name
        .split(/\s+/)
        .some((name) =>
          new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(normalized)
        )
  );
}
function profileName(profile: StaffProfile) {
  return profile.full_name || "Staff member";
}
function resolutionReply(profiles: StaffProfile[]) {
  return `I found a few possible staff members. Please be more specific:\n${profiles.slice(0, 8).map(profileName).join("\n")}`;
}
function hasPlausibleName(message: string) {
  return message
    .replace(reviewPattern, "")
    .replace(
      /\b(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
      ""
    )
    .replace(/\b(time off|request|for|on)\b/gi, "")
    .trim()
    .split(/\s+/)
    .some((word) => /^[a-z][a-z'-]*$/i.test(word));
}

export const timeOffReviewIntent: Intent = {
  id: "time-off-review",
  description: "Lets admins approve or deny pending staff time-off requests.",
  roles: ["admin"],
  match: (message) =>
    scoreTriggerFamily(message, [reviewPattern]) &&
    Boolean(resolveRequestedDate(message)) &&
    hasPlausibleName(message)
      ? 2
      : 0,
  handle: async (message, session, pendingAnswer) => {
    void pendingAnswer;
    const status: "approved" | "denied" = /\b(approve|approved)\b/i.test(
      message
    )
      ? "approved"
      : "denied";
    const requestedDate = resolveRequestedDate(message);
    if (!requestedDate)
      return {
        reply: "Please specify the date of the time-off request to review."
      };
    const supabase = await createSupabaseServerClient();
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["staff", "admin"]);
    if (profileError)
      return {
        reply:
          "I could not retrieve staff members right now. Please try again shortly."
      };
    const matches = matchingProfiles(
      message,
      (profiles ?? []) as StaffProfile[]
    );
    if (matches.length > 1) return { reply: resolutionReply(matches) };
    if (!matches.length)
      return {
        reply: `No pending time-off request was found for that person on ${formatDate(requestedDate)}.`
      };
    const profile = matches[0];
    const { data: requests, error: requestError } = await supabase
      .from("time_off_requests")
      .select("id, requested_date, status")
      .eq("status", "pending")
      .eq("requested_date", requestedDate)
      .eq("user_id", profile.id);
    if (requestError)
      return {
        reply:
          "I could not retrieve pending time-off requests right now. Please try again shortly."
      };
    const pending = (requests ?? []) as TimeOffRequestRow[];
    if (!pending.length)
      return {
        reply: `No pending time-off request was found for ${profileName(profile)} on ${formatDate(requestedDate)}.`
      };
    if (pending.length > 1)
      return {
        reply: `I found multiple pending time-off requests for ${profileName(profile)} on ${formatDate(requestedDate)}. Please verify the request before trying again.`
      };
    const { error: updateError } = await supabase
      .from("time_off_requests")
      .update({
        status,
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", pending[0].id);
    if (updateError)
      return {
        reply:
          "I could not update that time-off request right now. Please try again shortly."
      };
    return {
      reply: `Marked ${profileName(profile)}'s time-off request for ${formatDate(pending[0].requested_date)} as ${status}.`,
      card: {
        kind: "time-off",
        requests: [{ date: pending[0].requested_date, status }]
      }
    };
  }
};
