import { NextResponse } from "next/server";

import { UnauthorizedError, requireUserOrThrow } from "@/lib/auth/session";
import { reserveBooking } from "@/lib/appointments/booking";
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
  const result = await reserveBooking(supabase, session.user.id, classId);
  if (result.ok) return NextResponse.json({ ok: true });
  return errorResponse(result.code, result.message, result.code === "class_not_found" ? 404 : 409);
}
