import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteClass, updateClass } from "@/lib/classes/queries";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ClassChangeRequest = {
  id: string;
  class_id: string;
  user_id: string;
  type: "edit" | "cancel";
  proposed_name: string | null;
  proposed_type: string | null;
  proposed_class_date: string | null;
  proposed_start_time: string | null;
  proposed_duration_minutes: number | null;
  proposed_capacity: number | null;
  reason: string | null;
  status: "pending" | "approved" | "denied";
  created_at: string;
  reviewed_at: string | null;
};

const columns = "id, class_id, user_id, type, proposed_name, proposed_type, proposed_class_date, proposed_start_time, proposed_duration_minutes, proposed_capacity, reason, status, created_at, reviewed_at";

export async function listOwnClassChangeRequests(supabase: SupabaseServerClient, userId: string) {
  const { data, error } = await supabase
    .from("class_change_requests")
    .select(columns)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClassChangeRequest[];
}

export async function listPendingClassChangeRequests(supabase: SupabaseServerClient) {
  const { data, error } = await supabase
    .from("class_change_requests")
    .select(columns)
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as ClassChangeRequest[];
}

export type SubmitClassChangeInput =
  | { classId: string; userId: string; type: "cancel"; reason: string | null }
  | {
      classId: string;
      userId: string;
      type: "edit";
      reason: string | null;
      proposedName: string;
      proposedType: string;
      proposedClassDate: string;
      proposedStartTime: string;
      proposedDurationMinutes: number;
      proposedCapacity: number;
    };

type ClassChangeRequestRow = {
  class_id: string;
  user_id: string;
  type: "edit" | "cancel";
  reason: string | null;
  proposed_name: string | null;
  proposed_type: string | null;
  proposed_class_date: string | null;
  proposed_start_time: string | null;
  proposed_duration_minutes: number | null;
  proposed_capacity: number | null;
};

export async function submitClassChangeRequest(supabase: SupabaseServerClient, input: SubmitClassChangeInput) {
  const row: ClassChangeRequestRow =
    input.type === "edit"
      ? {
          class_id: input.classId,
          user_id: input.userId,
          type: "edit",
          reason: input.reason,
          proposed_name: input.proposedName,
          proposed_type: input.proposedType,
          proposed_class_date: input.proposedClassDate,
          proposed_start_time: input.proposedStartTime,
          proposed_duration_minutes: input.proposedDurationMinutes,
          proposed_capacity: input.proposedCapacity
        }
      : {
          class_id: input.classId,
          user_id: input.userId,
          type: "cancel",
          reason: input.reason,
          proposed_name: null,
          proposed_type: null,
          proposed_class_date: null,
          proposed_start_time: null,
          proposed_duration_minutes: null,
          proposed_capacity: null
        };
  const { error } = await supabase.from("class_change_requests").insert(row);
  if (error) throw error;
}

export type ResolveResult =
  | { ok: true }
  | { ok: false; code: "not_found" | "capacity_below_booked"; message: string };

export async function resolveClassChangeRequest(
  supabase: SupabaseServerClient,
  { requestId, decision, reviewerId }: { requestId: string; decision: "approved" | "denied"; reviewerId: string }
): Promise<ResolveResult> {
  // RLS's class_change_requests_update_admin policy is the real access gate.
  // Fetched separately (not via the final status-flip update below) because
  // an approved "edit" must actually apply via updateClass() -- including
  // its own capacity_below_booked failure mode -- *before* the request is
  // marked approved, so a request never ends up "approved" while the class
  // itself was left unchanged.
  const { data: existingRows, error: fetchError } = await supabase
    .from("class_change_requests")
    .select(columns)
    .eq("id", requestId)
    .eq("status", "pending");
  if (fetchError) throw fetchError;
  const existing = (existingRows as ClassChangeRequest[] | null)?.[0];
  if (!existing) {
    return { ok: false, code: "not_found", message: "That request is no longer pending, or does not exist." };
  }

  if (decision === "approved" && existing.type === "edit") {
    const { data: classRow, error: classError } = await supabase
      .from("classes")
      .select("instructor, instructor_member_id")
      .eq("id", existing.class_id)
      .maybeSingle();
    if (classError) throw classError;
    if (!classRow) {
      return { ok: false, code: "not_found", message: "The class this request was for no longer exists." };
    }
    const updateResult = await updateClass(supabase, existing.class_id, {
      name: existing.proposed_name!,
      type: existing.proposed_type!,
      instructorMemberId: classRow.instructor_member_id ?? "",
      instructorName: classRow.instructor,
      classDate: existing.proposed_class_date!,
      startTime: existing.proposed_start_time!,
      durationMinutes: existing.proposed_duration_minutes!,
      capacity: existing.proposed_capacity!
    });
    if (!updateResult.ok) {
      return {
        ok: false,
        code: "capacity_below_booked",
        message: `Can't approve: the proposed capacity is below the ${updateResult.bookedCount} spots already booked.`
      };
    }
  }

  const { data, error } = await supabase
    .from("class_change_requests")
    .update({ status: decision, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");

  if (error) throw error;
  if (!data?.length) {
    return { ok: false, code: "not_found", message: "That request is no longer pending, or does not exist." };
  }

  if (decision === "approved" && existing.type === "cancel") {
    await deleteClass(supabase, { classId: existing.class_id, canceledBy: reviewerId });
  }

  return { ok: true };
}

/**
 * When a class is deleted, any still-pending edit/cancel requests against it
 * can never be resolved by a member action -- auto-deny them so they don't
 * sit forever in the manager queue pointing at a class that no longer exists.
 */
export async function denyPendingRequestsForCanceledClass(
  supabase: SupabaseServerClient,
  { classId, reviewerId }: { classId: string; reviewerId: string }
): Promise<number> {
  const { data, error } = await supabase
    .from("class_change_requests")
    .update({
      status: "denied",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      reason: "Class was canceled."
    })
    .eq("class_id", classId)
    .eq("status", "pending")
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}
