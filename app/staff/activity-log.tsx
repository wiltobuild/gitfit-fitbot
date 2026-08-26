export type ActivityEntry = {
  id: string;
  requester_name: string;
  reviewer_name: string;
  status: "approved" | "denied";
  requested_date: string;
  reviewed_at: string | null;
};

export type CancellationEntry = {
  id: string;
  class_label: string;
  canceler_name: string;
  booked_count: number;
  created_at: string;
};

export type ActivityItem =
  | (ActivityEntry & { kind: "time_off"; timestamp: string })
  | (CancellationEntry & { kind: "class_cancellation"; timestamp: string });

// Merges resolved time-off decisions and class cancellations into one
// newest-first feed. Kept as a pure function (no JSX) so it's independently
// testable: the interleave-by-timestamp behaviour is the only non-trivial
// logic here, everything else is direct field pass-through per kind.
export function mergeActivityItems(
  timeOffEntries: ActivityEntry[],
  cancellationEntries: CancellationEntry[]
): ActivityItem[] {
  const timeOffItems: ActivityItem[] = timeOffEntries.map((entry) => ({
    ...entry,
    kind: "time_off",
    timestamp: entry.reviewed_at ?? "",
  }));
  const cancellationItems: ActivityItem[] = cancellationEntries.map((entry) => ({
    ...entry,
    kind: "class_cancellation",
    timestamp: entry.created_at,
  }));

  return [...timeOffItems, ...cancellationItems].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

function formatDateTime(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
function formatRequestedDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}

export function ActivityLog({ entries, cancellations = [] }: { entries: ActivityEntry[]; cancellations?: CancellationEntry[] }) {
  const items = mergeActivityItems(entries, cancellations);
  return (
    <section className="surface-card staff-activity-log" aria-labelledby="activity-log-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Audit trail</p>
          <h2 id="activity-log-title">Recent activity</h2>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="empty-state"><h3>No activity yet</h3><p>Approved and denied requests will show up here.</p></div>
      ) : (
        <ul className="staff-activity-list" aria-label="Recent request decisions">
          {items.map((item) =>
            item.kind === "time_off" ? (
              <li className="staff-activity-row" data-status={item.status} key={item.id}>
                <span className={`badge ${item.status === "approved" ? "badge-success" : "badge-danger"}`}>{item.status}</span>
                <span className="staff-activity-text">
                  <strong>{item.reviewer_name}</strong> {item.status} <strong>{item.requester_name}</strong>&apos;s request for {formatRequestedDate(item.requested_date)}
                </span>
                <span className="staff-activity-time">{formatDateTime(item.reviewed_at)}</span>
              </li>
            ) : (
              <li className="staff-activity-row" data-status="canceled" key={item.id}>
                <span className="badge badge-danger">canceled</span>
                <span className="staff-activity-text">
                  <strong>{item.canceler_name}</strong> canceled <strong>{item.class_label}</strong> · {item.booked_count} {item.booked_count === 1 ? "member" : "members"} affected
                </span>
                <span className="staff-activity-time">{formatDateTime(item.created_at)}</span>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}
