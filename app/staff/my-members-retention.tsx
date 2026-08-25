export type RetentionMember = { id: string; full_name: string | null; email: string; lifecycle_status: string; last_visit_date: string | null };

const tone: Record<string, "success" | "warning" | "danger"> = { active: "success", at_risk: "warning", lapsed: "danger" };

export function MyMembersRetention({ members, lifecycleCounts }: { members: RetentionMember[]; lifecycleCounts: Record<string, number> }) {
  const needsAttention = members.filter((member) => member.lifecycle_status !== "active").slice(0, 8);

  return (
    <section className="surface-card staff-pulse" aria-labelledby="my-retention-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Retention</p>
          <h2 id="my-retention-title">My members</h2>
        </div>
        <p>{members.length ? `${members.length} total` : "No attendees yet"}</p>
      </div>
      {members.length === 0 ? (
        <div className="empty-state"><h3>No attendee data yet</h3><p>Once members book your classes, their retention status will show up here.</p></div>
      ) : (
        <>
          <div className="staff-pulse-grid">
            {Object.entries(lifecycleCounts).map(([status, count]) => (
              <div className="staff-pulse-card" data-tone={tone[status] ?? "brand"} key={status}>
                <strong>{count}</strong>
                <span>{status.replace("_", " ")}</span>
              </div>
            ))}
          </div>
          {needsAttention.length ? (
            <div className="staff-teaching-load">
              <p className="staff-teaching-load-heading">Needs attention</p>
              <ul>
                {needsAttention.map((member) => (
                  <li key={member.id}>
                    <span>{member.full_name || member.email}</span>
                    <strong>{member.lifecycle_status.replace("_", " ")}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
