export type PulseStat = { label: string; value: string; detail?: string; tone?: "brand" | "success" | "warning" | "danger" };
export type TeachingLoadRow = { name: string; count: number };

export function StudioPulse({ stats, teachingLoad }: { stats: PulseStat[]; teachingLoad: TeachingLoadRow[] }) {
  return (
    <section className="surface-card staff-pulse" aria-labelledby="studio-pulse-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Studio pulse</p>
          <h2 id="studio-pulse-title">This week at a glance</h2>
        </div>
      </div>
      <div className="staff-pulse-grid">
        {stats.map((stat) => (
          <div className="staff-pulse-card" data-tone={stat.tone} key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
            {stat.detail ? <small>{stat.detail}</small> : null}
          </div>
        ))}
      </div>
      {teachingLoad.length ? (
        <div className="staff-teaching-load">
          <p className="staff-teaching-load-heading">Instructor teaching load</p>
          <ul>
            {teachingLoad.map((row) => (
              <li key={row.name}>
                <span>{row.name}</span>
                <strong>{row.count} {row.count === 1 ? "class" : "classes"}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
