"use server";

import { revalidatePath } from "next/cache";

import { requireRoleOrThrow } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function reviewTimeOffRequest(requestId: string, status: "approved" | "denied") {
  try {
    const session = await requireRoleOrThrow("admin");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("time_off_requests")
      .update({
        status,
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", requestId);
    if (error) throw error;
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    console.error(`Unable to ${status} time-off request`, error);
    return { ok: false, error: "Unable to update this request. Please try again." };
  }
}

export async function approveTimeOffRequest(requestId: string) {
  return reviewTimeOffRequest(requestId, "approved");
}

export async function denyTimeOffRequest(requestId: string) {
  return reviewTimeOffRequest(requestId, "denied");
}
