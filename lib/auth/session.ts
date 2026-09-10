import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEV_COOKIE, isDemoMode } from "@/lib/demo/accounts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserRole = "client" | "staff" | "admin";

export type SessionUser = {
  user: User;
  role: UserRole;
  // Demo-only all-access flag. When true the session was created by the "dev"
  // quick-login: role is forced to "admin" for data access and every
  // requireRole* gate is waived. See lib/demo/accounts.ts.
  dev?: boolean;
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
  const role: UserRole = profile?.role === "admin" ? "admin" : profile?.role === "staff" ? "staff" : "client";

  if (isDemoMode()) {
    const cookieStore = await cookies();
    if (cookieStore.get(DEV_COOKIE)?.value === "1") {
      // dev view: treat as admin for RLS/data purposes, plus waive role gates.
      return { user, role: "admin", dev: true };
    }
  }

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

export async function requireRoleOrRedirect(role: UserRole | UserRole[]): Promise<SessionUser> {
  const session = await requireUserOrRedirect();

  if (session.dev) return session; // dev view bypasses every role gate

  if (Array.isArray(role) ? !role.includes(session.role) : session.role !== role) {
    // Authenticated users without the required role return to the dashboard.
    redirect("/dashboard?error=forbidden");
  }

  return session;
}

export async function requireRoleOrThrow(role: UserRole | UserRole[]): Promise<SessionUser> {
  const session = await requireUserOrThrow();

  if (session.dev) return session; // dev view bypasses every role gate

  if (Array.isArray(role) ? !role.includes(session.role) : session.role !== role) {
    throw new UnauthorizedError("wrong-role");
  }

  return session;
}
