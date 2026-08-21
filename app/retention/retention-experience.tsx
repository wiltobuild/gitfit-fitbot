"use client";

type Cohort = { minDays: number; maxDays: number; count: number };
type TrendPoint = { weekStart: string; activeMembers: number };

type RetentionExperienceProps = { initialCohorts: Cohort[]; initialTrend: TrendPoint[]; staffUserId: string };

export function RetentionExperience({ initialCohorts, initialTrend, staffUserId }: RetentionExperienceProps) {
  const cohortRows = initialCohorts.map(({ minDays, maxDays, count }) => <li className="retention-cohort-row" key={`${minDays}-${maxDays}`}><span>{minDays}–{maxDays} days inactive</span><strong>{count}</strong></li>);
  const activityStatus = initialTrend.length ? `${initialTrend.length} weeks of activity data loaded` : "Activity data will appear here";

  return <>
    <header className="retention-header-band"><div className="retention-header-inner"><div><p className="eyebrow"><span /> Staff outreach</p><h1>Retention Campaigns</h1><p>Build thoughtful re-engagement campaigns from live member activity.</p></div><span className="badge badge-brand">Campaign workspace</span></div></header>
    <div className="retention-layout">
      <section className="surface-card retention-panel retention-audience-panel" aria-labelledby="retention-audience-title"><p className="retention-panel-kicker">Audience</p><h2 id="retention-audience-title">Audience cohorts</h2><ul className="retention-cohort-list">{cohortRows}</ul></section>
      <section className="surface-card retention-panel retention-workspace-panel" aria-labelledby="retention-campaign-title"><p className="retention-panel-kicker">Workspace</p><h2 id="retention-campaign-title">Your campaign</h2><div className="retention-placeholder"><p>Campaign setup will be available here in the next phase.</p><small>{activityStatus}</small></div></section>
      <aside className="surface-card retention-panel retention-preview-panel" aria-labelledby="retention-preview-title"><p className="retention-panel-kicker">Preview</p><h2 id="retention-preview-title">Live member preview</h2><div className="retention-placeholder"><p>Selecting a cohort and previewing a member will be available next.</p><small>Prepared for staff account {staffUserId.slice(0, 8)}.</small></div></aside>
    </div>
  </>;
}
