import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent } from "@/lib/chatbot/types";

type MemberRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

type BookingRow = { user_id: string };

const retentionPatterns = [
  /\bwho\s+hasn['’]?t\s+attended\b/i,
  /\battendance\s+dropped\b/i,
  /\bwho\s+needs\s+re-engagement\b/i,
  /\bwho\s+hasn['’]?t\s+been\b/i,
  /\binactive\s+members\b/i,
  /\bhaven['’]?t\s+attended\s+recently\b/i,
];

export const retentionLookupIntent: Intent = {
  id: "retention-lookup",
  description: "Finds client members with no recorded bookings for staff re-engagement.",
  roles: ["staff"],
  match: (message) => retentionPatterns.some((pattern) => pattern.test(message)),
  handle: async () => {
    const supabase = await createSupabaseServerClient();
    const [{ data: memberData, error: memberError }, { data: bookingData, error: bookingError }] = await Promise.all([
      supabase.rpc("search_members", { search_term: "" }),
      supabase.from("bookings").select("user_id"),
    ]);

    if (memberError || bookingError) {
      console.error("Unable to look up retention candidates", memberError ?? bookingError);
      return { reply: "I couldn’t retrieve booking activity right now. Please try again shortly." };
    }

    const members = (memberData ?? []) as MemberRow[];
    const bookedUserIds = new Set(((bookingData ?? []) as BookingRow[]).map((booking) => booking.user_id));
    const candidates = members.filter((member) => member.role === "client" && !bookedUserIds.has(member.id));
    const caveat = "Based on booking activity (no dedicated attendance tracking exists yet), these members have no recorded bookings:";

    if (candidates.length === 0) {
      return { reply: `${caveat}\nNone found.` };
    }

    return {
      reply: `${caveat}\n${candidates.map((member) => member.full_name || member.email).join("\n")}`,
      card: {
        kind: "members",
        title: "Members needing re-engagement",
        members: candidates.map((member) => ({ name: member.full_name || member.email, email: member.email, status: member.role, reason: "No recorded bookings" })),
      },
    };
  },
};
