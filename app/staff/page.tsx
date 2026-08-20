import { InstructorAvatar } from "@/app/components/instructor-avatar";
import SiteNav from "@/app/components/site-nav";
import { MemberSearch } from "@/app/staff/member-search";
import { StaffFitBotTiles } from "@/app/staff/fitbot-tiles";
import { requireRoleOrRedirect } from "@/lib/auth/session";
import { fillLevel } from "@/lib/classes/fill-level";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StudioClass = { id: string; name: string; instructor: string; class_date: string; start_time: string; duration_minutes: number; capacity: number; booked_count: number };

function formatDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatTime(time: string) { const [hours, minutes] = time.split(":").map(Number); return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`; }
function isCurrentOrNext(classRow: StudioClass, now: Date) {
  const [hours, minutes] = classRow.start_time.split(":").map(Number);
  const startsAt = new Date(now); startsAt.setHours(hours, minutes, 0, 0);
  const endsAt = new Date(startsAt.getTime() + classRow.duration_minutes * 60_000);
  return now >= startsAt && now < endsAt;
}

export default async function StaffPage() {
  const { user, role } = await requireRoleOrRedirect(["staff", "admin"]);
  const today = new Date();
  const todayString = formatDate(today);
  let classes: StudioClass[] = [];

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("classes").select("id, name, instructor, class_date, start_time, duration_minutes, capacity, booked_count").eq("class_date", todayString).order("start_time");
    if (error) throw error;
    classes = data ?? [];
  } catch (error) { console.error("Unable to load today's studio classes", error); }

  const totalCapacity = classes.reduce((total, classRow) => total + classRow.capacity, 0);
  const totalBooked = classes.reduce((total, classRow) => total + classRow.booked_count, 0);
  const bookedPercent = totalCapacity ? Math.round((totalBooked / totalCapacity) * 100) : 0;
  const currentClass = classes.find((classRow) => isCurrentOrNext(classRow, today));
  const nextClass = currentClass ? undefined : classes.find((classRow) => {
    const [hours, minutes] = classRow.start_time.split(":").map(Number);
    return hours * 60 + minutes >= today.getHours() * 60 + today.getMinutes();
  });

  return <div className="staff-console">
    <SiteNav />
    <main>
      <header className="staff-ops-band"><div className="staff-ops-band-inner"><div><p className="eyebrow"><span /> Studio operations</p><h1>{role === "admin" ? "Admin" : "Staff"} — {user.email}</h1><p>{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(today)}</p></div><div className="staff-capacity-stat">{classes.length ? <><strong>{bookedPercent}%</strong><span>booked today</span><small>{totalBooked}/{totalCapacity} total spots</small></> : <><strong>No classes scheduled today</strong><span>The studio register is clear.</span></>}</div></div></header>
      <div className="staff-console-content">
        <section className="surface-card staff-today-panel" aria-labelledby="today-studio-title"><div className="staff-panel-heading"><div><p className="eyebrow"><span /> Live register</p><h2 id="today-studio-title">Today at the studio</h2></div><p>{classes.length ? `${classes.length} classes scheduled` : "No schedule to review"}</p></div>
          {classes.length ? <ul className="staff-class-list">{classes.map((classRow) => { const level = fillLevel(classRow.booked_count, classRow.capacity); const isPriority = classRow.id === currentClass?.id || classRow.id === nextClass?.id; return <li className={`staff-class-row staff-fill-${level}${isPriority ? " staff-class-priority" : ""}`} key={classRow.id}><InstructorAvatar name={classRow.instructor} size={40} /><div className="staff-class-summary"><strong>{classRow.name}</strong><span>{formatTime(classRow.start_time)} · {classRow.instructor}</span></div><div className="staff-fill-unit"><div className="staff-fill-label"><span className={`badge ${level === "full" ? "badge-danger" : level === "filling" ? "badge-warning" : "badge-success"}`}>{level === "full" ? "Full" : level === "filling" ? "Filling" : "Healthy"}</span><strong>{classRow.booked_count}/{classRow.capacity}</strong></div><span className="staff-fill-track" aria-label={`${classRow.booked_count} of ${classRow.capacity} spots booked`}><span style={{ width: `${Math.min(100, classRow.capacity ? (classRow.booked_count / classRow.capacity) * 100 : 0)}%` }} /></span></div></li>; })}</ul> : <div className="empty-state"><h3>No classes scheduled today</h3><p>There are no capacity or instructor details to monitor yet.</p></div>}</section>
        <div className="staff-lower-grid"><MemberSearch /><StaffFitBotTiles role={role as "staff" | "admin"} /></div>
      </div>
    </main>
  </div>;
}
