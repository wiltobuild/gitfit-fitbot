import SiteNav from "@/app/components/site-nav";
import { requireRoleOrRedirect } from "@/lib/auth/session";

export default async function StaffPage() {
  const { user } = await requireRoleOrRedirect("staff");

  return (
    <div className="account-shell">
      <SiteNav />
      <main className="account-content">
        <section className="surface-card staff-card animate-fade-up">
          <div className="staff-card-top">
            <div>
              <p className="eyebrow">
                <span /> Access verified
              </p>
              <h1>Staff Zone</h1>
              <p className="staff-email">Signed in as {user.email}</p>
            </div>
            <span className="badge badge-brand">Staff</span>
          </div>
          <div className="empty-state">
            <h3>Verification fixture</h3>
            <p>
              This is a Phase 1 verification fixture for role enforcement. Real
              staff features land in a later phase.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
