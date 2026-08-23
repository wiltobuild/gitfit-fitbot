import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type RosterAttendee = { userId: string; name: string | null; email: string | null };

// Shared by the staff-console roster drill-down and the who-is-booked chatbot
// intent -- a booking's user_id can resolve to either a members row (most
// members) or a profiles row (staff/admin accounts with no members row), so
// both are checked the same way the chatbot intent already did.
export async function getClassRoster(supabase: SupabaseServerClient, classId: string): Promise<RosterAttendee[]> {
  const { data: bookings, error: bookingError } = await supabase.from("bookings").select("user_id").eq("class_id", classId);
  if (bookingError) throw bookingError;

  const userIds = [...new Set((bookings ?? []).map((booking) => booking.user_id))];
  if (!userIds.length) return [];

  const [{ data: members, error: memberError }, { data: profiles, error: profileError }] = await Promise.all([
    supabase.from("members").select("auth_user_id, full_name, email").in("auth_user_id", userIds),
    supabase.from("profiles").select("id, full_name").in("id", userIds)
  ]);
  if (memberError) throw memberError;
  if (profileError) throw profileError;

  const memberByAuthUserId = new Map((members ?? []).filter((member) => member.auth_user_id).map((member) => [member.auth_user_id as string, member]));
  const profileNameById = new Map((profiles ?? []).filter((profile) => profile.full_name).map((profile) => [profile.id, profile.full_name as string]));

  return userIds.map((userId) => {
    const member = memberByAuthUserId.get(userId);
    return {
      userId,
      name: member?.full_name ?? profileNameById.get(userId) ?? null,
      email: member?.email ?? null
    };
  });
}
