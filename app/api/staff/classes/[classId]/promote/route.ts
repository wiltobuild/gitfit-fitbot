import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { setClassPromoted } from "@/lib/classes/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const errorResponse = (message: string, status: number) => NextResponse.json({ error: { message } }, { status });

export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
  try {
    await requireRoleOrThrow("admin");
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(error.reason === "unauthenticated" ? "Unauthorized" : "Forbidden", error.reason === "unauthenticated" ? 401 : 403);
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const promoted = typeof (body as { promoted?: unknown } | null)?.promoted === "boolean" ? (body as { promoted: boolean }).promoted : true;

  const { classId } = await params;
  const supabase = await createSupabaseServerClient();
  try {
    await setClassPromoted(supabase, classId, promoted);
    return NextResponse.json({ ok: true });
  } catch {
    return errorResponse("Unable to update the promotion status right now. Please try again.", 500);
  }
}
