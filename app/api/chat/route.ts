import { UnauthorizedError, requireUserOrThrow } from "@/lib/auth/session";
import {
  ADMIN_MENU,
  CHIP_LABELS,
  CHIP_ROLES,
  CLIENT_MENU,
  STAFF_MENU,
  type ChipId
} from "@/lib/chatbot/chip-labels";
import { chips } from "@/lib/chatbot/chips";
import { routeMessage } from "@/lib/chatbot/router";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireUserOrThrow();
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    throw error;
  }
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const chipId = typeof body.chipId === "string" ? body.chipId : undefined;
  const params =
    body.params && typeof body.params === "object"
      ? {
          memberId:
            typeof body.params.memberId === "string"
              ? body.params.memberId
              : undefined
        }
      : undefined;
  if (chipId && !Object.prototype.hasOwnProperty.call(chips, chipId))
    return Response.json({ error: "Unknown chipId." }, { status: 400 });
  if (chipId && !CHIP_ROLES[chipId as ChipId].includes(session.role))
    return Response.json({ error: "Forbidden." }, { status: 403 });
  if (!chipId && !message)
    return Response.json({ error: "A message is required." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  const result = chipId
    ? await chips[chipId as ChipId](session, params)
    : await routeMessage(message, session, supabase);
  result.suggestedChips ??=
    session.role === "admin"
      ? ADMIN_MENU
      : session.role === "staff"
        ? STAFF_MENU
        : CLIENT_MENU;
  const content = chipId ? CHIP_LABELS[chipId as ChipId] : message;
  const { error: userMessageError } = await supabase
    .from("chat_messages")
    .insert({ user_id: session.user.id, role: "user", content });
  if (userMessageError) throw userMessageError;
  const { error: assistantMessageError } = await supabase
    .from("chat_messages")
    .insert({
      user_id: session.user.id,
      role: "assistant",
      content: result.reply
    });
  if (assistantMessageError) throw assistantMessageError;
  return Response.json({
    reply: result.reply,
    card: result.card,
    suggestedChips: result.suggestedChips,
    role: session.role
  });
}

export async function GET() {
  let session;
  try {
    session = await requireUserOrThrow();
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    throw error;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at, is_promotional")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return Response.json({
    userId: session.user.id,
    role: session.role,
    messages: (data ?? []).map((message) =>
      message.role === "assistant"
        ? {
            ...message,
            suggestedChips:
              session.role === "admin"
                ? ADMIN_MENU
                : session.role === "staff"
                  ? STAFF_MENU
                  : CLIENT_MENU
          }
        : message
    )
  });
}
