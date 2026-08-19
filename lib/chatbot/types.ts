import type { SessionUser } from "@/lib/auth/session";

export type IntentResult = { reply: string; data?: unknown };

export type Intent = {
  id: string;
  description: string;
  roles: Array<"client" | "staff">;
  match: (message: string, session: SessionUser) => boolean;
  handle: (message: string, session: SessionUser) => Promise<IntentResult> | IntentResult;
};
