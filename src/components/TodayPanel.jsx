import { CAT_META } from "../constants";
import { todayStr } from "../utils";
import styles from "../styles.module.css";

export default function TodayPanel({ level, lastCompletions, streaks }) {
  const t = todayStr();
  const habits = level.goals.filter(g => g.type === "habitual");
  const done = habits.filter(g => lastCompletions[g.id] === t).length;
  const allDone = habits.length > 0 && done === habits.length;
  const pct = habits.length ? Math.round((done / habits.length) * 100) : 0;

  return (
    <div className={styles.panel} style={{ display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p className={styles.panelLbl}>Today's Habits</p>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: allDone ? "var(--green)" : "var(--text-primary)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "-0.02em",
          textShadow: allDone ? "0 0 12px rgba(34,197,94,0.6)" : "none",
          transition: "color 0.3s, text-shadow 0.3s",
        }}>
          {done}<span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>/{habits.length}</span>
        </span>
      </div>

      {/* Progress bar */}
      {habits.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ height: 3, background: "var(--border)", borderRadius: 2 }}>
            <div style={{
              height: "100%",
              width: `${pct}%`,
              background: allDone ? "var(--green)" : "var(--accent)",
              borderRadius: 2,
              transition: "width 0.5s var(--easing-out), background 0.3s",
              boxShadow: allDone
                ? "0 0 10px rgba(34,197,94,0.6)"
                : "0 0 8px rgba(59,130,246,0.5)",
            }} />
          </div>
          {allDone && (
            <p style={{
              fontSize: 9, color: "var(--green)", marginTop: 5,
              fontFamily: "var(--font-mono)", letterSpacing: "0.1em",
              textShadow: "0 0 8px rgba(34,197,94,0.4)",
            }}>ALL COMPLETE</p>
          )}
        </div>
      )}

      {habits.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", flex: 1 }}>No habits yet.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column" }}>
        {habits.map(g => {
          const isDone = lastCompletions[g.id] === t;
          const streak = streaks[g.id] || 0;
          return (
            <div key={g.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0", borderBottom: "1px solid var(--border-light)",
              opacity: isDone ? 0.38 : 1,
              transition: "opacity 0.25s",
            }}>
              <div style={{
                width: 3, height: 22, borderRadius: 1, flexShrink: 0,
                background: CAT_META[g.category]?.accent || "var(--text-tertiary)",
              }} />
              <span style={{
                fontSize: 13, color: "var(--text-primary)",
                flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {g.name}
              </span>
              {streak > 1 && (
                <span style={{
                  fontSize: 10, color: "var(--yellow)", flexShrink: 0,
                  fontWeight: 700, fontFamily: "var(--font-mono)",
                }}>
                  {streak}D
                </span>
              )}
              <span style={{
                fontSize: 10, fontWeight: 600, flexShrink: 0,
                color: isDone ? "var(--green)" : "var(--text-tertiary)",
                fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                textShadow: isDone ? "0 0 8px rgba(34,197,94,0.4)" : "none",
              }}>
                {isDone ? "✓" : `+${g.weight}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
