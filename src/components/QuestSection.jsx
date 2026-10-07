import { getThisWeekCount, todayStr } from "../utils";
import styles from "../styles.module.css";

export function questGroups(goals) {
  return [
    { key: "daily", title: "Daily Quests", frequency: 7, goals: goals.filter(g => (g.frequency || 7) === 7) },
    { key: "weekly", title: "Weekly Quests", frequency: 3, goals: goals.filter(g => (g.frequency || 7) !== 7) },
  ];
}

export default function QuestSection({ group, state, children }) {
  const weekly = group.key === "weekly";
  const done = group.goals.filter(g => weekly
    ? getThisWeekCount(g.completions || []) >= (g.frequency || 7)
    : state.lastCompletions?.[g.id] === todayStr()).length;
  return (
    <section aria-label={group.title} style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 className={styles.panelLbl} style={{ margin: 0 }}>{group.title}</h2>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: done === group.goals.length && done > 0 ? "var(--green)" : "var(--text-tertiary)" }}>
          {done}/{group.goals.length}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {group.goals.length ? children : <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", padding: "10px 0" }}>
          No {weekly ? "weekly" : "daily"} quests yet.
        </p>}
      </div>
    </section>
  );
}
