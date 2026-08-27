import Link from "next/link";
import { redirect } from "next/navigation";

import {
  IconCalendar,
  IconDashboard,
  IconSend,
  IconUsers
} from "@/app/components/icons";
import SiteNav from "@/app/components/site-nav";
import { getSession } from "@/lib/auth/session";

const suiteAreas = [
  {
    audience: "For members",
    title: "A routine that stays in motion.",
    description: "Book classes, see what is next, and keep your streak and studio updates in one clear home.",
    href: "/sign-up",
    cta: "Explore member tools",
    icon: IconCalendar
  },
  {
    audience: "For staff & studio leads",
    title: "The studio, in sync.",
    description: "Run schedules, manage member moments, and keep retention and day-to-day operations moving together.",
    href: "/sign-up",
    cta: "Explore studio tools",
    icon: IconUsers
  },
  {
    audience: "Meet Fitbot",
    title: "A helpful next step, on demand.",
    description: "Ask about classes, bookings, your schedule, or your goals and get moving with a guided answer.",
    href: "/chat",
    cta: "Talk to Fitbot",
    icon: IconSend
  }
];

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
          <p className="eyebrow"><span /> GitFit at Pulse Studio</p>
          <h1>Everything your studio needs to keep moving.</h1>
          <p className="hero-description">GitFit is Pulse Studio&apos;s shared platform for clients and staff: plan a workout, book a class, follow your momentum, and run a stronger studio together.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" href="/sign-up">Get started with GitFit <span aria-hidden="true">&rarr;</span></Link>
            <Link className="btn btn-outline-on-dark" href="/chat">Talk to Fitbot</Link>
          </div>
        </div>

        <div className="hero-brand-visual">
          <div className="hero-lockup-card">
            <img src="/gitfit-lockup.gif" alt="GitFit" />
            <p>Pulse Studio&apos;s connected fitness platform</p>
          </div>
          <div className="hero-visual-note">
            <IconDashboard />
            <span>One place for every next move</span>
          </div>
        </div>
      </section>

      <section className="suite-section" id="suite">
        <div className="suite-heading">
          <p className="eyebrow"><span /> One connected suite</p>
          <h2>Built around the people who make Pulse Studio go.</h2>
          <p>Whether you&apos;re showing up for your next class or making the day run smoothly behind the scenes, GitFit keeps the important things close.</p>
        </div>
        <div className="suite-grid">
          {suiteAreas.map(({ audience, title, description, href, cta, icon: Icon }) => (
            <Link href={href} className="suite-card" key={audience}>
              <div className="suite-card-icon"><Icon /></div>
              <p className="suite-card-audience">{audience}</p>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className="suite-card-link">{cta} <b aria-hidden="true">&rarr;</b></span>
            </Link>
          ))}
        </div>
      </section>

      <footer>GitFit for Pulse Studio <span>&bull;</span> Move with purpose.</footer>
    </main>
  );
}
