import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "A message is required." }, { status: 400 });
  return NextResponse.json({ reply: `That’s a strong place to start. You said: “${message}” — what would make that feel like a win this week?` });
}
