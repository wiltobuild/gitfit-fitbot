import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { IconCalendar, IconShield, IconSparkle, MomentumArc } from "@/app/components/icons";
import MomentumRing from "@/app/components/momentum-ring";
import SiteNav from "@/app/components/site-nav";
import { requireUserOrRedirect } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  let bookedThisWeek: number | null = null;
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
            <span className={`badge ${role === "staff" || role === "admin" ? "badge-brand" : "badge-neutral"}`}>
              {role === "admin" ? "Admin" : role === "staff" ? "Staff" : "Member"}
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
            {role === "staff" || role === "admin" ? (
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
      </main>
    </div>
  );
}
