export type LeaderboardRow = { instructorMemberId: string; instructorName: string; fillRatePercent: number; uniqueMembers: number; classCount: number };

export function InstructorLeaderboard({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <section className="surface-card staff-pulse" aria-labelledby="instructor-leaderboard-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Staff retention</p>
          <h2 id="instructor-leaderboard-title">Who members keep coming back to</h2>
        </div>
        <p>This week</p>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state"><h3>No classes this week</h3><p>Instructor rankings will show up once classes are scheduled.</p></div>
      ) : (
        <div className="staff-teaching-load">
          <ul>
            {rows.map((row) => (
              <li key={row.instructorMemberId}>
                <span>{row.instructorName} · {row.classCount} {row.classCount === 1 ? "class" : "classes"}</span>
                <strong>{row.uniqueMembers} members · {row.fillRatePercent}% full</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
