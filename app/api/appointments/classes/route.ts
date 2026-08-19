import { NextResponse } from "next/server";

import { UnauthorizedError, requireUserOrThrow } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  let session;
  try {
    session = await requireUserOrThrow();
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw error;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: classes, error: classesError }, { data: bookings, error: bookingsError }] = await Promise.all([
    supabase.from("classes").select("id, name, type, instructor, class_date, start_time, duration_minutes, capacity, booked_count").order("class_date").order("start_time"),
    supabase.from("bookings").select("class_id").eq("user_id", session.user.id),
  ]);

  if (classesError || bookingsError) throw classesError ?? bookingsError;
  const bookedClassIds = new Set((bookings ?? []).map((booking) => booking.class_id));
  return NextResponse.json({ classes: (classes ?? []).map((classRow) => ({ ...classRow, isBookedByCurrentUser: bookedClassIds.has(classRow.id) })) });
}
