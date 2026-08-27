"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  void error;

  return (
    <main className="auth-page">
      <section className="surface-card auth-card animate-fade-up">
        <div className="auth-heading">
          <p className="eyebrow"><span /> A quick reset</p>
          <h1>Something went off track.</h1>
          <p>We&apos;re sorry — GitFit couldn&apos;t load that page. Please try again.</p>
        </div>
        <button className="btn btn-primary" onClick={reset} type="button">Try again</button>
      </section>
    </main>
  );
}
