import Link from "next/link";

import { MomentumArc } from "@/app/components/icons";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <MomentumArc className="auth-momentum-arc" />
      <section className="surface-card auth-card animate-fade-up">
        <Link className="auth-brand" href="/" aria-label="GitFit home">
          <span className="wordmark">GitFit</span>
        </Link>
        <div className="auth-heading">
          <p className="eyebrow">
            <span /> Your routine awaits
          </p>
          <h1>Welcome back</h1>
          <p>Sign in to continue building a routine that works for you.</p>
        </div>
        <SignInForm />
      </section>
    </main>
  );
}
