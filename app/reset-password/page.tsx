import Link from "next/link";

import { MomentumArc } from "@/app/components/icons";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="auth-page">
      <MomentumArc className="auth-momentum-arc" />
      <section className="surface-card auth-card animate-fade-up">
        <Link className="auth-brand" href="/" aria-label="GitFit home">
          <span className="wordmark">GitFit</span>
        </Link>
        <div className="auth-heading">
          <p className="eyebrow">
            <span /> Almost there
          </p>
          <h1>Set a new password</h1>
        </div>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
