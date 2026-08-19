import type { SessionUser } from "@/lib/auth/session";

export type RichCard =
  | { kind: "schedule"; classes: Array<{ title: string; type: string; instructor: string; date: string; time: string; capacity: number; bookedCount: number }> }
  | { kind: "members"; title?: string; members: Array<{ name: string; email: string; status: string; reason?: string }> }
  | { kind: "workout"; title: string; blocks: Array<{ name: string; detail: string; blockLabel?: string }> }
  | { kind: "time-off"; requests: Array<{ date: string; status: "pending" | "approved" | "denied" }> }
  | { kind: "outreach"; memberName: string; message: string; sent: boolean; sentAt?: string };

export type IntentResult = { reply: string; data?: unknown; card?: RichCard };

export type Intent = {
  id: string;
  description: string;
  roles: Array<"client" | "staff">;
  match: (message: string, session: SessionUser) => boolean;
  handle: (message: string, session: SessionUser) => Promise<IntentResult> | IntentResult;
};
