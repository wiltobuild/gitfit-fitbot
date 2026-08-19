"use client";

function openFitBot(preset: string) {
  window.dispatchEvent(new CustomEvent("fitbot:open", { detail: { preset } }));
}

export function StaffFitBotTiles() {
  return <aside className="surface-card staff-fitbot-tiles" aria-labelledby="staff-fitbot-title">
    <div className="staff-panel-heading"><div><p className="eyebrow"><span /> Assistant</p><h2 id="staff-fitbot-title">Ask FitBot</h2></div><p>Quick, generic prompts.</p></div>
    <button type="button" className="staff-fitbot-tile" onClick={() => openFitBot("draft a retention outreach for a member who hasn't booked in 30 days")}><strong>Retention outreach</strong><span>Ask FitBot</span><small>“Draft a retention outreach for a member who hasn&apos;t booked in 30 days.”</small></button>
    <button type="button" className="staff-fitbot-tile" onClick={() => openFitBot("help plan instructor coverage for a time-off request")}><strong>Time-off coverage</strong><span>Ask FitBot</span><small>“Help plan instructor coverage for a time-off request.”</small></button>
  </aside>;
}
