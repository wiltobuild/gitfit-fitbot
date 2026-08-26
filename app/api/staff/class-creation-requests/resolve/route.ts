import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { resolveClassCreationRequest } from "@/lib/class-creation-requests/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const errorResponse = (message: string, status: number) => NextResponse.json({ error: { message } }, { status });

export async function POST(request: Request) {
  let session;
  try {
    session = await requireRoleOrThrow("admin");
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(error.reason === "unauthenticated" ? "Unauthorized" : "Forbidden", error.reason === "unauthenticated" ? 401 : 403);
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
  const decision = body?.decision === "approved" || body?.decision === "denied" ? body.decision : null;
  if (!requestId || !decision) {
    return errorResponse('A requestId and a decision of "approved" or "denied" are required.', 400);
  }

  const supabase = await createSupabaseServerClient();
  const result = await resolveClassCreationRequest(supabase, { requestId, decision, reviewerId: session.user.id });
  if (result.ok) return NextResponse.json({ ok: true });
  return errorResponse(result.message, 404);
}
