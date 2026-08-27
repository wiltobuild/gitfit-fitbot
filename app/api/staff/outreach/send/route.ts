import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { sendOutreachDraft } from "@/lib/outreach/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const errorResponse = (message: string, status: number) => NextResponse.json({ error: { message } }, { status });

export async function POST(request: Request) {
  try {
    await requireRoleOrThrow(["staff", "admin"]);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(error.reason === "unauthenticated" ? "Unauthorized" : "Forbidden", error.reason === "unauthenticated" ? 401 : 403);
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const draftId = typeof body?.draftId === "string" ? body.draftId.trim() : "";
  if (!draftId) return errorResponse("A draftId is required.", 400);

  const supabase = await createSupabaseServerClient();
  const result = await sendOutreachDraft(supabase, draftId);
  if (result.ok) return NextResponse.json({ ok: true, sentAt: result.sentAt });
  return errorResponse(result.message, 404);
}
