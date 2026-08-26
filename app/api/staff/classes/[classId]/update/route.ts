import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { updateClass } from "@/lib/classes/queries";
import { parseClassInput } from "@/lib/classes/validate";
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
  const input = parseClassInput(body);
  if (!input) return errorResponse("Name, type, instructor, date, start time, duration, and capacity are all required.", 400);

  const { classId } = await params;
  const supabase = await createSupabaseServerClient();
  try {
    const result = await updateClass(supabase, classId, input);
    if (!result.ok) {
      return errorResponse(
        `Capacity can't be set below the current booked count (${result.bookedCount}).`,
        400
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return errorResponse("Unable to update this class right now. Please try again.", 500);
  }
}
