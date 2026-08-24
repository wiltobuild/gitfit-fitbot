import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { submitClassChangeRequest } from "@/lib/class-changes/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const errorResponse = (message: string, status: number) => NextResponse.json({ error: { message } }, { status });

export async function POST(request: Request) {
  let session;
  try {
    session = await requireRoleOrThrow(["staff", "admin"]);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(error.reason === "unauthenticated" ? "Unauthorized" : "Forbidden", error.reason === "unauthenticated" ? 401 : 403);
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const classId = typeof body?.classId === "string" ? body.classId.trim() : "";
  const type = body?.type === "swap" || body?.type === "cancel" ? body.type : null;
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
  if (!classId || !type) {
    return errorResponse('A classId and a type of "swap" or "cancel" are required.', 400);
  }

  const supabase = await createSupabaseServerClient();
  try {
    await submitClassChangeRequest(supabase, { classId, userId: session.user.id, type, reason });
  } catch {
    // RLS's class_change_requests_insert_own_class policy blocks a request
    // for a class this trainer doesn't teach -- that failure surfaces here
    // as a generic insert error, not a distinguishable code.
    return errorResponse("Unable to submit this request. You may not be assigned to that class.", 403);
  }
  return NextResponse.json({ ok: true });
}
