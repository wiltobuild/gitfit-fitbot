import SiteNav from "@/app/components/site-nav";
import { requireRoleOrRedirect } from "@/lib/auth/session";
import { getWeeklyActivityTrend } from "@/lib/classes/activity-trend";
import { getCohortMembers } from "@/lib/members/queries";
import type { MemberRow } from "@/lib/members/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { RetentionExperience } from "./retention-experience";

const cohortBoundaries = [{ minDays: 7, maxDays: 14 }, { minDays: 14, maxDays: 30 }, { minDays: 31, maxDays: 60 }];

export default async function RetentionPage() {
  const { user, role } = await requireRoleOrRedirect(["staff", "admin"]);
  let initialCohorts: { minDays: number; maxDays: number; members: MemberRow[] }[] = cohortBoundaries.map(({ minDays, maxDays }) => ({ minDays, maxDays, members: [] }));
  let initialTrend: { weekStart: string; activeMembers: number }[] = [];

  try {
    const supabase = await createSupabaseServerClient();
    const [cohorts, trend] = await Promise.all([Promise.all(cohortBoundaries.map(({ minDays, maxDays }) => getCohortMembers(supabase, { minDays, maxDays }))), getWeeklyActivityTrend(supabase)]);
    initialCohorts = cohorts.map(({ data, error }, index) => {
      if (error) throw error;
      return { ...cohortBoundaries[index], members: data };
    });
    initialTrend = trend;
  } catch (error) { console.error("Unable to load retention campaign data", error); }

  return <div className="retention-shell"><SiteNav /><main><RetentionExperience initialCohorts={initialCohorts} initialTrend={initialTrend} staffUserId={user.id} /></main></div>;
}
