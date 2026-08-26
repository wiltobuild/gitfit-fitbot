import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { submitClassChangeRequest, type SubmitClassChangeInput } from "@/lib/class-changes/queries";
import { parseClassCreationInput } from "@/lib/class-creation-requests/validate";
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
  // Named requestType (not "type") on the wire -- an edit's proposed class
  // fields include their own "type" (Yoga/HIIT/etc, see
  // parseClassCreationInput), which would otherwise collide with this
  // request-kind discriminator on the same JSON body.
  const requestType = body?.requestType === "edit" || body?.requestType === "cancel" ? body.requestType : null;
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
  if (!classId || !requestType) {
    return errorResponse('A classId and a requestType of "edit" or "cancel" are required.', 400);
  }

  let input: SubmitClassChangeInput;
  if (requestType === "cancel") {
    input = { classId, userId: session.user.id, type: "cancel", reason };
  } else {
    const proposed = parseClassCreationInput(body?.proposedClass);
    if (!proposed) {
      return errorResponse("Name, type, date, start time, duration, and capacity are all required for an edit.", 400);
    }
    input = {
      classId,
      userId: session.user.id,
      type: "edit",
      reason,
      proposedName: proposed.name,
      proposedType: proposed.type,
      proposedClassDate: proposed.classDate,
      proposedStartTime: proposed.startTime,
      proposedDurationMinutes: proposed.durationMinutes,
      proposedCapacity: proposed.capacity
    };
  }

  const supabase = await createSupabaseServerClient();
  try {
    await submitClassChangeRequest(supabase, input);
  } catch {
    // RLS's class_change_requests_insert_own_class policy blocks a request
    // for a class this trainer doesn't teach -- that failure surfaces here
    // as a generic insert error, not a distinguishable code.
    return errorResponse("Unable to submit this request. You may not be assigned to that class.", 403);
  }
  return NextResponse.json({ ok: true });
}
