import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClassRoster } from "@/lib/classes/roster";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Snapshots a class's label fields + its current roster into one
// class_cancellations audit row. class_id has no foreign key to classes (the
// classes row is hard-deleted right after cancellation, see 0024 migration),
// so this is the only place those label fields and the roster survive.
export async function logClassCancellation(
  supabase: SupabaseServerClient,
  { classId, canceledBy }: { classId: string; canceledBy: string }
): Promise<void> {
  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("name, class_date, start_time")
    .eq("id", classId)
    .maybeSingle();
  if (classError) throw classError;
  if (!classRow) throw new Error(`Cannot log cancellation: class ${classId} not found.`);

  const roster = await getClassRoster(supabase, classId);

  const { error } = await supabase.from("class_cancellations").insert({
    class_id: classId,
    class_name: classRow.name,
    class_date: classRow.class_date,
    start_time: classRow.start_time,
    canceled_by: canceledBy,
    booked_count: roster.length,
    roster
  });
  if (error) throw error;
}
