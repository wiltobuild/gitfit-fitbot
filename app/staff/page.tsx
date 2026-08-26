import SiteNav from "@/app/components/site-nav";
import { MemberSearch } from "@/app/staff/member-search";
import { StaffFitBotTiles } from "@/app/staff/fitbot-tiles";
import { RequestsInbox, type PendingRequest } from "@/app/staff/requests-inbox";
import { MyRequests, type MyRequest } from "@/app/staff/my-requests";
import { RequestTimeOff } from "@/app/staff/request-time-off";
import { RealtimeRefresh } from "@/app/components/realtime-refresh";
import { StudioPulse, type PulseStat, type TeachingLoadRow } from "@/app/staff/studio-pulse";
import { AtRiskMembers, type AtRiskMember } from "@/app/staff/at-risk-members";
import { ActivityLog, type ActivityEntry, type CancellationEntry } from "@/app/staff/activity-log";
import { TrainerProfile } from "@/app/staff/trainer-profile";
import { MySchedule, type ScheduleClass } from "@/app/staff/my-schedule";
import { ClassChangeStatus, type MyClassChangeRequest } from "@/app/staff/class-change-status";
import { MyMembersRetention } from "@/app/staff/my-members-retention";
import { ClassChangeInbox, type PendingClassChangeRequest } from "@/app/staff/class-change-inbox";
import { InstructorLeaderboard, type LeaderboardRow } from "@/app/staff/instructor-leaderboard";
import { LiveRegister, type InstructorOption, type RegisterClass } from "@/app/staff/live-register";
import { ProposeClass } from "@/app/staff/propose-class";
import { ClassCreationStatus, type MyClassCreationRequest } from "@/app/staff/class-creation-status";
import { ClassCreationInbox, type PendingClassCreationRequest } from "@/app/staff/class-creation-inbox";
import { requireRoleOrRedirect } from "@/lib/auth/session";
import { getMemberForUser, getMemberRetentionForInstructor, listInstructors, listMembersForStaff } from "@/lib/members/queries";
import { getClassesForInstructorInRange, getInstructorLeaderboard } from "@/lib/classes/queries";
import { listOwnClassChangeRequests, listPendingClassChangeRequests } from "@/lib/class-changes/queries";
import { listOwnClassCreationRequests, listPendingClassCreationRequests } from "@/lib/class-creation-requests/queries";
import { listLatestPromoEvents } from "@/lib/promo-events/queries";
import { getStudioDayStats } from "@/lib/classes/current-or-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StudioClass = RegisterClass;
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
    const { data, error } = await supabase.from("classes").select("id, name, type, instructor, instructor_member_id, class_date, start_time, duration_minutes, capacity, booked_count, promoted").eq("class_date", todayString).order("start_time");
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
  let cancellationEntries: CancellationEntry[] = [];
  let pendingClassChangeRequests: PendingClassChangeRequest[] = [];
  let pendingClassCreationRequests: PendingClassCreationRequest[] = [];
  let instructorLeaderboard: LeaderboardRow[] = [];
  let trainerCertTier: string | null = null;
  let scheduleClasses: ScheduleClass[] = [];
  let myClassChangeRequests: MyClassChangeRequest[] = [];
  let myClassCreationRequests: MyClassCreationRequest[] = [];
  let pendingRequestTypeByClassId: Record<string, "edit" | "cancel"> = {};
  let retentionMembers: Awaited<ReturnType<typeof getMemberRetentionForInstructor>>["members"] = [];
  let retentionCounts: Record<string, number> = {};
  let classLabelById: Record<string, string> = {};
  let isLinkedInstructor = false;
  let trainerName = "Trainer";
  let trainerMemberId: string | null = null;
  let instructors: InstructorOption[] = [];
  let promoLabelByClassId: Record<string, string> = {};

  if (isManager) {
    try {
      instructors = await listInstructors(supabase);
    } catch (error) { console.error("Unable to load instructors for class management", error); }

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
      const events = await listLatestPromoEvents(supabase, classes.map((classRow) => classRow.id));
      const promoterIds = [...new Set(events.map((event) => event.promotedBy))];
      const nameByPromoterId = new Map<string, string>();
      if (promoterIds.length) {
        const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, full_name").in("id", promoterIds);
        if (profilesError) throw profilesError;
        for (const profile of profiles ?? []) nameByPromoterId.set(profile.id, identify(profile.id, profile.full_name));
      }
      const displayDateForPromo = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
      promoLabelByClassId = Object.fromEntries(events.map((event) => [event.classId, `Promoted by ${nameByPromoterId.get(event.promotedBy) ?? identify(event.promotedBy, null)} · ${displayDateForPromo(event.createdAt)}`]));
    } catch (error) { console.error("Unable to load promotion history", error); }

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
        proposed_summary: request.type === "edit" && request.proposed_name
          ? `${request.proposed_name} (${request.proposed_type}) — ${displayDate(request.proposed_class_date!)}, ${formatTime(request.proposed_start_time!)} · cap ${request.proposed_capacity}`
          : null,
        reason: request.reason,
      }));
    } catch (error) { console.error("Unable to load pending class-change requests", error); }

    try {
      const requests = await listPendingClassCreationRequests(supabase);
      const userIds = [...new Set(requests.map((request) => request.user_id))];
      const { data: profilesForNames, error: profilesError } = userIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
        : { data: [] as { id: string; full_name: string | null }[], error: null };
      if (profilesError) throw profilesError;
      const nameByRequesterId = new Map((profilesForNames ?? []).map((profile) => [profile.id, identify(profile.id, profile.full_name)]));
      pendingClassCreationRequests = requests.map((request) => ({
        id: request.id,
        requester_name: nameByRequesterId.get(request.user_id) ?? identify(request.user_id, null),
        name: request.name,
        type: request.type,
        class_label: `${displayDate(request.class_date)}, ${formatTime(request.start_time)}`,
        capacity: request.capacity,
        reason: request.reason,
      }));
    } catch (error) { console.error("Unable to load pending class-creation requests", error); }

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

    try {
      const { data, error } = await supabase.from("class_cancellations").select("id, class_id, class_name, class_date, start_time, canceled_by, booked_count, roster, created_at").order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      const rows = data ?? [];
      const cancelerIds = [...new Set(rows.map((row) => row.canceled_by))];
      const nameByCancelerId = new Map<string, string>();
      if (cancelerIds.length) {
        const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, full_name").in("id", cancelerIds);
        if (profilesError) throw profilesError;
        for (const profile of profiles ?? []) nameByCancelerId.set(profile.id, identify(profile.id, profile.full_name));
      }
      cancellationEntries = rows.map((row) => ({
        id: row.id,
        class_label: `${row.class_name} — ${displayDate(row.class_date)}, ${formatTime(row.start_time)}`,
        canceler_name: nameByCancelerId.get(row.canceled_by) ?? identify(row.canceled_by, null),
        booked_count: row.booked_count,
        created_at: row.created_at,
      }));
    } catch (error) { console.error("Unable to load canceled class history", error); }
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
      trainerMemberId = instructorMember.id;
      const scheduleEnd = new Date(today); scheduleEnd.setDate(today.getDate() + 13);

      try {
        // Rosters are fetched on demand (see MySchedule) when a trainer
        // actually expands a class, not pre-fetched here for all ~20-30
        // classes in the window on every page load.
        scheduleClasses = await getClassesForInstructorInRange(supabase, instructorMember.id, { from: todayString, to: formatDate(scheduleEnd) });
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

      try {
        const requests = await listOwnClassCreationRequests(supabase, user.id);
        myClassCreationRequests = requests.map((request) => ({ id: request.id, name: request.name, type: request.type, class_date: request.class_date, start_time: request.start_time, status: request.status }));
      } catch (error) { console.error("Unable to load this trainer's class-creation requests", error); }
    }
  }

  const { totalCapacity, totalBooked, bookedPercent, currentClass, nextClass } = getStudioDayStats(classes, today);

  return <div className="staff-console">
    <SiteNav />
    <main>
      <header className="staff-ops-band"><div className="staff-ops-band-inner"><div><p className="eyebrow"><span /> Studio operations</p><h1>{isManager ? "Manager" : "Trainer"} console</h1><p className="staff-ops-email">{user.email}</p><p>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(today)}</p>
        {isManager && (pendingRequests.length > 0 || pendingClassChangeRequests.length > 0 || pendingClassCreationRequests.length > 0 || atRiskMembersTotal > 0) ? <div className="staff-ops-signals">
          {pendingRequests.length > 0 ? <span className="staff-ops-signal"><i className="staff-ops-signal-dot staff-ops-signal-dot-warning" /><b>{pendingRequests.length}</b> time-off {pendingRequests.length === 1 ? "request" : "requests"} waiting</span> : null}
          {pendingClassChangeRequests.length > 0 ? <span className="staff-ops-signal"><i className="staff-ops-signal-dot staff-ops-signal-dot-warning" /><b>{pendingClassChangeRequests.length}</b> edit/cancel {pendingClassChangeRequests.length === 1 ? "request" : "requests"} waiting</span> : null}
          {pendingClassCreationRequests.length > 0 ? <span className="staff-ops-signal"><i className="staff-ops-signal-dot staff-ops-signal-dot-warning" /><b>{pendingClassCreationRequests.length}</b> class {pendingClassCreationRequests.length === 1 ? "proposal" : "proposals"} waiting</span> : null}
          {atRiskMembersTotal > 0 ? <span className="staff-ops-signal"><i className="staff-ops-signal-dot staff-ops-signal-dot-danger" /><b>{atRiskMembersTotal}</b> at-risk {atRiskMembersTotal === 1 ? "member" : "members"}</span> : null}
        </div> : null}
      </div><div className="staff-capacity-stat">{classes.length ? <><strong>{bookedPercent}%</strong><span>booked today</span><small>{totalBooked}/{totalCapacity} total spots</small></> : <><strong>No classes scheduled today</strong><span>The studio register is clear.</span></>}</div></div></header>
      <div className="staff-console-content">
        {isManager ? <>
          <RealtimeRefresh table="time_off_requests" />
          <RealtimeRefresh table="class_change_requests" />
          <RealtimeRefresh table="class_creation_requests" />
          <RealtimeRefresh table="classes" />
          <div className="staff-lower-grid animate-fade-up"><RequestsInbox initialRequests={pendingRequests} /><ClassChangeInbox initialRequests={pendingClassChangeRequests} /></div>
          <div style={{ marginTop: "20px" }}><ClassCreationInbox initialRequests={pendingClassCreationRequests} /></div>
          <LiveRegister classes={classes} instructors={instructors} currentClassId={currentClass?.id ?? null} nextClassId={nextClass?.id ?? null} today={todayString} promoLabelByClassId={promoLabelByClassId} />
          <div className="staff-lower-grid animate-fade-up" style={{ animationDelay: "120ms" }}><AtRiskMembers members={atRiskMembers} totalCount={atRiskMembersTotal} /><ActivityLog entries={activityEntries} cancellations={cancellationEntries} /></div>
          <div className="staff-lower-grid animate-fade-up" style={{ animationDelay: "180ms" }}><StudioPulse stats={pulseStats} teachingLoad={teachingLoad} /><InstructorLeaderboard rows={instructorLeaderboard} /></div>
          <div className="staff-lower-grid animate-fade-up" style={{ animationDelay: "240ms" }}><MemberSearch /><StaffFitBotTiles role={role as "staff" | "admin"} /></div>
        </> : <div className="animate-fade-up">
          <RealtimeRefresh table="time_off_requests" filter={`user_id=eq.${user.id}`} />
          {isLinkedInstructor ? <div className="staff-trainer-console">
            <RealtimeRefresh table="class_change_requests" filter={`user_id=eq.${user.id}`} />
            <RealtimeRefresh table="class_creation_requests" filter={`user_id=eq.${user.id}`} />
            <RealtimeRefresh table="classes" filter={`instructor_member_id=eq.${trainerMemberId}`} />
            <TrainerProfile name={trainerName} email={user.email ?? ""} certTier={trainerCertTier} />
            <div className="staff-lower-grid">
              <div className="staff-trainer-side-stack">
                <MySchedule classes={scheduleClasses} pendingRequestTypeByClassId={pendingRequestTypeByClassId} today={todayString} />
                <ProposeClass today={todayString} />
                <RequestTimeOff />
                <MyRequests requests={myRequests} />
                <MemberSearch />
              </div>
              <div className="staff-trainer-side-stack">
                <MyMembersRetention members={retentionMembers} lifecycleCounts={retentionCounts} />
                <ClassChangeStatus requests={myClassChangeRequests} classLabelById={classLabelById} />
                <ClassCreationStatus requests={myClassCreationRequests} />
                <StaffFitBotTiles role={role as "staff" | "admin"} />
              </div>
            </div>
          </div> : <div className="staff-lower-grid">
            <div className="staff-trainer-side-stack">
              <RequestTimeOff />
              <MyRequests requests={myRequests} />
              <MemberSearch />
            </div>
            <StaffFitBotTiles role={role as "staff" | "admin"} />
          </div>}
        </div>}
      </div>
    </main>
  </div>;
}
