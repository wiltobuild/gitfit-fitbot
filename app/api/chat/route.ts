import { UnauthorizedError, requireUserOrThrow } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let session;

  try {
    session = await requireUserOrThrow();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    throw error;
  }

  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return Response.json({ error: "A message is required." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { error: userMessageError } = await supabase.from("chat_messages").insert({
    user_id: session.user.id,
    role: "user",
    content: message,
  });

  if (userMessageError) {
    throw userMessageError;
  }

  const reply = `That’s a strong place to start. You said: “${message}” — what would make that feel like a win this week?`;
  const { error: assistantMessageError } = await supabase.from("chat_messages").insert({
    user_id: session.user.id,
    role: "assistant",
    content: reply,
  });

  if (assistantMessageError) {
    throw assistantMessageError;
  }

  return Response.json({ reply });
}

export async function GET() {
  let session;

  try {
    session = await requireUserOrThrow();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    throw error;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return Response.json({ messages: data ?? [] });
}
