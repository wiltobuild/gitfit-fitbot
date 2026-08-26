import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  let session;
  try {
    // Booking a class is a client-only action -- staff/admin operate the
    // studio, they don't book into it as a member.
    session = await requireRoleOrThrow("client");
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: error.reason === "unauthenticated" ? 401 : 403 });
    }
    throw error;
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const rangeEnd = new Date(today);
  rangeEnd.setDate(today.getDate() + 27); // this week + next 3 weeks
  const rangeEndKey = `${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, "0")}-${String(rangeEnd.getDate()).padStart(2, "0")}`;

  const supabase = await createSupabaseServerClient();
  const [{ data: classes, error: classesError }, { data: bookings, error: bookingsError }] = await Promise.all([
    supabase.from("classes").select("id, name, type, instructor, class_date, start_time, duration_minutes, capacity, booked_count").gte("class_date", todayKey).lte("class_date", rangeEndKey).order("class_date").order("start_time"),
    supabase.from("bookings").select("class_id").eq("user_id", session.user.id),
  ]);

  if (classesError || bookingsError) throw classesError ?? bookingsError;
  const bookedClassIds = new Set((bookings ?? []).map((booking) => booking.class_id));
  return NextResponse.json({ classes: (classes ?? []).map((classRow) => ({ ...classRow, isBookedByCurrentUser: bookedClassIds.has(classRow.id) })) });
}
