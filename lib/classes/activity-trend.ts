import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function getWeeklyActivityTrend(supabase: SupabaseServerClient, { weeks = 8 }: { weeks?: number } = {}) {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const weekMonday = new Date(today);
  weekMonday.setDate(today.getDate() - mondayOffset);
  weekMonday.setHours(0, 0, 0, 0);

  const weekCount = Math.max(1, Math.floor(weeks));
  const windowStart = new Date(weekMonday);
  windowStart.setDate(weekMonday.getDate() - (weekCount - 1) * 7);

  const { data, error } = await supabase.from("bookings").select("user_id, created_at").gte("created_at", windowStart.toISOString());
  if (error) throw error;

  const activeMemberIdsByWeek = new Map<string, Set<string>>();
  for (const booking of data ?? []) {
    const bookingDate = new Date(booking.created_at);
    const bookingMondayOffset = (bookingDate.getDay() + 6) % 7;
    const bookingWeekMonday = new Date(bookingDate);
    bookingWeekMonday.setDate(bookingDate.getDate() - bookingMondayOffset);
    bookingWeekMonday.setHours(0, 0, 0, 0);
    const weekStart = formatDate(bookingWeekMonday);
    const activeMemberIds = activeMemberIdsByWeek.get(weekStart) ?? new Set<string>();
    activeMemberIds.add(booking.user_id);
    activeMemberIdsByWeek.set(weekStart, activeMemberIds);
  }

  return Array.from({ length: weekCount }, (_, index) => {
    const weekStart = new Date(windowStart);
    weekStart.setDate(windowStart.getDate() + index * 7);
    const formattedWeekStart = formatDate(weekStart);
    return { weekStart: formattedWeekStart, activeMembers: activeMemberIdsByWeek.get(formattedWeekStart)?.size ?? 0 };
  });
}
