import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { submitTimeOffRequest } from "@/lib/time-off/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const errorResponse = (message: string, status: number) => NextResponse.json({ error: { message } }, { status });
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

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
  const requestedDate = typeof body?.requestedDate === "string" ? body.requestedDate.trim() : "";
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
  if (!datePattern.test(requestedDate)) {
    return errorResponse("A requestedDate in YYYY-MM-DD form is required.", 400);
  }

  const supabase = await createSupabaseServerClient();
  try {
    await submitTimeOffRequest(supabase, { userId: session.user.id, requestedDate, reason });
  } catch {
    return errorResponse("Unable to submit this request. Please try again.", 500);
  }
  return NextResponse.json({ ok: true });
}
