import Link from "next/link";

import { MomentumArc } from "@/app/components/icons";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <MomentumArc className="auth-momentum-arc" />
      <section className="surface-card auth-card animate-fade-up">
        <Link className="auth-brand" href="/" aria-label="GitFit home">
          <span className="wordmark">GitFit</span>
        </Link>
        <div className="auth-heading">
          <p className="eyebrow">
            <span /> Let&apos;s get you back in
          </p>
          <h1>Reset your password</h1>
          <p>Enter the email on your account and we&apos;ll send you a link to set a new password.</p>
        </div>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
