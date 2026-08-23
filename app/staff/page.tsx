import { InstructorAvatar } from "@/app/components/instructor-avatar";
import SiteNav from "@/app/components/site-nav";
import { MemberSearch } from "@/app/staff/member-search";
import { StaffFitBotTiles } from "@/app/staff/fitbot-tiles";
import { RequestsInbox, type PendingRequest } from "@/app/staff/requests-inbox";
import { MyRequests, type MyRequest } from "@/app/staff/my-requests";
import { StudioPulse, type PulseStat, type TeachingLoadRow } from "@/app/staff/studio-pulse";
import { AtRiskMembers, type AtRiskMember } from "@/app/staff/at-risk-members";
import { ActivityLog, type ActivityEntry } from "@/app/staff/activity-log";
import { requireRoleOrRedirect } from "@/lib/auth/session";
import { listMembersForStaff } from "@/lib/members/queries";
import { fillLevel } from "@/lib/classes/fill-level";
import { getStudioDayStats } from "@/lib/classes/current-or-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StudioClass = { id: string; name: string; instructor: string; class_date: string; start_time: string; duration_minutes: number; capacity: number; booked_count: number };
type WeekClass = { instructor: string; capacity: number; booked_count: number };

function formatDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatTime(time: string) { const [hours, minutes] = time.split(":").map(Number); return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`; }
export default async function StaffPage() {
  const { user, role } = await requireRoleOrRedirect(["staff", "admin"]);
  const isManager = role === "admin";
  const today = new Date();
  const todayString = formatDate(today);
  const supabase = await createSupabaseServerClient();
  let classes: StudioClass[] = [];

  try {
    const { data, error } = await supabase.from("classes").select("id, name, instructor, class_date, start_time, duration_minutes, capacity, booked_count").eq("class_date", todayString).order("start_time");
    if (error) throw error;
    classes = data ?? [];
  } catch (error) { console.error("Unable to load today's studio classes", error); }

  let pendingRequests: PendingRequest[] = [];
  let myRequests: MyRequest[] = [];
  let pulseStats: PulseStat[] = [];
  let teachingLoad: TeachingLoadRow[] = [];
  let atRiskMembers: AtRiskMember[] = [];
  let atRiskMembersTotal = 0;
  let activityEntries: ActivityEntry[] = [];

  if (isManager) {
    let members: Awaited<ReturnType<typeof listMembersForStaff>>["data"] = [];
    try {
      const { data, error } = await listMembersForStaff(supabase);
      if (error) throw error;
      members = data;
    } catch (error) { console.error("Unable to load members for the studio pulse / at-risk panels", error); }
    // profiles has no email column; members.auth_user_id links to the same
    // auth.users id, so this doubles as a free fallback identity source when
    // full_name is missing, instead of showing an indistinguishable "Team member".
    const emailByAuthUserId = new Map<string, string>();
    for (const member of members) if (member.auth_user_id) emailByAuthUserId.set(member.auth_user_id, member.email);
    const identify = (id: string, profileName: string | null | undefined) => profileName || emailByAuthUserId.get(id) || "Team member";

    try {
      const { data, error } = await supabase.from("time_off_requests").select("id, user_id, requested_date, reason").eq("status", "pending").order("created_at");
      if (error) throw error;
      const rows = data ?? [];
      const userIds = [...new Set(rows.map((row) => row.user_id))];
      const nameByUserId = new Map<string, string>();
      if (userIds.length) {
        const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        if (profilesError) throw profilesError;
        for (const profile of profiles ?? []) nameByUserId.set(profile.id, identify(profile.id, profile.full_name));
      }
      pendingRequests = rows.map((row) => ({ ...row, requester_name: nameByUserId.get(row.user_id) ?? identify(row.user_id, null) }));
    } catch (error) { console.error("Unable to load pending time-off requests", error); }

    const mondayOffset = (today.getDay() + 6) % 7;
    const weekMonday = new Date(today); weekMonday.setDate(today.getDate() - mondayOffset); weekMonday.setHours(0, 0, 0, 0);
    const weekSunday = new Date(weekMonday); weekSunday.setDate(weekMonday.getDate() + 6);

    let weekClasses: WeekClass[] = [];
    try {
      const { data, error } = await supabase.from("classes").select("instructor, capacity, booked_count").gte("class_date", formatDate(weekMonday)).lte("class_date", formatDate(weekSunday));
      if (error) throw error;
      weekClasses = data ?? [];
    } catch (error) { console.error("Unable to load this week's classes for the studio pulse panel", error); }

    const weekCapacity = weekClasses.reduce((total, row) => total + row.capacity, 0);
    const weekBooked = weekClasses.reduce((total, row) => total + row.booked_count, 0);
    const weekBookedPercent = weekCapacity ? Math.round((weekBooked / weekCapacity) * 100) : 0;

    const loadByInstructor = new Map<string, number>();
    for (const row of weekClasses) loadByInstructor.set(row.instructor, (loadByInstructor.get(row.instructor) ?? 0) + 1);
    teachingLoad = [...loadByInstructor.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    const lifecycleCounts = { active: 0, at_risk: 0, lapsed: 0 };
    for (const member of members) {
      if (member.lifecycle_status in lifecycleCounts) lifecycleCounts[member.lifecycle_status as keyof typeof lifecycleCounts] += 1;
    }

    pulseStats = [
      { label: "booked this week", value: `${weekBookedPercent}%`, detail: `${weekBooked}/${weekCapacity} spots`, tone: "brand" },
      { label: "active members", value: String(lifecycleCounts.active), tone: "success" },
      { label: "at-risk members", value: String(lifecycleCounts.at_risk), tone: "warning" },
      { label: "lapsed members", value: String(lifecycleCounts.lapsed), tone: "danger" },
    ];

    const allAtRiskMembers = members.filter((member) => member.lifecycle_status === "at_risk");
    atRiskMembersTotal = allAtRiskMembers.length;
    atRiskMembers = allAtRiskMembers
      .sort((a, b) => (a.last_visit_date ?? "").localeCompare(b.last_visit_date ?? ""))
      .slice(0, 8)
      .map((member) => ({ id: member.id, full_name: member.full_name, email: member.email, last_visit_date: member.last_visit_date ?? null }));

    try {
      const { data, error } = await supabase.from("time_off_requests").select("id, user_id, requested_date, status, reviewed_by, reviewed_at").neq("status", "pending").order("reviewed_at", { ascending: false }).limit(10);
      if (error) throw error;
      const rows = data ?? [];
      const ids = [...new Set([...rows.map((row) => row.user_id), ...rows.map((row) => row.reviewed_by).filter((id): id is string => Boolean(id))])];
      const nameById = new Map<string, string>();
      if (ids.length) {
        const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        if (profilesError) throw profilesError;
        for (const profile of profiles ?? []) nameById.set(profile.id, identify(profile.id, profile.full_name));
      }
      activityEntries = rows.map((row) => ({
        id: row.id,
        requester_name: nameById.get(row.user_id) ?? identify(row.user_id, null),
        reviewer_name: row.reviewed_by ? (nameById.get(row.reviewed_by) ?? identify(row.reviewed_by, null)) : "A manager",
        status: row.status as "approved" | "denied",
        requested_date: row.requested_date,
        reviewed_at: row.reviewed_at,
      }));
    } catch (error) { console.error("Unable to load the activity log", error); }
  } else {
    try {
      const { data, error } = await supabase.from("time_off_requests").select("id, requested_date, reason, status").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      myRequests = (data ?? []) as MyRequest[];
    } catch (error) { console.error("Unable to load your time-off requests", error); }
  }

  const { totalCapacity, totalBooked, bookedPercent, currentClass, nextClass } = getStudioDayStats(classes, today);

  return <div className="staff-console">
    <SiteNav />
    <main>
      <header className="staff-ops-band"><div className="staff-ops-band-inner"><div><p className="eyebrow"><span /> Studio operations</p><h1>{isManager ? "Manager" : "Trainer"} console</h1><p className="staff-ops-email">{user.email}</p><p>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(today)}</p>
        {isManager && (pendingRequests.length > 0 || atRiskMembersTotal > 0) ? <div className="staff-ops-signals">
          {pendingRequests.length > 0 ? <span className="staff-ops-signal"><i className="staff-ops-signal-dot staff-ops-signal-dot-warning" /><b>{pendingRequests.length}</b> {pendingRequests.length === 1 ? "request" : "requests"} waiting</span> : null}
          {atRiskMembersTotal > 0 ? <span className="staff-ops-signal"><i className="staff-ops-signal-dot staff-ops-signal-dot-danger" /><b>{atRiskMembersTotal}</b> at-risk {atRiskMembersTotal === 1 ? "member" : "members"}</span> : null}
        </div> : null}
      </div><div className="staff-capacity-stat">{classes.length ? <><strong>{bookedPercent}%</strong><span>booked today</span><small>{totalBooked}/{totalCapacity} total spots</small></> : <><strong>No classes scheduled today</strong><span>The studio register is clear.</span></>}</div></div></header>
      <div className="staff-console-content">
        {isManager ? <>
          <div className="staff-lower-grid animate-fade-up"><StudioPulse stats={pulseStats} teachingLoad={teachingLoad} /><RequestsInbox initialRequests={pendingRequests} /></div>
          <section className="surface-card staff-today-panel animate-fade-up" style={{ animationDelay: "60ms" }} aria-labelledby="today-studio-title"><div className="staff-panel-heading"><div><p className="eyebrow"><span /> Live register</p><h2 id="today-studio-title">Today at the studio</h2></div><p>{classes.length ? `${classes.length} classes scheduled` : "No schedule to review"}</p></div>
            {classes.length ? <ul className="staff-class-list">{classes.map((classRow) => { const level = fillLevel(classRow.booked_count, classRow.capacity); const isPriority = classRow.id === currentClass?.id || classRow.id === nextClass?.id; const spots = classRow.capacity - classRow.booked_count; const statusText = spots <= 0 ? "Class full" : spots === 1 ? "Only 1 spot left" : `${spots} spots open`; return <li className={`staff-class-row staff-fill-${level}${isPriority ? " staff-class-priority" : ""}`} key={classRow.id}><InstructorAvatar name={classRow.instructor} size={40} /><div className="staff-class-summary"><strong>{classRow.name}</strong><span>{formatTime(classRow.start_time)} · {classRow.instructor}</span></div><div className="staff-fill-unit"><div className="staff-fill-label"><span className="staff-fill-status">{statusText}</span><strong>{classRow.booked_count}/{classRow.capacity}</strong></div><span className="staff-fill-track" aria-label={`${classRow.booked_count} of ${classRow.capacity} spots booked`}><span style={{ width: `${Math.min(100, classRow.capacity ? (classRow.booked_count / classRow.capacity) * 100 : 0)}%` }} /></span></div></li>; })}</ul> : <div className="empty-state"><h3>No classes scheduled today</h3><p>There are no capacity or instructor details to monitor yet.</p></div>}</section>
          <div className="staff-lower-grid animate-fade-up" style={{ animationDelay: "120ms" }}><AtRiskMembers members={atRiskMembers} totalCount={atRiskMembersTotal} /><ActivityLog entries={activityEntries} /></div>
        </> : <div className="animate-fade-up"><MyRequests requests={myRequests} /></div>}
        <div className="staff-lower-grid animate-fade-up" style={{ animationDelay: isManager ? "180ms" : "60ms" }}><MemberSearch /><StaffFitBotTiles role={role as "staff" | "admin"} /></div>
      </div>
    </main>
  </div>;
}
