import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type StudioClass = {
  id: string;
  name: string;
  type: string;
  instructor: string;
  class_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  booked_count: number;
  instructor_member_id: string | null;
};

const classSelect =
  "id, name, type, instructor, class_date, start_time, duration_minutes, capacity, booked_count, instructor_member_id";

export async function getUpcomingClasses(
  supabase: SupabaseServerClient,
  { from, to }: { from: string; to: string }
) {
  const { data, error } = await supabase
    .from("classes")
    .select(classSelect)
    .gte("class_date", from)
    .lte("class_date", to)
    .order("class_date")
    .order("start_time");

  if (error) throw error;
  return (data ?? []) as StudioClass[];
}

export async function getClassesForMonth(
  supabase: SupabaseServerClient,
  year: number,
  month: number
) {
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0);
  const finalDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
  return getUpcomingClasses(supabase, { from: firstDay, to: finalDay });
}
