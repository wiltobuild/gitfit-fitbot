const tierBadge: Record<string, string> = { gold: "badge-warning", silver: "badge-neutral", bronze: "badge-graphite" };

export function TrainerProfile({ name, email, certTier }: { name: string; email: string; certTier: string | null }) {
  return (
    <section className="surface-card staff-trainer-profile" aria-labelledby="trainer-profile-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> My profile</p>
          <h2 id="trainer-profile-title">{name}</h2>
          <p className="staff-trainer-profile-email">{email}</p>
        </div>
        <span className={`badge ${certTier ? (tierBadge[certTier] ?? "badge-neutral") : "badge-neutral"}`}>{certTier ? `${certTier} tier` : "Tier not set"}</span>
      </div>
    </section>
  );
}
