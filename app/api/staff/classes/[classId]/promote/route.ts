import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { setClassPromoted } from "@/lib/classes/queries";
import { logPromoEvent } from "@/lib/promo-events/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const errorResponse = (message: string, status: number) => NextResponse.json({ error: { message } }, { status });

export async function POST(request: Request, { params }: { params: Promise<{ classId: string }> }) {
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
  const promoted = typeof (body as { promoted?: unknown } | null)?.promoted === "boolean" ? (body as { promoted: boolean }).promoted : true;

  const { classId } = await params;
  const supabase = await createSupabaseServerClient();
  try {
    await setClassPromoted(supabase, classId, promoted);
    // Every time a class is (re-)promoted, log a new event -- un-promoting
    // just clears the flag and isn't itself a notable event.
    if (promoted) await logPromoEvent(supabase, { classId, promotedBy: session.user.id });
    return NextResponse.json({ ok: true });
  } catch {
    return errorResponse("Unable to update the promotion status right now. Please try again.", 500);
  }
}
