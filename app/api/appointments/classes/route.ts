import { NextResponse } from "next/server";
import { getState } from "@/lib/appointments-store";
export function GET() {
  return NextResponse.json(getState());
}
