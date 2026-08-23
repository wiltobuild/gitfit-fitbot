import { InstructorAvatar } from "@/app/components/instructor-avatar";
import SiteNav from "@/app/components/site-nav";
import { MemberSearch } from "@/app/staff/member-search";
import { StaffFitBotTiles } from "@/app/staff/fitbot-tiles";
import { RequestsInbox, type PendingRequest } from "@/app/staff/requests-inbox";
import { MyRequests, type MyRequest } from "@/app/staff/my-requests";
import { RequestTimeOff } from "@/app/staff/request-time-off";
import { RealtimeRefresh } from "@/app/components/realtime-refresh";
import { StudioPulse, type PulseStat, type TeachingLoadRow } from "@/app/staff/studio-pulse";
import { AtRiskMembers, type AtRiskMember } from "@/app/staff/at-risk-members";
import { ActivityLog, type ActivityEntry } from "@/app/staff/activity-log";
import { TrainerProfile } from "@/app/staff/trainer-profile";
import { MySchedule, type ScheduleClass } from "@/app/staff/my-schedule";
import { ClassChangeStatus, type MyClassChangeRequest } from "@/app/staff/class-change-status";
import { MyMembersRetention } from "@/app/staff/my-members-retention";
import { ClassChangeInbox, type PendingClassChangeRequest } from "@/app/staff/class-change-inbox";
import { InstructorLeaderboard, type LeaderboardRow } from "@/app/staff/instructor-leaderboard";
import { requireRoleOrRedirect } from "@/lib/auth/session";
import { getMemberForUser, getMemberRetentionForInstructor, listMembersForStaff } from "@/lib/members/queries";
import { getClassesForInstructorInRange, getInstructorLeaderboard } from "@/lib/classes/queries";
import { getClassRoster } from "@/lib/classes/roster";
import { listOwnClassChangeRequests, listPendingClassChangeRequests } from "@/lib/class-changes/queries";
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
  let pendingClassChangeRequests: PendingClassChangeRequest[] = [];
  let instructorLeaderboard: LeaderboardRow[] = [];
  let trainerCertTier: string | null = null;
  let scheduleClasses: ScheduleClass[] = [];
  let myClassChangeRequests: MyClassChangeRequest[] = [];
  let pendingRequestTypeByClassId: Record<string, "swap" | "cancel"> = {};
  let retentionMembers: Awaited<ReturnType<typeof getMemberRetentionForInstructor>>["members"] = [];
  let retentionCounts: Record<string, number> = {};
  let classLabelById: Record<string, string> = {};
  let isLinkedInstructor = false;
  let trainerName = "Trainer";

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

    const displayDate = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
    try {
      const requests = await listPendingClassChangeRequests(supabase);
      const classIds = [...new Set(requests.map((request) => request.class_id))];
      const userIds = [...new Set(requests.map((request) => request.user_id))];
      const [{ data: classesForLabels }, { data: profilesForNames, error: profilesError }] = await Promise.all([
        classIds.length
          ? supabase.from("classes").select("id, name, class_date, start_time").in("id", classIds)
          : Promise.resolve({ data: [] as { id: string; name: string; class_date: string; start_time: string }[] }),
        userIds.length
          ? supabase.from("profiles").select("id, full_name").in("id", userIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null })
      ]);
      if (profilesError) throw profilesError;
      const labelByClassId = new Map((classesForLabels ?? []).map((classRow) => [classRow.id, `${classRow.name} — ${displayDate(classRow.class_date)}, ${formatTime(classRow.start_time)}`]));
      const nameByRequesterId = new Map((profilesForNames ?? []).map((profile) => [profile.id, identify(profile.id, profile.full_name)]));
      pendingClassChangeRequests = requests.map((request) => ({
        id: request.id,
        requester_name: nameByRequesterId.get(request.user_id) ?? identify(request.user_id, null),
        class_label: labelByClassId.get(request.class_id) ?? "Class no longer scheduled",
        type: request.type,
        reason: request.reason,
      }));
    } catch (error) { console.error("Unable to load pending class-change requests", error); }

    const mondayOffset = (today.getDay() + 6) % 7;
    const weekMonday = new Date(today); weekMonday.setDate(today.getDate() - mondayOffset); weekMonday.setHours(0, 0, 0, 0);
    const weekSunday = new Date(weekMonday); weekSunday.setDate(weekMonday.getDate() + 6);

    let weekClasses: WeekClass[] = [];
    try {
      const { data, error } = await supabase.from("classes").select("instructor, capacity, booked_count").gte("class_date", formatDate(weekMonday)).lte("class_date", formatDate(weekSunday));
      if (error) throw error;
      weekClasses = data ?? [];
    } catch (error) { console.error("Unable to load this week's classes for the studio pulse panel", error); }

    try {
      instructorLeaderboard = await getInstructorLeaderboard(supabase, { from: formatDate(weekMonday), to: formatDate(weekSunday) });
    } catch (error) { console.error("Unable to load the instructor leaderboard", error); }

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

    let instructorMember: Awaited<ReturnType<typeof getMemberForUser>>["data"] = null;
    try {
      const { data, error } = await getMemberForUser(supabase, user.id);
      if (error) throw error;
      instructorMember = data;
    } catch (error) { console.error("Unable to resolve instructor profile for the trainer console", error); }

    if (instructorMember?.is_instructor) {
      isLinkedInstructor = true;
      trainerName = instructorMember.full_name || "Trainer";
      trainerCertTier = instructorMember.cert_tier ?? null;
      const scheduleEnd = new Date(today); scheduleEnd.setDate(today.getDate() + 13);

      try {
        const upcoming = await getClassesForInstructorInRange(supabase, instructorMember.id, { from: todayString, to: formatDate(scheduleEnd) });
        const rosters = await Promise.all(upcoming.map((classRow) => getClassRoster(supabase, classRow.id).catch(() => [])));
        scheduleClasses = upcoming.map((classRow, index) => ({ ...classRow, attendees: rosters[index] }));
        for (const classRow of scheduleClasses) classLabelById[classRow.id] = `${classRow.name} — ${formatTime(classRow.start_time)}`;
      } catch (error) { console.error("Unable to load the trainer's schedule", error); }

      try {
        const retention = await getMemberRetentionForInstructor(supabase, instructorMember.id);
        retentionMembers = retention.members;
        retentionCounts = retention.lifecycleCounts;
      } catch (error) { console.error("Unable to load member retention for this instructor", error); }

      try {
        const requests = await listOwnClassChangeRequests(supabase, user.id);
        myClassChangeRequests = requests.map((request) => ({ id: request.id, class_id: request.class_id, type: request.type, status: request.status, created_at: request.created_at }));
        for (const request of requests) if (request.status === "pending") pendingRequestTypeByClassId[request.class_id] = request.type;

        const missingIds = [...new Set(requests.map((request) => request.class_id))].filter((id) => !classLabelById[id]);
        if (missingIds.length) {
          const { data: pastClasses } = await supabase.from("classes").select("id, name, start_time").in("id", missingIds);
          for (const classRow of pastClasses ?? []) classLabelById[classRow.id] = `${classRow.name} — ${formatTime(classRow.start_time)}`;
        }
      } catch (error) { console.error("Unable to load this trainer's class-change requests", error); }
    }
  }

  const { totalCapacity, totalBooked, bookedPercent, currentClass, nextClass } = getStudioDayStats(classes, today);

  return <div className="staff-console">
    <SiteNav />
    <main>
      <header className="staff-ops-band"><div className="staff-ops-band-inner"><div><p className="eyebrow"><span /> Studio operations</p><h1>{isManager ? "Manager" : "Trainer"} console</h1><p className="staff-ops-email">{user.email}</p><p>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(today)}</p>
        {isManager && (pendingRequests.length > 0 || pendingClassChangeRequests.length > 0 || atRiskMembersTotal > 0) ? <div className="staff-ops-signals">
          {pendingRequests.length > 0 ? <span className="staff-ops-signal"><i className="staff-ops-signal-dot staff-ops-signal-dot-warning" /><b>{pendingRequests.length}</b> time-off {pendingRequests.length === 1 ? "request" : "requests"} waiting</span> : null}
          {pendingClassChangeRequests.length > 0 ? <span className="staff-ops-signal"><i className="staff-ops-signal-dot staff-ops-signal-dot-warning" /><b>{pendingClassChangeRequests.length}</b> swap/cancel {pendingClassChangeRequests.length === 1 ? "request" : "requests"} waiting</span> : null}
          {atRiskMembersTotal > 0 ? <span className="staff-ops-signal"><i className="staff-ops-signal-dot staff-ops-signal-dot-danger" /><b>{atRiskMembersTotal}</b> at-risk {atRiskMembersTotal === 1 ? "member" : "members"}</span> : null}
        </div> : null}
      </div><div className="staff-capacity-stat">{classes.length ? <><strong>{bookedPercent}%</strong><span>booked today</span><small>{totalBooked}/{totalCapacity} total spots</small></> : <><strong>No classes scheduled today</strong><span>The studio register is clear.</span></>}</div></div></header>
      <div className="staff-console-content">
        {isManager ? <>
          <RealtimeRefresh table="time_off_requests" />
          <RealtimeRefresh table="class_change_requests" />
          <div className="staff-lower-grid animate-fade-up"><RequestsInbox initialRequests={pendingRequests} /><ClassChangeInbox initialRequests={pendingClassChangeRequests} /></div>
          <section className="surface-card staff-today-panel animate-fade-up" style={{ animationDelay: "60ms" }} aria-labelledby="today-studio-title"><div className="staff-panel-heading"><div><p className="eyebrow"><span /> Live register</p><h2 id="today-studio-title">Today at the studio</h2></div><p>{classes.length ? `${classes.length} classes scheduled` : "No schedule to review"}</p></div>
            {classes.length ? <ul className="staff-class-list">{classes.map((classRow) => { const level = fillLevel(classRow.booked_count, classRow.capacity); const isPriority = classRow.id === currentClass?.id || classRow.id === nextClass?.id; const spots = classRow.capacity - classRow.booked_count; const statusText = spots <= 0 ? "Class full" : spots === 1 ? "Only 1 spot left" : `${spots} spots open`; return <li className={`staff-class-row staff-fill-${level}${isPriority ? " staff-class-priority" : ""}`} key={classRow.id}><InstructorAvatar name={classRow.instructor} size={40} /><div className="staff-class-summary"><strong>{classRow.name}</strong><span>{formatTime(classRow.start_time)} · {classRow.instructor}</span></div><div className="staff-fill-unit"><div className="staff-fill-label"><span className="staff-fill-status">{statusText}</span><strong>{classRow.booked_count}/{classRow.capacity}</strong></div><span className="staff-fill-track" aria-label={`${classRow.booked_count} of ${classRow.capacity} spots booked`}><span style={{ width: `${Math.min(100, classRow.capacity ? (classRow.booked_count / classRow.capacity) * 100 : 0)}%` }} /></span></div></li>; })}</ul> : <div className="empty-state"><h3>No classes scheduled today</h3><p>There are no capacity or instructor details to monitor yet.</p></div>}</section>
          <div className="staff-lower-grid animate-fade-up" style={{ animationDelay: "120ms" }}><AtRiskMembers members={atRiskMembers} totalCount={atRiskMembersTotal} /><ActivityLog entries={activityEntries} /></div>
          <div className="staff-lower-grid animate-fade-up" style={{ animationDelay: "180ms" }}><StudioPulse stats={pulseStats} teachingLoad={teachingLoad} /><InstructorLeaderboard rows={instructorLeaderboard} /></div>
        </> : <div className="animate-fade-up">
          <RealtimeRefresh table="time_off_requests" filter={`user_id=eq.${user.id}`} />
          {isLinkedInstructor ? <div className="staff-trainer-console">
            <RealtimeRefresh table="class_change_requests" filter={`user_id=eq.${user.id}`} />
            <TrainerProfile name={trainerName} email={user.email ?? ""} certTier={trainerCertTier} />
            <div className="staff-lower-grid">
              <MySchedule classes={scheduleClasses} pendingRequestTypeByClassId={pendingRequestTypeByClassId} />
              <div className="staff-trainer-side-stack">
                <MyMembersRetention members={retentionMembers} lifecycleCounts={retentionCounts} />
                <ClassChangeStatus requests={myClassChangeRequests} classLabelById={classLabelById} />
              </div>
            </div>
            <div className="staff-lower-grid"><RequestTimeOff /><MyRequests requests={myRequests} /></div>
          </div> : <div className="staff-lower-grid"><RequestTimeOff /><MyRequests requests={myRequests} /></div>}
        </div>}
        <div className="staff-lower-grid animate-fade-up" style={{ animationDelay: isManager ? "240ms" : "60ms" }}><MemberSearch /><StaffFitBotTiles role={role as "staff" | "admin"} /></div>
      </div>
    </main>
  </div>;
}
