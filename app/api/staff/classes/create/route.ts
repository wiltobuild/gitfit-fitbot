import { NextResponse } from "next/server";

import { UnauthorizedError, requireRoleOrThrow } from "@/lib/auth/session";
import { createClass } from "@/lib/classes/queries";
import { parseClassInput } from "@/lib/classes/validate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const errorResponse = (message: string, status: number) => NextResponse.json({ error: { message } }, { status });

export async function POST(request: Request) {
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

  const supabase = await createSupabaseServerClient();
  try {
    const id = await createClass(supabase, input);
    return NextResponse.json({ ok: true, id });
  } catch {
    return errorResponse("Unable to create this class right now. Please try again.", 500);
  }
}
