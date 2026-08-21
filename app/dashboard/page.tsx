import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { AdminDashboard } from "@/app/dashboard/admin-dashboard";
import { StaffDashboard, StaffDashboardNotLinked } from "@/app/dashboard/staff-dashboard";
import { IconCalendar, IconShield, IconSparkle, MomentumArc } from "@/app/components/icons";
import MomentumRing from "@/app/components/momentum-ring";
import SiteNav from "@/app/components/site-nav";
import { requireUserOrRedirect, type UserRole } from "@/lib/auth/session";
import { getClassesForInstructor, getClassesForMonth, getInstructorBookingRateTrend, getUpcomingClasses, type StudioClass } from "@/lib/classes/queries";
import { getMemberForUser } from "@/lib/members/queries";
import { getMemberLifecycleBreakdown, getRetentionCandidates } from "@/lib/members/queries";
import { getMemberPromotions, personalizeOutreachBody } from "@/lib/outreach/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPendingTimeOffCount, listPendingTimeOffRequests, type PendingTimeOffRequest } from "@/lib/time-off/queries";

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPromotionDate(sentAt: string | null) {
  if (!sentAt) return "Recently";
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }).format(date);
}

function previewPromotion(body: string) {
  return body.length > 150 ? `${body.slice(0, 147).trimEnd()}...` : body;
}

export default async function DashboardPage() {
  const { user, role } = await requireUserOrRedirect();
  const dashboardRole: UserRole = role;
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const weekMonday = new Date(today);
  weekMonday.setDate(today.getDate() - mondayOffset);
  weekMonday.setHours(0, 0, 0, 0);
  const weekSunday = new Date(weekMonday);
  weekSunday.setDate(weekMonday.getDate() + 6);

  if (role === "admin") {
    const upcomingEnd = new Date(today);
    upcomingEnd.setDate(today.getDate() + 7);
    let weeklyClasses: StudioClass[] = [];
    let upcomingClasses: StudioClass[] = [];
    let monthClasses: StudioClass[] = [];
    let lifecycleCounts: Record<string, number> = {};
    let tierCounts: Record<string, number> = {};
    let reengagementCount = 0;
    let pendingTimeOffCount = 0;
    let pendingRequests: PendingTimeOffRequest[] = [];

    try {
      const supabase = await createSupabaseServerClient();
      weeklyClasses = await getUpcomingClasses(supabase, { from: formatDate(weekMonday), to: formatDate(weekSunday) });
    } catch (error) { console.error("Unable to load weekly classes for admin dashboard", error); }
    try {
      const supabase = await createSupabaseServerClient();
      upcomingClasses = await getUpcomingClasses(supabase, { from: formatDate(today), to: formatDate(upcomingEnd) });
    } catch (error) { console.error("Unable to load upcoming classes for admin dashboard", error); }
    try {
      const supabase = await createSupabaseServerClient();
      monthClasses = await getClassesForMonth(supabase, today.getFullYear(), today.getMonth() + 1);
    } catch (error) { console.error("Unable to load calendar classes for admin dashboard", error); }
    try {
      const supabase = await createSupabaseServerClient();
      const breakdown = await getMemberLifecycleBreakdown(supabase);
      lifecycleCounts = breakdown.lifecycleCounts;
      tierCounts = breakdown.tierCounts;
    } catch (error) { console.error("Unable to load member breakdown for admin dashboard", error); }
    try {
      const supabase = await createSupabaseServerClient();
      const { candidates, error } = await getRetentionCandidates(supabase);
      if (error) throw error;
      reengagementCount = candidates.length;
    } catch (error) { console.error("Unable to load retention candidates for admin dashboard", error); }
    try {
      const supabase = await createSupabaseServerClient();
      pendingTimeOffCount = await getPendingTimeOffCount(supabase);
    } catch (error) { console.error("Unable to load pending time-off count for admin dashboard", error); }
    try {
      const supabase = await createSupabaseServerClient();
      pendingRequests = await listPendingTimeOffRequests(supabase);
    } catch (error) { console.error("Unable to load pending time-off requests for admin dashboard", error); }

    const totalCapacity = weeklyClasses.reduce((total, classRow) => total + classRow.capacity, 0);
    const totalBooked = weeklyClasses.reduce((total, classRow) => total + classRow.booked_count, 0);
    return <div className="admin-dashboard-shell"><SiteNav /><AdminDashboard
      month={today.getMonth() + 1}
      monthClasses={monthClasses}
      pendingRequests={pendingRequests}
      stats={{ weeklyFillRate: totalCapacity ? Math.round((totalBooked / totalCapacity) * 100) : 0, lifecycleCounts, tierCounts, reengagementCount, pendingTimeOffCount }}
      upcomingClasses={upcomingClasses}
      userEmail={user.email}
      year={today.getFullYear()}
    /></div>;
  }

  if (role === "staff") {
    let instructorMember: Awaited<ReturnType<typeof getMemberForUser>>["data"] = null;
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await getMemberForUser(supabase, user.id);
      if (error) throw error;
      instructorMember = data;
    } catch (error) {
      console.error("Unable to resolve instructor profile for staff dashboard", error);
    }

    if (!instructorMember || !instructorMember.is_instructor) {
      return <div className="staff-dashboard-shell"><SiteNav /><StaffDashboardNotLinked /></div>;
    }

    let classes: StudioClass[] = [];
    let bookingRateTrend = { thisWeekFillPercent: 0, lastWeekFillPercent: 0 };
    try {
      const supabase = await createSupabaseServerClient();
      classes = await getClassesForInstructor(supabase, instructorMember.id);
    } catch (error) {
      console.error("Unable to load instructor classes for staff dashboard", error);
    }
    try {
      const supabase = await createSupabaseServerClient();
      bookingRateTrend = await getInstructorBookingRateTrend(supabase, instructorMember.id);
    } catch (error) {
      console.error("Unable to load instructor booking-rate trend for staff dashboard", error);
    }

    return <div className="staff-dashboard-shell"><SiteNav /><StaffDashboard bookingRateTrend={bookingRateTrend} classes={classes} instructorName={instructorMember.full_name} /></div>;
  }

  let bookedThisWeek: number | null = null;
  let promotions: Array<{ id: string; subject: string; body: string; sent_at: string | null }> | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("id, classes!inner(class_date)")
      .eq("user_id", user.id)
      .gte("classes.class_date", formatDate(weekMonday))
      .lte("classes.class_date", formatDate(weekSunday));

    if (error) throw error;
    bookedThisWeek = data?.length ?? 0;
  } catch (error) {
    console.error("Unable to load this week's bookings for dashboard", error);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: member, error: memberError } = await getMemberForUser(supabase, user.id);
    if (memberError) throw memberError;
    if (member) {
      const { data, error } = await getMemberPromotions(supabase, member.id);
      if (error) throw error;
      promotions = (data ?? []).map((promotion) => ({ ...promotion, body: personalizeOutreachBody(promotion.body, member.full_name) }));
    }
  } catch (error) {
    console.error("Unable to load promotions for dashboard", error);
  }

  return (
    <div className="account-shell">
      <SiteNav />
      <main className="account-content">
        <header className="account-intro animate-fade-up">
          <p className="eyebrow"><span /> Your home base</p>
          <h1>Ready when you are.</h1>
          <p>Pick up your fitness routine, find your next session, or ask FitBot for a little guidance.</p>
        </header>
        <section className="surface-card dashboard-card animate-fade-up" style={{ animationDelay: ".08s" }}>
          <div className="dashboard-card-top">
            <div>
              <h2>Welcome back</h2>
              <p className="dashboard-email">Signed in as {user.email}</p>
            </div>
            <span className={`badge ${dashboardRole === "staff" || dashboardRole === "admin" ? "badge-brand" : "badge-neutral"}`}>
              {dashboardRole === "admin" ? "Admin" : dashboardRole === "staff" ? "Staff" : "Member"}
            </span>
          </div>
          {bookedThisWeek !== null ? (
            <div className="dashboard-momentum">
              <MomentumRing value={bookedThisWeek} target={4} />
              <div>
                {bookedThisWeek === 0 ? (
                  <>
                    <h3>No classes booked this week yet</h3>
                    <p><Link href="/appointments">Book a class</Link> whenever you&apos;re ready.</p>
                  </>
                ) : (
                  <>
                    <h3>Classes booked this week</h3>
                    <p>A gentle nudge: aim for 4.</p>
                  </>
                )}
              </div>
            </div>
          ) : null}
          <div className="quick-actions" aria-label="Quick actions">
            <Link className="quick-action quick-action-fitbot" href="/chat">
              <MomentumArc className="quick-action-arc" />
              <span className="quick-action-content">
                <span className="quick-action-icon"><IconSparkle /></span>
                <span>Chat with FitBot</span>
              </span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
            <Link className="quick-action quick-action-appointments" href="/appointments">
              <span className="quick-action-content">
                <span className="quick-action-icon"><IconCalendar /></span>
                <span>View appointments</span>
              </span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
            {dashboardRole === "staff" || dashboardRole === "admin" ? (
              <Link className="quick-action quick-action-staff" href="/staff">
                <span className="quick-action-content">
                  <span className="quick-action-icon"><IconShield /></span>
                  <span>Open staff zone</span>
                </span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
            ) : null}
          </div>
          <div className="account-sign-out">
            <form action={signOut}>
              <button className="btn btn-outline" type="submit">Sign out</button>
            </form>
          </div>
        </section>
        {promotions ? <section className="surface-card dashboard-card dashboard-promotions animate-fade-up" style={{ animationDelay: ".14s" }}>
          <div className="dashboard-card-top">
            <div>
              <h2>Promotions</h2>
              <p className="dashboard-email">Updates and offers from your GitFit team.</p>
            </div>
          </div>
          {promotions.length ? <div className="promotion-list">{promotions.map((promotion) => <article className="promotion-item" key={promotion.id}>
            <div className="promotion-item-top"><h3>{promotion.subject}</h3><time dateTime={promotion.sent_at ?? undefined}>{formatPromotionDate(promotion.sent_at)}</time></div>
            <p>{previewPromotion(promotion.body)}</p>
          </article>)}</div> : <p className="dashboard-promotions-empty">No promotions right now. Check back soon for updates from the studio.</p>}
        </section> : null}
      </main>
    </div>
  );
}
