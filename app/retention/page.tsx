import SiteNav from "@/app/components/site-nav";
import { requireRoleOrRedirect } from "@/lib/auth/session";
import { getWeeklyActivityTrend } from "@/lib/classes/activity-trend";
import { getCohortMembers, getCohortMembersForInstructor, getMemberForUser } from "@/lib/members/queries";
import type { MemberRow } from "@/lib/members/queries";
import { cohortBoundaries } from "@/lib/retention/cohort-boundaries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { RetentionExperience } from "./retention-experience";

export default async function RetentionPage() {
  const { user, role } = await requireRoleOrRedirect(["staff", "admin"]);
  let initialCohorts: { minDays: number; maxDays: number; members: MemberRow[] }[] = cohortBoundaries.map(({ minDays, maxDays }) => ({ minDays, maxDays, members: [] }));
  let initialTrend: { weekStart: string; activeMembers: number }[] = [];
  // Admin gets the studio-wide view; a trainer only sees (and can message)
  // members who've actually booked one of their classes -- they run their
  // own book of students, not the whole roster.
  const audienceScope: "all" | "students" = role === "admin" ? "all" : "students";

  try {
    const supabase = await createSupabaseServerClient();
    let instructorMemberId: string | null = null;
    if (audienceScope === "students") {
      const { data: member, error } = await getMemberForUser(supabase, user.id);
      if (error) throw error;
      instructorMemberId = member?.is_instructor ? member.id : null;
    }

    const [cohorts, trend] = await Promise.all([
      Promise.all(
        cohortBoundaries.map(({ minDays, maxDays }) =>
          instructorMemberId
            ? getCohortMembersForInstructor(supabase, instructorMemberId, { minDays, maxDays })
            : audienceScope === "students"
              ? Promise.resolve({ data: [] as MemberRow[], error: null })
              : getCohortMembers(supabase, { minDays, maxDays })
        )
      ),
      getWeeklyActivityTrend(supabase)
    ]);
    initialCohorts = cohorts.map(({ data, error }, index) => {
      if (error) throw error;
      return { ...cohortBoundaries[index], members: data };
    });
    initialTrend = trend;
  } catch (error) { console.error("Unable to load retention campaign data", error); }

  return <div className="retention-shell"><SiteNav /><main><RetentionExperience audienceScope={audienceScope} initialCohorts={initialCohorts} initialTrend={initialTrend} staffUserId={user.id} /></main></div>;
}
