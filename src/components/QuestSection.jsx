import { getThisWeekCount, todayStr } from "../utils";
import styles from "./quests.module.css";

export function questGroups(goals) {
  return [
    { key: "daily", title: "Daily Quests", frequency: 7, goals: goals.filter(g => (g.frequency || 7) === 7) },
    { key: "weekly", title: "Weekly Quests", frequency: 3, goals: goals.filter(g => (g.frequency || 7) !== 7) },
  ];
}

export default function QuestSection({ group, state, onAdd, manage = false, children }) {
  const weekly = group.key === "weekly";
  const target = group.goals.reduce((sum, g) => sum + (weekly ? g.frequency : 1), 0);
  const completed = group.goals.reduce((sum, g) => sum + (weekly
    ? Math.min(getThisWeekCount(g.completions || []), g.frequency)
    : Number(state.lastCompletions?.[g.id] === todayStr())), 0);
  const cleared = target > 0 && completed >= target;
  return (
    <section className={styles.section} aria-label={group.title}>
      <header className={styles.header}>
        <div>
          <div className={styles.heading}>
            <h2>{group.title}</h2>
            <span className={styles.count}>{group.goals.length}</span>
          </div>
          <p>{weekly ? "Make progress at your own pace this week." : "A little progress, every day."}</p>
        </div>
        {onAdd && <button className={styles.add} onClick={onAdd} aria-label={`${manage ? "Manage" : "Add"} ${weekly ? "weekly" : "daily"} quest`}>{manage ? "Manage" : "+ Add"}</button>}
      </header>
      {target > 0 && <div className={styles.progress}>
        <span className={cleared ? styles.cleared : undefined}>{cleared ? (weekly ? "Weekly targets met" : "Daily quests cleared") : `${completed}/${target} ${weekly ? "completions this week" : "completed today"}`}</span>
        <progress value={completed} max={target} aria-label={`${group.title} progress`} />
      </div>}
      {group.goals.length ? <div className={styles.list}>{children}</div> : <div className={styles.empty}>
        <p>{weekly ? "Set a weekly target for quests that need more flexibility." : "Add your first daily quest to start building momentum."}</p>
        {onAdd && <button className={styles.emptyAction} onClick={onAdd}>{manage ? "Set up" : "Create"} {weekly ? "weekly" : "daily"} quest</button>}
      </div>}
    </section>
  );
}
