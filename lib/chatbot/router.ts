import type { SessionUser } from "@/lib/auth/session";
import { intents } from "@/lib/chatbot/intents";
import type { IntentResult } from "@/lib/chatbot/types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type PendingClarification = {
  id: string;
  intent_id: string;
  partial_args: Record<string, unknown>;
  missing_slot: string;
  expires_at: string;
};

function scoreIntents(message: string, session: SessionUser) {
  let matchedIntent: (typeof intents)[number] | undefined;
  let highestScore = 0;
  for (const intent of intents) {
    if (!intent.roles.includes(session.role)) continue;
    const score = intent.match(message, session);
    if (score > highestScore) {
      matchedIntent = intent;
      highestScore = score;
    }
  }
  return { matchedIntent, highestScore };
}

async function upsertPendingClarification(
  supabase: SupabaseClient,
  userId: string,
  intentId: string,
  clarification: NonNullable<IntentResult["needsClarification"]>
) {
  // The applied table intentionally has no UPDATE RLS policy. Clear any
  // existing own-user row so upsert takes its permitted INSERT path.
  const { error: deleteError } = await supabase
    .from("chat_pending_clarifications")
    .delete()
    .eq("user_id", userId);
  if (deleteError) throw deleteError;
  const { error } = await supabase.from("chat_pending_clarifications").upsert(
    {
      user_id: userId,
      intent_id: intentId,
      partial_args: clarification.partialArgs,
      missing_slot: clarification.missingSlot,
      prompt: clarification.prompt
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

export async function routeMessage(
  message: string,
  session: SessionUser,
  supabase: SupabaseClient
): Promise<IntentResult & { intentId: string }> {
  const { data, error } = await supabase
    .from("chat_pending_clarifications")
    .select("id, intent_id, partial_args, missing_slot, expires_at")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error) throw error;

  const pending = data as PendingClarification | null;
  if (pending && new Date(pending.expires_at) < new Date()) {
    const { error: deleteError } = await supabase
      .from("chat_pending_clarifications")
      .delete()
      .eq("id", pending.id);
    if (deleteError) throw deleteError;
  }

  const activePending =
    pending && new Date(pending.expires_at) >= new Date() ? pending : null;
  const { matchedIntent, highestScore } = scoreIntents(message, session);

  if (
    activePending &&
    (matchedIntent?.id === activePending.intent_id || highestScore === 0)
  ) {
    const pendingIntent = intents.find(
      (intent) => intent.id === activePending.intent_id
    );
    if (pendingIntent && pendingIntent.roles.includes(session.role)) {
      const result = await pendingIntent.handle(message, session, {
        partialArgs: activePending.partial_args,
        missingSlot: activePending.missing_slot
      });
      if (result.needsClarification) {
        await upsertPendingClarification(
          supabase,
          session.user.id,
          pendingIntent.id,
          result.needsClarification
        );
      } else {
        const { error: deleteError } = await supabase
          .from("chat_pending_clarifications")
          .delete()
          .eq("id", activePending.id);
        if (deleteError) throw deleteError;
      }
      return { ...result, intentId: pendingIntent.id };
    }
  }

  if (
    activePending &&
    matchedIntent?.id !== activePending.intent_id &&
    highestScore > 0
  ) {
    const { error: deleteError } = await supabase
      .from("chat_pending_clarifications")
      .delete()
      .eq("id", activePending.id);
    if (deleteError) throw deleteError;
  }

  if (matchedIntent) {
    const result = await matchedIntent.handle(message, session);
    if (result.needsClarification) {
      await upsertPendingClarification(
        supabase,
        session.user.id,
        matchedIntent.id,
        result.needsClarification
      );
    }
    return { ...result, intentId: matchedIntent.id };
  }

  return {
    reply: `That’s a strong place to start. You said: “${message}” — what would make that feel like a win this week?`,
    intentId: "fallback"
  };
}
