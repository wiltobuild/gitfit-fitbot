import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { deleteClass } from "@/lib/classes/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const errorResponse = (message: string, status: number) => NextResponse.json({ error: { message } }, { status });

export async function POST(_request: Request, { params }: { params: Promise<{ classId: string }> }) {
  let canceledBy: string;
  try {
    const session = await requireRoleOrThrow("admin");
    canceledBy = session.user.id;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(error.reason === "unauthenticated" ? "Unauthorized" : "Forbidden", error.reason === "unauthenticated" ? 401 : 403);
    }
    throw error;
  }

  const { classId } = await params;
  const supabase = await createSupabaseServerClient();
  try {
    await deleteClass(supabase, { classId, canceledBy });
    return NextResponse.json({ ok: true });
  } catch {
    return errorResponse("Unable to cancel this class right now. Please try again.", 500);
  }
}
