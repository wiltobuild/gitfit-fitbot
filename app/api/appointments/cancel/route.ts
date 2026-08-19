import { NextResponse } from "next/server";

import { UnauthorizedError, requireUserOrThrow } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const errorResponse = (code: string, message: string, status: number) =>
  NextResponse.json({ error: { code, message, retryable: false } }, { status });

export async function POST(request: Request) {
  let session;
  try {
    session = await requireUserOrThrow();
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw error;
  }

  const body = await request.json().catch(() => null);
  const classId = typeof body?.classId === "string" ? body.classId.trim() : "";
  if (!classId) return errorResponse("invalid_request", "A classId is required.", 400);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("bookings").delete().eq("class_id", classId).eq("user_id", session.user.id).select("id");
  if (error) throw error;
  if (!data?.length) return errorResponse("not_booked", "You don’t have a booking for that class.", 409);
  return NextResponse.json({ ok: true });
}
