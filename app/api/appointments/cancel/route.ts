import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { cancelBooking } from "@/lib/appointments/booking";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const errorResponse = (code: string, message: string, status: number) =>
  NextResponse.json({ error: { code, message, retryable: false } }, { status });

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const classId = typeof body?.classId === "string" ? body.classId.trim() : "";
  if (!classId) return errorResponse("invalid_request", "A classId is required.", 400);

  const supabase = await createSupabaseServerClient();
  const result = await cancelBooking(supabase, session.user.id, classId);
  if (result.ok) return NextResponse.json({ ok: true });
  return errorResponse(result.code, result.message, 409);
}
