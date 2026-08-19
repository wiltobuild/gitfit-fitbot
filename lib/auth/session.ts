import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserRole = "client" | "staff";

export type SessionUser = {
  user: User;
  role: UserRole;
};

export class UnauthorizedError extends Error {
  constructor(
    public readonly reason: "unauthenticated" | "wrong-role" = "unauthenticated",
  ) {
    super(reason === "unauthenticated" ? "Authentication required" : "Insufficient permissions");
    this.name = "UnauthorizedError";
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  // The signup trigger normally creates this row; default safely during a race or legacy gap,
  // but log it — a missing profile row usually means the trigger failed, not a benign race.
  if (!profile) {
    console.error(`No profiles row for authenticated user ${user.id} (${user.email}) — signup trigger may have failed.`);
  }
  const role: UserRole = profile?.role === "staff" ? "staff" : "client";

  return { user, role };
}

export async function requireUserOrRedirect(): Promise<SessionUser> {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  return session;
}

export async function requireUserOrThrow(): Promise<SessionUser> {
  const session = await getSession();

  if (!session) {
    throw new UnauthorizedError("unauthenticated");
  }

  return session;
}

export async function requireRoleOrRedirect(role: "staff"): Promise<SessionUser> {
  const session = await requireUserOrRedirect();

  if (session.role !== role) {
    // Authenticated users without staff access return to the future dashboard.
    redirect("/dashboard?error=forbidden");
  }

  return session;
}

export async function requireRoleOrThrow(role: "staff"): Promise<SessionUser> {
  const session = await requireUserOrThrow();

  if (session.role !== role) {
    throw new UnauthorizedError("wrong-role");
  }

  return session;
}
