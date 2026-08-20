import Link from "next/link";

import { InstructorAvatar } from "@/app/components/instructor-avatar";
import { OutreachCardActions } from "@/app/components/outreach-card-actions";
import type { RichCard } from "@/lib/chatbot/types";

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?"; }
function formatTime(time: string) { const [hours, minutes] = time.split(":").map(Number); return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`; }
function formatDate(date: string) { const [year, month, day] = date.split("-").map(Number); return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day)); }
function typeRule(type: string) { return ({ yoga: "class-type-yoga", cycling: "class-type-cycling", hiit: "class-type-hiit" }[type.toLowerCase()] ?? "class-type-default"); }

export function ChatCard({ card }: { card: RichCard }) {
  switch (card.kind) {
    case "schedule": {
      const classes = card.classes.slice(0, 3); const remaining = card.classes.length - classes.length;
      return <section className="chat-card chat-schedule-card" aria-label="Schedule results"><h2 className="sr-only">Schedule results</h2>
        {classes.map((classRow) => { const isFull = classRow.bookedCount >= classRow.capacity; return <div className={`chat-schedule-row ${typeRule(classRow.type)}`} key={`${classRow.title}-${classRow.date}-${classRow.time}`}><InstructorAvatar name={classRow.instructor} size={32} /><div className="chat-schedule-summary"><strong>{classRow.title}<small>{formatTime(classRow.time)}</small></strong><span>{classRow.instructor}</span></div><span className={`badge ${isFull ? "badge-danger" : "badge-success"}`}>{isFull ? "Full" : "Open"}</span></div>; })}
        {remaining > 0 ? <Link className="chat-card-link" href="/appointments">+{remaining} more {"\u2014"} view full schedule</Link> : null}
      </section>;
    }
    case "members": { const title = card.title ?? "Member results"; return <section className="chat-card chat-members-card" aria-label={title}><h2 className="sr-only">{title}</h2>{card.members.map((member) => <div className="chat-member-row" key={member.email}><span className="member-initials" aria-hidden="true">{initials(member.name)}</span><div><strong>{member.name}</strong><span>{member.email}</span>{member.reason ? <small>{member.reason}</small> : null}</div><span className="badge badge-neutral">{member.status}</span></div>)}</section>; }
    case "workout": return <section className="chat-card chat-workout-card" aria-label="Workout plan"><h2>{card.title}</h2><div className="chat-workout-blocks">{card.blocks.map((block, index) => <div className="chat-workout-row" key={`${block.name}-${index}`}>{block.blockLabel && (index === 0 || card.blocks[index - 1]?.blockLabel !== block.blockLabel) ? <span className="badge badge-brand">{block.blockLabel}</span> : null}<div><strong>{block.name}</strong><span>{block.detail}</span></div></div>)}</div></section>;
    case "time-off": return <section className="chat-card chat-members-card" aria-label="Time-off requests"><h2 className="sr-only">Time-off requests</h2>{card.requests.map((request) => <div className="chat-member-row" key={`${request.date}-${request.status}`}><div><strong>{formatDate(request.date)}</strong></div><span className={`badge ${request.status === "pending" ? "badge-warning" : request.status === "approved" ? "badge-success" : "badge-danger"}`}>{request.status}</span></div>)}</section>;
    case "outreach": return <section className="chat-card chat-outreach-card" aria-label="Outreach draft"><h2>Outreach draft</h2><div className="chat-outreach-member"><span className="member-initials" aria-hidden="true">{initials(card.memberName)}</span><strong>{card.memberName}</strong></div><p className="chat-outreach-message">{card.message}</p>{card.sent ? null : <small>Nothing sent yet</small>}<OutreachCardActions sent={card.sent} sentAt={card.sentAt} /></section>;
    case "booking": return <section className="chat-card chat-members-card" aria-label="Booking result"><h2 className="sr-only">Booking result</h2><div className="chat-member-row"><div><strong>{card.className}</strong><span>{formatDate(card.date)} at {formatTime(card.time)} with {card.instructor}</span>{card.reason ? <small>{card.reason}</small> : null}</div><span className={`badge ${card.outcome === "confirmed" ? "badge-success" : card.outcome === "cancelled" ? "badge-warning" : "badge-danger"}`}>{card.outcome}</span></div></section>;
    case "capacity": { const title = card.title ?? "Studio capacity"; return <section className="chat-card chat-members-card" aria-label={title}><h2>{title}</h2>{card.rows.map((row) => <div className="chat-member-row" key={`${row.className}-${row.time}`}><div><strong>{row.className}</strong><span>{formatTime(row.time)} with {row.instructor}</span><small>{row.bookedCount}/{row.capacity} spots booked</small></div><span className={`badge ${row.fillLevel === "healthy" ? "badge-success" : row.fillLevel === "filling" ? "badge-warning" : "badge-danger"}`}>{row.fillLevel}</span></div>)}</section>; }
    default: { const _exhaustive: never = card; return _exhaustive; }
  }
}
