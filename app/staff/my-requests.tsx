export type MyRequest = {
  id: string;
  requested_date: string;
  reason: string | null;
  status: "pending" | "approved" | "denied";
};

const statusBadge: Record<MyRequest["status"], string> = {
  pending: "badge-warning",
  approved: "badge-success",
  denied: "badge-danger",
};

function formatRequestedDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}

export function MyRequests({ requests }: { requests: MyRequest[] }) {
  return (
    <section className="surface-card staff-my-requests" aria-labelledby="my-requests-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Time off</p>
          <h2 id="my-requests-title">My requests</h2>
        </div>
        <p>{requests.length ? `${requests.length} submitted` : "None yet"}</p>
      </div>
      {requests.length === 0 ? (
        <div className="empty-state"><h3>No requests yet</h3><p>Ask FitBot to submit a time-off request when you need one.</p></div>
      ) : (
        <ul className="staff-request-list" aria-label="Your time-off requests">
          {requests.map((request) => (
            <li className="staff-request-row" key={request.id}>
              <div className="staff-request-summary">
                <strong>{formatRequestedDate(request.requested_date)}</strong>
                {request.reason ? <span>{request.reason}</span> : null}
              </div>
              <span className={`badge ${statusBadge[request.status]}`}>{request.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
