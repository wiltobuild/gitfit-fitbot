import Link from "next/link";

import { SignUpForm } from "./sign-up-form";

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <section className="surface-card auth-card animate-fade-up">
        <Link className="auth-brand" href="/" aria-label="GitFit home">
          <span className="wordmark">GitFit</span>
        </Link>
        <div className="auth-heading">
          <p className="eyebrow">
            <span /> Start with your goals
          </p>
          <h1>Create your account</h1>
          <p>Start building a routine that works for you.</p>
        </div>
        <SignUpForm />
      </section>
    </main>
  );
}
