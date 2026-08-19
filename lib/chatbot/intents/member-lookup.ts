import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent } from "@/lib/chatbot/types";

type MemberRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

type ClassRow = {
  name: string;
  type: string;
  instructor: string;
  class_date: string;
  start_time: string;
};

const explicitLookupPattern = /\b(?:look\s+up|find)\s+(?:a\s+)?member\b|\bmember\s+info(?:\s+for)?\b|\bwho\s+is\s+(?:the\s+)?member\b/i;
const bareLookupWithTermPattern = /\blook\s+up\s+(?=[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|[a-z]+\s+[a-z]+)/i;

function extractSearchTerm(message: string) {
  const withoutTrigger = message
    .replace(/^\s*(?:please\s+)?(?:look\s+up|find)\s+(?:a\s+)?member(?:\s+(?:named|called))?\b/i, "")
    .replace(/^\s*(?:please\s+)?member\s+info(?:\s+for)?\b/i, "")
    .replace(/^\s*(?:please\s+)?who\s+is\s+(?:the\s+)?member\b/i, "")
    .replace(/^\s*(?:please\s+)?look\s+up\b/i, "");

  return withoutTrigger.replace(/^[\s,.:;!?"']+|[\s,.:;!?"']+$/g, "");
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function todayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export const memberLookupIntent: Intent = {
  id: "member-lookup",
  description: "Looks up a member's profile and upcoming bookings for staff.",
  roles: ["staff"],
  match: (message) => explicitLookupPattern.test(message) || bareLookupWithTermPattern.test(message),
  handle: async (message, _session) => {
    const searchTerm = extractSearchTerm(message);
    if (!searchTerm) {
      return { reply: "Please specify a member name or email to look up." };
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("search_members", { search_term: searchTerm });
    const members = (data ?? []) as MemberRow[];

    if (error) {
      console.error("Unable to search members", error);
      return { reply: "I couldn’t look up members right now. Please try again shortly." };
    }

    if (members.length === 0) {
      return { reply: `No members found matching '${searchTerm}'.` };
    }

    if (members.length > 1) {
      return {
        reply: `I found multiple members matching '${searchTerm}'. Please narrow the search:\n${members
          .map((member) => `${member.full_name || member.email} — ${member.email} — ${member.role}`)
          .join("\n")}`,
        card: { kind: "members", members: members.map((member) => ({ name: member.full_name || member.email, email: member.email, status: member.role })) },
      };
    }

    const member = members[0];
    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .select("classes!inner(name, type, instructor, class_date, start_time)")
      .eq("user_id", member.id)
      .gte("classes.class_date", todayDate())
      .order("created_at", { ascending: true });

    if (bookingError) {
      console.error("Unable to retrieve member bookings", bookingError);
      return { reply: "I found the member, but couldn’t retrieve their upcoming bookings right now. Please try again shortly." };
    }

    const classes = (bookingData ?? [])
      .map((booking) => booking.classes as unknown as ClassRow | null)
      .filter((classRow): classRow is ClassRow => classRow !== null)
      .sort((a, b) => `${a.class_date} ${a.start_time}`.localeCompare(`${b.class_date} ${b.start_time}`));
    const bookingsReply = classes.length === 0
      ? "No upcoming bookings."
      : `Upcoming bookings:\n${classes.map((classRow) => `${classRow.name} (${classRow.type}) with ${classRow.instructor} — ${formatDate(classRow.class_date)}, ${formatTime(classRow.start_time)}.`).join("\n")}`;

    return {
      reply: `${member.full_name || "no name on file"}\n${member.email}\nRole: ${member.role}\nMember since: ${formatDate(member.created_at)}\n${bookingsReply}`,
      card: { kind: "members", members: [{ name: member.full_name || member.email, email: member.email, status: `${member.role} · ${classes.length} upcoming booking${classes.length === 1 ? "" : "s"}` }] },
    };
  },
};
