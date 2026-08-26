import { requireRoleOrRedirect } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMemberForUser } from "@/lib/members/queries";

import SiteNav from "@/app/components/site-nav";

import { AppointmentsExperience } from "./appointments-experience";

export default async function AppointmentsPage() {
  // Booking a class is a client-only action -- staff/admin operate the
  // studio, they don't book into it as a member.
  const { user } = await requireRoleOrRedirect("client");
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const weekMonday = new Date(today);
  weekMonday.setDate(today.getDate() - mondayOffset);
  weekMonday.setHours(0, 0, 0, 0);
  const weekSunday = new Date(weekMonday);
  weekSunday.setDate(weekMonday.getDate() + 6);
  const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  let bookedThisWeek = 0;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("bookings").select("id, classes!inner(class_date)").eq("user_id", user.id).gte("classes.class_date", formatDate(weekMonday)).lte("classes.class_date", formatDate(weekSunday));
    if (error) throw error;
    bookedThisWeek = data?.length ?? 0;
  } catch (error) {
    console.error("Unable to load this week's bookings for appointments", error);
  }
  let membershipTier: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: member, error } = await getMemberForUser(supabase, user.id);
    if (error) throw error;
    membershipTier = member?.membership_tier ?? null;
  } catch (error) {
    console.error("Unable to load membership tier for appointments", error);
  }
  return <main className="appointments-shell"><header className="appointments-header"><SiteNav /></header><AppointmentsExperience bookedThisWeek={bookedThisWeek} membershipTier={membershipTier} userEmail={user.email ?? "member@gitfit.com"} /></main>;
}
