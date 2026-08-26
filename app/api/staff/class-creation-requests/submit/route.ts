import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { submitClassCreationRequest } from "@/lib/class-creation-requests/queries";
import { parseClassCreationInput } from "@/lib/class-creation-requests/validate";
import { getMemberForUser } from "@/lib/members/queries";
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
  const input = parseClassCreationInput(body);
  if (!input) return errorResponse("Name, type, date, start time, duration, and capacity are all required.", 400);

  const supabase = await createSupabaseServerClient();

  // instructor_member_id is resolved from the caller's own session, never
  // trusted from the client body -- matches how class-changes' submit route
  // never lets the client claim ownership of a class it isn't scoped to.
  const { data: member, error: memberError } = await getMemberForUser(supabase, session.user.id);
  if (memberError) throw memberError;
  if (!member?.is_instructor) {
    return errorResponse("Only a linked instructor can propose a class.", 403);
  }

  try {
    await submitClassCreationRequest(supabase, {
      userId: session.user.id,
      instructorMemberId: member.id,
      name: input.name,
      type: input.type,
      classDate: input.classDate,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
      capacity: input.capacity,
      reason: input.reason,
    });
  } catch (error) {
    console.error("Unable to submit class-creation request", error instanceof Error ? error.message : error, (error as { code?: string; details?: string; hint?: string })?.code, (error as { details?: string })?.details);
    return errorResponse("Unable to submit this proposal right now. Please try again.", 500);
  }
  return NextResponse.json({ ok: true });
}
