import Link from "next/link";
import { redirect } from "next/navigation";

import { MomentumArc } from "@/app/components/icons";
import SiteNav from "@/app/components/site-nav";
import { getSession } from "@/lib/auth/session";

const quickStarts = ["Build a better routine", "Find my next workout", "Keep the momentum"];

export default async function Home() {
  const session = await getSession();
  // The dashboard is every signed-in user's real starting point (role-branched
  // there: client/staff/admin each land on their own view) -- this page's job
  // is only to be the logged-out marketing page, not a second landing screen
  // wedged in between sign-in and the dashboard.
  if (session) redirect("/dashboard");

  return (
    <main className="landing-shell">
      <SiteNav />

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Your team is ready</p>
          <h1>Make your next move your strongest one.</h1>
          <p className="hero-description">Fitbot turns &ldquo;I should probably&rdquo; into a real plan. Tell it what you need, and it will help your fitness team get you moving.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/chat">Talk to Fitbot <span aria-hidden="true">&rarr;</span></Link>
            <a className="btn btn-outline-on-dark" href="#how-it-works">How it works</a>
          </div>
        </div>

        <div className="hero-momentum" aria-label="Fitness planning momentum">
          <MomentumArc />
          <span>Move forward</span>
        </div>
      </section>

      <section className="starter-section" id="how-it-works">
        <div>
          <p className="eyebrow"><span /> Start where you are</p>
          <h2>A good first question is all it takes.</h2>
        </div>
        <div className="starter-list">
          {quickStarts.map((item, index) => (
            <Link href="/chat" className="starter-card" key={item}>
              <span>0{index + 1}</span>
              {item}
              <b>&rarr;</b>
            </Link>
          ))}
        </div>
      </section>

      <footer>GitFit <span>&bull;</span> Move with purpose.</footer>
    </main>
  );
}
