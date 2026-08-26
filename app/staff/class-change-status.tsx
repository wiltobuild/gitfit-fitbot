export type MyClassChangeRequest = {
  id: string;
  class_id: string;
  type: "edit" | "cancel";
  status: "pending" | "approved" | "denied";
  created_at: string;
};

const statusBadge: Record<MyClassChangeRequest["status"], string> = {
  pending: "badge-warning",
  approved: "badge-success",
  denied: "badge-danger",
};

export function ClassChangeStatus({ requests, classLabelById }: { requests: MyClassChangeRequest[]; classLabelById: Record<string, string> }) {
  return (
    <section className="surface-card staff-my-requests" aria-labelledby="class-change-status-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Schedule changes</p>
          <h2 id="class-change-status-title">My edit/cancel requests</h2>
        </div>
        <p>{requests.length ? `${requests.length} submitted` : "None yet"}</p>
      </div>
      {requests.length === 0 ? (
        <div className="empty-state"><h3>No requests yet</h3><p>Use the Edit or Cancel button on a class in your schedule to send a request to your manager.</p></div>
      ) : (
        <ul className="staff-request-list" aria-label="Your edit and cancel requests">
          {requests.map((request) => (
            <li className="staff-request-row" key={request.id}>
              <div className="staff-request-summary">
                <strong>{classLabelById[request.class_id] ?? "Class no longer scheduled"}</strong>
                <span>{request.type === "edit" ? "Edit requested" : "Cancel requested"}</span>
              </div>
              <span className={`badge ${statusBadge[request.status]}`}>{request.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
