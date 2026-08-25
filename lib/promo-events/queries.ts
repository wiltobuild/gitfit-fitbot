import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function logPromoEvent(supabase: SupabaseServerClient, { classId, promotedBy }: { classId: string; promotedBy: string }) {
  const { error } = await supabase.from("promo_events").insert({ class_id: classId, promoted_by: promotedBy });
  if (error) throw error;
}

export type LatestPromoEvent = { classId: string; promotedBy: string; createdAt: string };

// Most recent promotion per class, for the classIds given -- classes can be
// promoted more than once (promote/unpromote/promote again), only the
// latest is shown.
export async function listLatestPromoEvents(supabase: SupabaseServerClient, classIds: string[]): Promise<LatestPromoEvent[]> {
  if (!classIds.length) return [];
  const { data, error } = await supabase
    .from("promo_events")
    .select("class_id, promoted_by, created_at")
    .in("class_id", classIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const latestByClassId = new Map<string, LatestPromoEvent>();
  for (const row of data ?? []) {
    if (!latestByClassId.has(row.class_id)) {
      latestByClassId.set(row.class_id, { classId: row.class_id, promotedBy: row.promoted_by, createdAt: row.created_at });
    }
  }
  return [...latestByClassId.values()];
}
