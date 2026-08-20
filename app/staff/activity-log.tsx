export type ActivityEntry = {
  id: string;
  requester_name: string;
  reviewer_name: string;
  status: "approved" | "denied";
  requested_date: string;
  reviewed_at: string | null;
};

function formatDateTime(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
function formatRequestedDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}

export function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  return (
    <section className="surface-card staff-activity-log" aria-labelledby="activity-log-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Audit trail</p>
          <h2 id="activity-log-title">Recent activity</h2>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="empty-state"><h3>No activity yet</h3><p>Approved and denied requests will show up here.</p></div>
      ) : (
        <ul className="staff-activity-list" aria-label="Recent request decisions">
          {entries.map((entry) => (
            <li className="staff-activity-row" key={entry.id}>
              <span className={`badge ${entry.status === "approved" ? "badge-success" : "badge-danger"}`}>{entry.status}</span>
              <span className="staff-activity-text">
                <strong>{entry.reviewer_name}</strong> {entry.status} <strong>{entry.requester_name}</strong>&apos;s request for {formatRequestedDate(entry.requested_date)}
              </span>
              <span className="staff-activity-time">{formatDateTime(entry.reviewed_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
