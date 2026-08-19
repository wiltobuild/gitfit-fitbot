import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import { IconCalendar, IconShield, IconSparkle, MomentumArc } from "@/app/components/icons";
import SiteNav from "@/app/components/site-nav";
import { requireUserOrRedirect } from "@/lib/auth/session";

export default async function DashboardPage() {
  const { user, role } = await requireUserOrRedirect();

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
            <span className={`badge ${role === "staff" ? "badge-brand" : "badge-neutral"}`}>
              {role === "staff" ? "Staff" : "Member"}
            </span>
          </div>
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
            {role === "staff" ? (
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
