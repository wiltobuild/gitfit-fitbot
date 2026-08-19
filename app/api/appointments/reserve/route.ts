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
  const { data: classRow, error: classError } = await supabase.from("classes").select("id").eq("id", classId).maybeSingle();
  if (classError) throw classError;
  if (!classRow) return errorResponse("class_not_found", "That class could not be found.", 404);

  // Check for an existing booking before insert so a full-but-already-booked
  // class reports already_booked rather than class_full — the capacity
  // trigger fires before Postgres checks the unique constraint, so the error
  // branches below never got the chance to see the duplicate-booking case.
  const { data: existing } = await supabase.from("bookings").select("class_id").eq("class_id", classId).eq("user_id", session.user.id).maybeSingle();
  if (existing) return errorResponse("already_booked", "You’re already booked into that class.", 409);

  const { error } = await supabase.from("bookings").insert({ class_id: classId, user_id: session.user.id });
  if (!error) return NextResponse.json({ ok: true });
  if (error.message.toLowerCase().includes("class is full")) return errorResponse("class_full", "That class is full.", 409);
  if (error.code === "23505") return errorResponse("already_booked", "You’re already booked into that class.", 409);
  throw error;
}
