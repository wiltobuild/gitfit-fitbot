export type MyClassCreationRequest = {
  id: string;
  name: string;
  type: string;
  class_date: string;
  start_time: string;
  status: "pending" | "approved" | "denied";
};

const statusBadge: Record<MyClassCreationRequest["status"], string> = {
  pending: "badge-warning",
  approved: "badge-success",
  denied: "badge-danger",
};

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}
function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}

export function ClassCreationStatus({ requests }: { requests: MyClassCreationRequest[] }) {
  return (
    <section className="surface-card staff-my-requests" aria-labelledby="class-creation-status-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Class proposals</p>
          <h2 id="class-creation-status-title">My proposals</h2>
        </div>
        <p>{requests.length ? `${requests.length} submitted` : "None yet"}</p>
      </div>
      {requests.length === 0 ? (
        <div className="empty-state"><h3>No proposals yet</h3><p>Use &ldquo;New proposal&rdquo; above to suggest a class to your manager.</p></div>
      ) : (
        <ul className="staff-request-list" aria-label="Your class proposals">
          {requests.map((request) => (
            <li className="staff-request-row" key={request.id}>
              <div className="staff-request-summary">
                <strong>{request.name}</strong>
                <span>{request.type} — {formatDate(request.class_date)}, {formatTime(request.start_time)}</span>
              </div>
              <span className={`badge ${statusBadge[request.status]}`}>{request.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
