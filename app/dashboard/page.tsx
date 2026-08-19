import Link from "next/link";

import { signOut } from "@/app/actions/auth";
import SiteNav from "@/app/components/site-nav";
import { requireUserOrRedirect } from "@/lib/auth/session";

export default async function DashboardPage() {
  const { user, role } = await requireUserOrRedirect();

  return (
    <div className="account-shell">
      <SiteNav />
      <main className="account-content">
        <header className="account-intro animate-fade-up">
          <p className="eyebrow">
            <span /> Your home base
          </p>
          <h1>Ready when you are.</h1>
          <p>
            Pick up your fitness routine, find your next session, or ask FitBot
            for a little guidance.
          </p>
        </header>
        <section
          className="surface-card dashboard-card animate-fade-up"
          style={{ animationDelay: ".08s" }}
        >
          <div className="dashboard-card-top">
            <div>
              <h2>Welcome back</h2>
              <p className="dashboard-email">Signed in as {user.email}</p>
            </div>
            <span
              className={`badge ${role === "staff" ? "badge-brand" : "badge-neutral"}`}
            >
              {role === "staff" ? "Staff" : "Member"}
            </span>
          </div>
          <div className="quick-actions" aria-label="Quick actions">
            <Link className="quick-action" href="/chat">
              Chat with FitBot <span aria-hidden="true">→</span>
            </Link>
            <Link className="quick-action" href="/appointments">
              View appointments <span aria-hidden="true">→</span>
            </Link>
            {role === "staff" ? (
              <Link className="quick-action" href="/staff">
                Open staff zone <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>
          <div className="account-sign-out">
            <form action={signOut}>
              <button className="btn btn-outline" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
