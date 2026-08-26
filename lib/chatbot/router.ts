import type { SessionUser } from "@/lib/auth/session";
import {
  resolveClassType,
  resolveDate,
  resolveInstructor
} from "@/lib/chatbot/entity-extraction";
import type { ChipId } from "@/lib/chatbot/chip-labels";
import { INTENT_CHIP_MAP } from "@/lib/chatbot/intent-chip-map";
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
type ResolvedEntities = NonNullable<IntentResult["resolvedEntities"]>;
type ChatMessage = {
  role: string;
  resolved_entities: unknown;
};

const shorthandReferencePattern =
  /\b(that one|the other (one|class)|her too|him too|them too|that class|that member)\b/i;

function readResolvedEntities(value: unknown): ResolvedEntities | undefined {
  if (!value || typeof value !== "object") return undefined;
  const entities = value as Record<string, unknown>;
  const classId =
    typeof entities.classId === "string" ? entities.classId : undefined;
  const memberId =
    typeof entities.memberId === "string" ? entities.memberId : undefined;
  const date = typeof entities.date === "string" ? entities.date : undefined;
  return classId || memberId || date ? { classId, memberId, date } : undefined;
}

async function enrichShorthandMessage(
  message: string,
  session: SessionUser,
  supabase: SupabaseClient
) {
  if (!shorthandReferencePattern.test(message)) return message;

  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("role, content, resolved_entities, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(6);
    if (error) return message;

    const recentAssistantMessage = (data as ChatMessage[] | null)?.find(
      (chatMessage) =>
        chatMessage.role === "assistant" &&
        readResolvedEntities(chatMessage.resolved_entities)
    );
    const entities = recentAssistantMessage
      ? readResolvedEntities(recentAssistantMessage.resolved_entities)
      : undefined;
    if (!entities) return message;

    if (entities.classId) {
      if (
        resolveDate(message) ||
        resolveClassType(message) ||
        resolveInstructor(message)
      )
        return message;
      const { data: classRow, error: classError } = await supabase
        .from("classes")
        .select("type, class_date, instructor")
        .eq("id", entities.classId)
        .maybeSingle();
      if (classError || !classRow) return message;
      return `${message} ${classRow.type} ${classRow.class_date} ${classRow.instructor}`;
    }

    if (entities.memberId) {
      const { data: member, error: memberError } = await supabase
        .from("members")
        .select("full_name")
        .eq("id", entities.memberId)
        .maybeSingle();
      if (memberError || !member?.full_name) return message;
      return `${message} ${member.full_name}`;
    }
  } catch {
    // Conversation lookback is optional; routing must continue without it.
  }

  return message;
}

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

function findNearMissChips(message: string, session: SessionUser): ChipId[] {
  const fragments = [
    message,
    ...message
      .split(/[,.!?]|\band\b|\bor\b/i)
      .map((fragment) => fragment.trim())
      .filter(Boolean)
  ];
  const chips: ChipId[] = [];

  for (const intent of intents) {
    const chip = INTENT_CHIP_MAP[intent.id];
    if (!chip || !intent.roles.includes(session.role)) continue;

    const score = Math.max(
      ...fragments.map((fragment) => intent.match(fragment, session))
    );
    if (score > 0 && !chips.includes(chip)) chips.push(chip);
    if (chips.length === 3) break;
  }

  return chips;
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
  const {
    matchedIntent: pendingMatchedIntent,
    highestScore: pendingHighestScore
  } = scoreIntents(message, session);

  if (
    activePending &&
    (pendingMatchedIntent?.id === activePending.intent_id ||
      pendingHighestScore === 0)
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
    pendingMatchedIntent?.id !== activePending.intent_id &&
    pendingHighestScore > 0
  ) {
    const { error: deleteError } = await supabase
      .from("chat_pending_clarifications")
      .delete()
      .eq("id", activePending.id);
    if (deleteError) throw deleteError;
  }

  const routingMessage = await enrichShorthandMessage(
    message,
    session,
    supabase
  );
  const { matchedIntent, highestScore } = scoreIntents(routingMessage, session);

  if (matchedIntent) {
    const result = await matchedIntent.handle(routingMessage, session);
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

  const nearMissChips = findNearMissChips(message, session);
  if (nearMissChips.length) {
    return {
      reply: "I'm not totally sure what you meant.",
      card: {
        kind: "notice",
        tone: "info",
        title: "Did you mean one of these?",
        body: `You said: "${message}" — here are a few things I can help with instead:`
      },
      suggestedChips: nearMissChips,
      intentId: "fallback"
    };
  }

  // Nothing matched, not even a fragment (see the near-miss branch above) --
  // this is the true "I don't understand you" case, not a vague-but-real
  // goal statement. Say so plainly and name real capabilities instead of
  // treating unparseable input as if it were a goal worth coaching.
  return {
    reply: "I couldn't quite match that to something I can help with.",
    card: {
      kind: "notice",
      tone: "info",
      title: "Here's what I can help with",
      body: "Try asking about classes, bookings, your schedule, or a fitness goal — or tap a suggestion below."
    },
    suggestedChips:
      session.role === "client"
        ? ["todays-schedule", "my-goals", "recommend-class", "menu"]
        : ["todays-schedule", "studio-capacity", "member-lookup", "menu"],
    intentId: "fallback"
  };
}
