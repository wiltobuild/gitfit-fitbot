import Link from "next/link";

import { InstructorAvatar } from "@/app/components/instructor-avatar";
import type { RichCard } from "@/lib/chatbot/types";

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?"; }
function formatTime(time: string) { const [hours, minutes] = time.split(":").map(Number); return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`; }
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
    case "members": return <section className="chat-card chat-members-card" aria-label="Member results"><h2 className="sr-only">Member results</h2>{card.members.map((member) => <div className="chat-member-row" key={member.email}><span className="member-initials" aria-hidden="true">{initials(member.name)}</span><div><strong>{member.name}</strong><span>{member.email}</span></div><span className="badge badge-neutral">{member.status}</span></div>)}</section>;
    case "workout": return <section className="chat-card chat-workout-card" aria-label="Workout plan"><h2>{card.title}</h2><ol>{card.blocks.map((block, index) => <li key={`${block.name}-${index}`}><strong>{block.name}</strong><span>{block.detail}</span></li>)}</ol></section>;
    case "outreach": return <section className="chat-card chat-outreach-card" aria-label="Outreach draft"><h2>Outreach draft for {card.memberName}</h2><p>{card.message}</p><small>Nothing sent yet</small><div><button className="btn btn-secondary btn-sm" type="button">Send when ready</button><button className="btn btn-outline btn-sm" type="button">Edit draft</button></div></section>;
  }
}
