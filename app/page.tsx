import Link from "next/link";

import { IconCalendar, IconDashboard, IconShield, IconSparkle, MomentumArc } from "@/app/components/icons";
import ModuleCard from "@/app/components/module-card";
import SiteNav from "@/app/components/site-nav";
import { getSession } from "@/lib/auth/session";

const quickStarts = ["Build a better routine", "Find my next workout", "Keep the momentum"];
const modules = [
  { href: "/chat", title: "Fitbot", description: "Get a plan that keeps you moving.", icon: IconSparkle },
  { href: "/appointments", title: "Book a Class", description: "Find a class that fits your routine.", icon: IconCalendar },
  { href: "/dashboard", title: "Your Dashboard", description: "Check in on your progress and plan.", icon: IconDashboard },
];

export default async function Home() {
  const session = await getSession();

  return (
    <main className="landing-shell">
      <SiteNav />

      {session ? (
        <section className="module-section" aria-labelledby="suite-heading">
          <div className="module-heading">
            <p className="eyebrow"><span /> Your GitFit suite</p>
            <h1 id="suite-heading">Ready for your next move?</h1>
            <p>Choose where you want to begin today.</p>
          </div>
          <div className="module-grid">
            {modules.map((module, index) => (
              <ModuleCard {...module} animationDelay={`${index * 60}ms`} key={module.href} />
            ))}
            {(session.role === "staff" || session.role === "admin") && (
              <ModuleCard href="/staff" title="Staff Console" description="Support your members and manage the day." icon={IconShield} animationDelay="180ms" />
            )}
          </div>
        </section>
      ) : (
        <>
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
        </>
      )}

      <footer>GitFit <span>&bull;</span> Move with purpose.</footer>
    </main>
  );
}
