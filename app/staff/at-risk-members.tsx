"use client";

import type { ChipId } from "@/lib/chatbot/chip-labels";

export type AtRiskMember = {
  id: string;
  full_name: string | null;
  email: string;
  last_visit_date: string | null;
};

function openFitBot(chipId: ChipId, memberId?: string) {
  window.dispatchEvent(new CustomEvent("fitbot:open", { detail: { chipId, memberId } }));
}

function formatLastVisit(date: string | null) {
  if (!date) return "No visits on record";
  return `Last visit ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`))}`;
}

export function AtRiskMembers({ members, totalCount }: { members: AtRiskMember[]; totalCount: number }) {
  return (
    <section className="surface-card staff-at-risk" aria-labelledby="at-risk-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Retention</p>
          <h2 id="at-risk-title">At-risk members</h2>
        </div>
        <p>{totalCount === 0 ? "None flagged" : members.length < totalCount ? `Showing ${members.length} of ${totalCount} flagged` : `${totalCount} flagged`}</p>
      </div>
      {members.length === 0 ? (
        <div className="empty-state"><h3>Nobody flagged right now</h3><p>Members show up here once their lifecycle status turns at-risk.</p></div>
      ) : (
        <ul className="staff-request-list" aria-label="At-risk members">
          {members.map((member) => (
            <li className="staff-request-row" key={member.id}>
              <div className="staff-request-summary">
                <strong>{member.full_name || member.email}</strong>
                <span>{formatLastVisit(member.last_visit_date)}</span>
              </div>
              <button className="btn btn-outline btn-sm" type="button" onClick={() => openFitBot("retention-outreach", member.id)}>
                Ask FitBot to draft outreach
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
