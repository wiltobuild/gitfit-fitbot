import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "@/app/actions/auth";
import { IconCalendar, IconSparkle, MomentumArc } from "@/app/components/icons";
import MomentumRing from "@/app/components/momentum-ring";
import type { EncouragingMessageCategory } from "@/lib/dashboard/encouraging-messages";
import type { ClassRow } from "@/lib/members/queries";

type Promotion = { id: string; subject: string; body: string; sent_at: string | null };

const formatDate = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`));
const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
};
const formatPromotionDate = (sentAt: string | null) => {
  if (!sentAt) return "Recently";
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }).format(date);
};
const previewPromotion = (body: string) => body.length > 150 ? `${body.slice(0, 147).trimEnd()}...` : body;

function SessionList({ classes, emptyTitle, emptyCopy }: { classes: ClassRow[]; emptyTitle: string; emptyCopy: ReactNode }) {
  return classes.length ? <ul className="client-session-list">{classes.map((classRow) => <li key={`${classRow.class_date}-${classRow.start_time}-${classRow.name}`}>
    <div><strong>{classRow.name}</strong><span>{classRow.instructor} · {classRow.type}</span></div>
    <time dateTime={classRow.class_date}>{formatDate(classRow.class_date)} · {formatTime(classRow.start_time)}</time>
  </li>)}</ul> : <div className="empty-state client-dashboard-empty"><h3>{emptyTitle}</h3><p>{emptyCopy}</p></div>;
}

export function ClientDashboard({ bookingHistory, currentWeekBooked, encouragingMessage, encouragingMessageCategory, promotions, streakWeeks, upcomingBookings, userEmail }: { bookingHistory: ClassRow[]; currentWeekBooked: boolean; encouragingMessage: string; encouragingMessageCategory: EncouragingMessageCategory; promotions: Promotion[] | null; streakWeeks: number; upcomingBookings: ClassRow[]; userEmail?: string }) {
  return <main className="account-content client-dashboard-content">
    <header className="account-intro animate-fade-up"><p className="eyebrow"><span /> Your home base</p><h1>Ready when you are.</h1><p>Keep your routine moving, see what&apos;s next, or ask FitBot for a little guidance.</p></header>
    <section className="surface-card dashboard-card client-momentum-card animate-fade-up" style={{ animationDelay: ".08s" }}>
      <div className="dashboard-card-top"><div><h2>Your momentum</h2><p className="dashboard-email">Signed in as {userEmail}</p></div><span className="badge badge-neutral">Member</span></div>
      <div className="dashboard-momentum client-streak"><MomentumRing target={8} value={streakWeeks} /><div><h3>{streakWeeks === 1 ? "1 completed week in your streak" : `${streakWeeks} completed weeks in your streak`}</h3><p className={`client-streak-message client-streak-tone-${encouragingMessageCategory}`}>{encouragingMessage}</p><span className={`client-week-status ${currentWeekBooked ? "is-booked" : ""}`}>This week: {currentWeekBooked ? "booked" : "not yet booked"}</span></div></div>
      <div className="quick-actions" aria-label="Quick actions"><Link className="quick-action quick-action-fitbot" href="/chat"><MomentumArc className="quick-action-arc" /><span className="quick-action-content"><span className="quick-action-icon"><IconSparkle /></span><span>Chat with FitBot</span></span><span aria-hidden="true">→</span></Link><Link className="quick-action quick-action-appointments" href="/appointments"><span className="quick-action-content"><span className="quick-action-icon"><IconCalendar /></span><span>View appointments</span></span><span aria-hidden="true">→</span></Link></div>
      <div className="account-sign-out"><form action={signOut}><button className="btn btn-outline" type="submit">Sign out</button></form></div>
    </section>
    <div className="client-dashboard-grid animate-fade-up" style={{ animationDelay: ".12s" }}>
      <section className="surface-card dashboard-card client-session-card" aria-labelledby="upcoming-bookings-title"><div className="client-section-heading"><div><p className="eyebrow"><span /> On your calendar</p><h2 id="upcoming-bookings-title">Current booked sessions</h2></div><Link href="/appointments">Browse schedule</Link></div><SessionList classes={upcomingBookings} emptyTitle="No upcoming sessions" emptyCopy={<>Browse the <Link href="/appointments">schedule</Link> to book your next class.</>} /></section>
      <section className="surface-card dashboard-card client-session-card" aria-labelledby="recent-sessions-title"><div className="client-section-heading"><div><p className="eyebrow"><span /> Your routine</p><h2 id="recent-sessions-title">Your recent sessions</h2></div><span className="badge badge-neutral">Last {bookingHistory.length}</span></div><SessionList classes={bookingHistory} emptyTitle="No recent sessions yet" emptyCopy="Once you’ve taken a class, your recent booked sessions will appear here." /></section>
    </div>
    {promotions ? <section className="surface-card dashboard-card dashboard-promotions animate-fade-up" style={{ animationDelay: ".14s" }}><div className="dashboard-card-top"><div><h2>Promotions</h2><p className="dashboard-email">Updates and offers from your GitFit team.</p></div></div>{promotions.length ? <div className="promotion-list">{promotions.map((promotion) => <article className="promotion-item" key={promotion.id}><div className="promotion-item-top"><h3>{promotion.subject}</h3><time dateTime={promotion.sent_at ?? undefined}>{formatPromotionDate(promotion.sent_at)}</time></div><p>{previewPromotion(promotion.body)}</p></article>)}</div> : <p className="dashboard-promotions-empty">No promotions right now. Check back soon for updates from the studio.</p>}</section> : null}
  </main>;
}
