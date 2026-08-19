import { NextResponse } from "next/server";
import { reserve } from "@/lib/appointments-store";
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const classId = typeof body?.classId === "string" ? body.classId.trim() : "";
  if (!classId)
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: "A classId is required.",
          retryable: false
        }
      },
      { status: 400 }
    );
  const result = reserve(classId);
  if (result.ok) return NextResponse.json(result.state);
  return NextResponse.json(
    { error: { code: result.code, message: result.message, retryable: false } },
    { status: result.code === "class_not_found" ? 404 : 409 }
  );
}
