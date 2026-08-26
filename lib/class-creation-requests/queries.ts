import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClass } from "@/lib/classes/queries";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ClassCreationRequest = {
  id: string;
  user_id: string;
  instructor_member_id: string;
  name: string;
  type: string;
  class_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  reason: string | null;
  status: "pending" | "approved" | "denied";
  created_at: string;
  reviewed_at: string | null;
  created_class_id: string | null;
};

const columns = "id, user_id, instructor_member_id, name, type, class_date, start_time, duration_minutes, capacity, reason, status, created_at, reviewed_at, created_class_id";

export async function listOwnClassCreationRequests(supabase: SupabaseServerClient, userId: string) {
  const { data, error } = await supabase
    .from("class_creation_requests")
    .select(columns)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClassCreationRequest[];
}

export async function listPendingClassCreationRequests(supabase: SupabaseServerClient) {
  const { data, error } = await supabase
    .from("class_creation_requests")
    .select(columns)
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as ClassCreationRequest[];
}

export type ClassCreationInput = {
  userId: string;
  instructorMemberId: string;
  name: string;
  type: string;
  classDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  reason: string | null;
};

export async function submitClassCreationRequest(supabase: SupabaseServerClient, input: ClassCreationInput) {
  const { error } = await supabase.from("class_creation_requests").insert({
    user_id: input.userId,
    instructor_member_id: input.instructorMemberId,
    name: input.name,
    type: input.type,
    class_date: input.classDate,
    start_time: input.startTime,
    duration_minutes: input.durationMinutes,
    capacity: input.capacity,
    reason: input.reason,
  });
  if (error) throw error;
}

export type ResolveResult = { ok: true } | { ok: false; code: "not_found"; message: string };

export async function resolveClassCreationRequest(
  supabase: SupabaseServerClient,
  { requestId, decision, reviewerId }: { requestId: string; decision: "approved" | "denied"; reviewerId: string }
): Promise<ResolveResult> {
  // The conditional .eq("status", "pending") is both the double-resolve guard
  // (matching lib/class-changes/queries.ts's convention) and, for approvals,
  // the concurrency gate: only the caller whose update actually affects a row
  // goes on to create the class below, so a double-click can't create it twice.
  const { data, error } = await supabase
    .from("class_creation_requests")
    .update({ status: decision, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select(columns);

  if (error) throw error;
  const request = data?.[0] as ClassCreationRequest | undefined;
  if (!request) {
    return { ok: false, code: "not_found", message: "That request is no longer pending, or does not exist." };
  }

  if (decision === "approved") {
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("full_name")
      .eq("id", request.instructor_member_id)
      .maybeSingle();
    if (memberError) throw memberError;

    const classId = await createClass(supabase, {
      name: request.name,
      type: request.type,
      instructorMemberId: request.instructor_member_id,
      instructorName: member?.full_name ?? "Unnamed instructor",
      classDate: request.class_date,
      startTime: request.start_time,
      durationMinutes: request.duration_minutes,
      capacity: request.capacity,
    });
    const { error: linkError } = await supabase
      .from("class_creation_requests")
      .update({ created_class_id: classId })
      .eq("id", requestId);
    if (linkError) throw linkError;
  }

  return { ok: true };
}
