import { AdminDashboard } from "@/app/dashboard/admin-dashboard";
import { ClientDashboard } from "@/app/dashboard/client-dashboard";
import { StaffDashboard, StaffDashboardNotLinked } from "@/app/dashboard/staff-dashboard";
import SiteNav from "@/app/components/site-nav";
import { requireUserOrRedirect } from "@/lib/auth/session";
import { getClassesForInstructor, getClassesForMonth, getInstructorBookingRateTrend, getUpcomingClasses, type StudioClass } from "@/lib/classes/queries";
import { getEncouragingMessage } from "@/lib/dashboard/encouraging-messages";
import { getBookingHistoryForUser, getMemberForUser, getMemberLifecycleBreakdown, getMemberStreak, getRetentionCandidates, getUpcomingBookingsForUser, type ClassRow } from "@/lib/members/queries";
import { getMemberPromotions, personalizeOutreachBody } from "@/lib/outreach/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPendingTimeOffCount, listPendingTimeOffRequests, type PendingTimeOffRequest } from "@/lib/time-off/queries";

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function DashboardPage() {
  const { user, role } = await requireUserOrRedirect();
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

  let upcomingBookings: ClassRow[] = [];
  let bookingHistory: ClassRow[] = [];
  let streak = { streakWeeks: 0, currentWeekBooked: false };
  let promotions: Array<{ id: string; subject: string; body: string; sent_at: string | null }> | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    upcomingBookings = await getUpcomingBookingsForUser(supabase, user.id);
  } catch (error) {
    console.error("Unable to load upcoming bookings for dashboard", error);
  }
  try {
    const supabase = await createSupabaseServerClient();
    bookingHistory = await getBookingHistoryForUser(supabase, user.id);
  } catch (error) {
    console.error("Unable to load booking history for dashboard", error);
  }
  try {
    const supabase = await createSupabaseServerClient();
    streak = await getMemberStreak(supabase, user.id);
  } catch (error) {
    console.error("Unable to load member streak for dashboard", error);
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

  const todayString = formatDate(today);
  const hasAnyHistory = bookingHistory.length > 0 || upcomingBookings.length > 0 || streak.streakWeeks > 0 || streak.currentWeekBooked;
  const encouragingMessage = getEncouragingMessage({ ...streak, hasAnyHistory, userId: user.id, today: todayString });
  return <div className="account-shell"><SiteNav /><ClientDashboard
    bookingHistory={bookingHistory}
    currentWeekBooked={streak.currentWeekBooked}
    encouragingMessage={encouragingMessage.message}
    encouragingMessageCategory={encouragingMessage.category}
    promotions={promotions}
    streakWeeks={streak.streakWeeks}
    upcomingBookings={upcomingBookings}
    userEmail={user.email}
  /></div>;
}
