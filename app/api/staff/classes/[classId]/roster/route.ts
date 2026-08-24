import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { getClassRoster } from "@/lib/classes/roster";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const errorResponse = (message: string, status: number) => NextResponse.json({ error: { message } }, { status });

export async function GET(_request: Request, { params }: { params: Promise<{ classId: string }> }) {
  try {
    await requireRoleOrThrow(["staff", "admin"]);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return errorResponse(error.reason === "unauthenticated" ? "Unauthorized" : "Forbidden", error.reason === "unauthenticated" ? 401 : 403);
    }
    throw error;
  }

  const { classId } = await params;
  const supabase = await createSupabaseServerClient();
  try {
    const attendees = await getClassRoster(supabase, classId);
    return NextResponse.json({ attendees });
  } catch {
    return errorResponse("Unable to retrieve attendees right now. Please try again shortly.", 500);
  }
}
