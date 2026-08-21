import type { SessionUser } from "@/lib/auth/session";
import type { ChipId } from "@/lib/chatbot/chip-labels";
export type { SessionUser } from "@/lib/auth/session";

export type RichCard =
  | {
      kind: "schedule";
      classes: Array<{
        title: string;
        type: string;
        instructor: string;
        date: string;
        time: string;
        capacity: number;
        bookedCount: number;
      }>;
    }
  | {
      kind: "members";
      title?: string;
      members: Array<{
        name: string;
        email: string;
        status: string;
        reason?: string;
      }>;
    }
  | {
      kind: "workout";
      title: string;
      blocks: Array<{ name: string; detail: string; blockLabel?: string }>;
    }
  | {
      kind: "time-off";
      requests: Array<{
        date: string;
        status: "pending" | "approved" | "denied";
      }>;
    }
  | {
      kind: "outreach";
      memberName: string;
      message: string;
      sent: boolean;
      sentAt?: string;
    }
  | {
      kind: "booking";
      className: string;
      date: string;
      time: string;
      instructor: string;
      outcome: "confirmed" | "cancelled" | "failed";
      reason?: string;
    }
  | {
      kind: "capacity";
      title?: string;
      rows: Array<{
        className: string;
        instructor: string;
        time: string;
        bookedCount: number;
        capacity: number;
        fillLevel: "healthy" | "filling" | "full";
      }>;
    };

export type IntentResult = {
  reply: string;
  data?: unknown;
  card?: RichCard;
  suggestedChips?: ChipId[];
  resolvedEntities?: { classId?: string; memberId?: string; date?: string };
  needsClarification?: {
    missingSlot: string;
    partialArgs: Record<string, unknown>;
    prompt: string;
  };
};

export type Intent = {
  id: string;
  description: string;
  roles: Array<"client" | "staff" | "admin">;
  match: (message: string, session: SessionUser) => number;
  handle: (
    message: string,
    session: SessionUser,
    pendingAnswer?: {
      partialArgs: Record<string, unknown>;
      missingSlot: string;
    }
  ) => Promise<IntentResult> | IntentResult;
};
