import Link from "next/link";

import { MomentumArc } from "@/app/components/icons";
import { getDemoAccounts, isDemoMode } from "@/lib/demo/accounts";
import { DemoQuickAccess } from "./demo-quick-access";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const demo = isDemoMode();
  const demoAccounts = demo ? getDemoAccounts() : [];
  const admin = demoAccounts.find((account) => account.role === "admin");

  return (
    <main className="auth-page">
      <MomentumArc className="auth-momentum-arc" />
      <section className="surface-card auth-card animate-fade-up">
        <Link className="auth-brand" href="/" aria-label="GitFit home">
          <img className="brand-icon" src="/gitfit-icon.gif" alt="" />
          <span className="wordmark">GitFit</span>
          <span className="brand-org">Pulse Studio</span>
        </Link>
        <div className="auth-heading">
          <p className="eyebrow">
            <span /> {demo ? "Demo environment" : "Your routine awaits"}
          </p>
          <h1>Welcome back</h1>
          <p>
            {demo
              ? "The Admin login is prefilled below. Use the Dev login for all-access across every page and role, or jump straight into a single role."
              : "Sign in to continue building a routine that works for you."}
          </p>
        </div>
        {error ? (
          <p aria-live="polite" className="field-error" style={{ marginBottom: 16 }}>
            {error}
          </p>
        ) : null}
        <SignInForm
          prefill={admin ? { email: admin.email, password: admin.password } : undefined}
        />
        {demo ? (
          <DemoQuickAccess
            personas={demoAccounts.map(({ role, label, blurb, email }) => ({ role, label, blurb, email }))}
          />
        ) : null}
      </section>
    </main>
  );
}
