import { useState } from "react";
import { CAT_META } from "../constants";
import { todayStr, calcBaseXP, calcHabitXP, getThisWeekCount, getGoalIdentities } from "../utils";
import { S } from "../styles";
import { useIsMobile } from "../hooks/useIsMobile";

export default function HabitsPanel({ level, state, onCompleteHabitual, onResistQuit, onSuccumbQuit, onGoToGoals }) {
  const isMobile = useIsMobile();
  const [pops, setPops]       = useState([]);
  const [hovered, setHovered] = useState(null);
  const [flashing, setFlashing] = useState(null);

  const t         = todayStr();
  const habits    = (level.goals || []).filter(g => g.type === "habitual");
  const quitGoals = (level.goals || []).filter(g => g.type === "quitHabit");

  // "done" = daily habits completed today OR weekly habits that met this week's target
  const done = habits.filter(g => {
    const freq = g.frequency || 7;
    return freq >= 7
      ? state.lastCompletions?.[g.id] === t
      : getThisWeekCount(g.completions || []) >= freq;
  }).length;
  const pct    = habits.length ? Math.round((done / habits.length) * 100) : 0;
  const allDone = habits.length > 0 && done === habits.length;

  const todayXP = habits
    .filter(g => state.lastCompletions?.[g.id] === t)
    .reduce((s, g) => s + (g.template && g.difficulty
      ? calcBaseXP(g.template, g.difficulty, g.category, "habitual")
      : (g.weight || 10)), 0);

  function handleComplete(goalId) {
    if (state.lastCompletions?.[goalId] === t) return;

    const g = habits.find(h => h.id === goalId);
    if (!g) return;

    // Compute display XP (with streak bonus estimate)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toDateString();
    const curStreak = state.streaks?.[goalId] || 0;
    const nextStreak = state.lastCompletions?.[goalId] === yStr ? curStreak + 1 : 1;
    const displayXP = g.template && g.difficulty
      ? calcHabitXP(g.template, g.difficulty, g.category, nextStreak)
      : (g.weight || 10);

    setFlashing(goalId);
    setTimeout(() => setFlashing(null), 320);
    onCompleteHabitual(goalId);

    const id = Date.now() + Math.random();
    setPops(p => [...p, { id, label: `+${displayXP} XP` }]);
    setTimeout(() => setPops(p => p.filter(x => x.id !== id)), 950);
  }

  return (
    <div style={{
      ...S.panel,
      borderLeft: "2px solid var(--accent)",
      position: "relative",
      overflow: "hidden",
      boxShadow: "var(--shadow-sm), inset 2px 0 16px rgba(59,130,246,0.04)",
    }}>
      {/* Floating XP pops */}
      {pops.map(pop => (
        <div key={pop.id} style={{
          position: "absolute",
          top: "38%",
          right: 18,
          pointerEvents: "none",
          zIndex: 20,
          fontFamily: "var(--font-mono)",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--green)",
          textShadow: "0 0 12px rgba(34,197,94,0.9)",
          animation: "xpFloat 0.95s ease-out forwards",
          whiteSpace: "nowrap",
        }}>
          {pop.label}
        </div>
      ))}

      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={S.panelLbl}>Today's Habits</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {todayXP > 0 && (
              <span style={{
                fontSize: 10, color: "var(--green)",
                fontFamily: "var(--font-mono)", fontWeight: 600,
                letterSpacing: "0.04em",
                textShadow: "0 0 8px rgba(34,197,94,0.5)",
              }}>+{todayXP} XP</span>
            )}
            <span style={{
              fontSize: 13, fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: allDone ? "var(--green)" : "var(--text-primary)",
              textShadow: allDone ? "0 0 12px rgba(34,197,94,0.6)" : "none",
              transition: "color 0.3s, text-shadow 0.3s",
            }}>
              {done}/{habits.length}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {habits.length > 0 && (
          <>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, position: "relative", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${pct}%`,
                background: allDone ? "var(--green)" : "var(--accent)",
                borderRadius: 2,
                transition: "width 0.5s var(--easing-out), background 0.3s",
                boxShadow: allDone
                  ? "0 0 10px rgba(34,197,94,0.7)"
                  : "0 0 8px rgba(59,130,246,0.6)",
              }} />
            </div>
            {allDone && (
              <p style={{
                fontSize: 9, color: "var(--green)", marginTop: 6,
                fontFamily: "var(--font-mono)", letterSpacing: "0.12em",
                textShadow: "0 0 8px rgba(34,197,94,0.5)",
                animation: "popIn 0.3s var(--easing-spring)",
              }}>
                ◈ ALL OBJECTIVES CLEARED
              </p>
            )}
          </>
        )}
      </div>

      {/* Habit list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {habits.length === 0 && (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 14 }}>
              No habits defined yet.
            </p>
            <button style={S.ghostBtn} onClick={onGoToGoals}>+ Define habits</button>
          </div>
        )}

        {habits.map(g => {
          const freq         = g.frequency || 7;
          const isWeekly     = freq < 7;
          const isDoneToday  = state.lastCompletions?.[g.id] === t;
          const thisWeekCnt  = isWeekly ? getThisWeekCount(g.completions || []) : 0;
          const weeklyMet    = isWeekly && thisWeekCnt >= freq;
          const isDone       = isWeekly ? weeklyMet : isDoneToday;
          const streak       = state.streaks?.[g.id] || 0;
          const accent       = CAT_META[g.category]?.accent || "var(--accent)";
          const isHovered    = hovered === g.id && !isDoneToday;
          const isFlash      = flashing === g.id;

          return (
            <div
              key={g.id}
              onClick={() => !isDoneToday && handleComplete(g.id)}
              onMouseEnter={() => !isDoneToday && setHovered(g.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "11px 13px",
                background: isDone
                  ? "rgba(34,197,94,0.05)"
                  : isHovered
                  ? `${accent}10`
                  : "rgba(255,255,255,0.018)",
                border: `1px solid ${
                  isDone ? "rgba(34,197,94,0.18)"
                  : isHovered ? `${accent}50`
                  : "var(--border)"
                }`,
                borderLeft: `3px solid ${isDone ? "var(--green)" : accent}`,
                borderRadius: 6,
                cursor: isDoneToday ? "default" : "pointer",
                transition: "all 0.18s var(--easing-out)",
                transform: isFlash ? "scale(0.975)" : "scale(1)",
                boxShadow: isHovered
                  ? `0 0 14px ${accent}20`
                  : isDone
                  ? "0 0 8px rgba(34,197,94,0.08)"
                  : "none",
                userSelect: "none",
              }}
            >
              {/* Checkbox — ticks when logged today, regardless of weekly target */}
              <div style={{
                width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                background: isDoneToday ? "var(--green)" : isHovered ? `${accent}20` : "transparent",
                border: `1.5px solid ${isDoneToday ? "var(--green)" : isHovered ? accent : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, color: isDoneToday ? "#fff" : "transparent",
                transition: "all 0.2s var(--easing-spring)",
                boxShadow: isDoneToday ? "0 0 10px rgba(34,197,94,0.45)" : "none",
              }}>✓</div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500,
                  color: isDoneToday ? "var(--text-tertiary)" : "var(--text-primary)",
                  textDecoration: isDoneToday ? "line-through" : "none",
                  transition: "color 0.2s",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {g.name}
                </div>
                <div style={{
                  fontSize: 9, color: "var(--text-tertiary)",
                  fontFamily: "var(--font-mono)", letterSpacing: "0.06em", marginTop: 2,
                  display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
                }}>
                  <span>{g.category.toUpperCase()}</span>
                  {getGoalIdentities(g).filter(id => id !== g.category).map(id => {
                    const meta = CAT_META[id];
                    if (!meta) return null;
                    return (
                      <span
                        key={id}
                        title={`Also votes for ${id}`}
                        style={{
                          color: meta.accent,
                          fontSize: 10,
                          lineHeight: 1,
                          opacity: 0.85,
                        }}
                      >{meta.symbol}</span>
                    );
                  })}
                  <span>
                    {isWeekly
                      ? ` · ${thisWeekCnt}/${freq}/wk${streak > 1 ? ` · ${streak}W STK` : ""}`
                      : streak > 1 ? ` · ${streak}D STK` : ""}
                  </span>
                </div>
                {g.anchor?.cue && (
                  <div style={{
                    fontSize: 10, color: accent,
                    marginTop: 3, fontStyle: "italic",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    opacity: isDoneToday ? 0.5 : 0.9,
                    transition: "opacity 0.2s",
                  }}>
                    ◆ {g.anchor.cue}
                  </div>
                )}
              </div>

              {/* XP badge */}
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11, fontWeight: 700,
                padding: "3px 9px", borderRadius: 4,
                flexShrink: 0,
                color: isDone
                  ? "var(--green)"
                  : isHovered ? "#fff" : "var(--accent)",
                background: isDone
                  ? "rgba(34,197,94,0.12)"
                  : isHovered ? "var(--accent)"
                  : "rgba(59,130,246,0.08)",
                border: `1px solid ${
                  isDone ? "rgba(34,197,94,0.25)"
                  : isHovered ? "var(--accent)"
                  : "rgba(59,130,246,0.18)"
                }`,
                transition: "all 0.15s",
                boxShadow: isDone
                  ? "0 0 8px rgba(34,197,94,0.3)"
                  : isHovered ? "0 0 12px rgba(59,130,246,0.4)" : "none",
                animation: isFlash ? "popIn 0.3s var(--easing-spring)" : "none",
                whiteSpace: "nowrap",
              }}>
                {isDone
                  ? "DONE"
                  : isWeekly
                  ? `${thisWeekCnt}/${freq}`
                  : `+${g.template && g.difficulty ? calcBaseXP(g.template, g.difficulty, g.category, "habitual") : (g.weight || 10)}`}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Quit Habits section ── */}
      {quitGoals.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-light)" }}>
          <p style={{ ...S.panelLbl, marginBottom: 8 }}>Quit Habits</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {quitGoals.map(g => {
              const checked    = state.lastCompletions?.[g.id] === t;
              const slippedToday = checked && (g.succumbLog || []).slice(-1)[0] === t;
              const resistedToday = checked && !slippedToday;

              const lastWeek = new Date();
              lastWeek.setDate(lastWeek.getDate() - 7);
              const weeklySlips = (g.succumbLog || []).filter(d => new Date(d) >= lastWeek).length;

              return (
                <div key={g.id} style={{
                  padding: "10px 12px",
                  background: resistedToday ? "rgba(34,197,94,0.05)" : slippedToday ? "rgba(239,68,68,0.05)" : "rgba(167,139,250,0.05)",
                  border: `1px solid ${resistedToday ? "rgba(34,197,94,0.2)" : slippedToday ? "rgba(239,68,68,0.2)" : "rgba(167,139,250,0.2)"}`,
                  borderLeft: "3px solid #A78BFA",
                  borderRadius: 6,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>{g.name}</div>
                      <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                        {g.currentStreak || 0}D STREAK · BEST {g.bestStreak || 0}D
                        {weeklySlips > 0 ? ` · ${weeklySlips} SLIP${weeklySlips !== 1 ? "S" : ""}/WK` : ""}
                      </div>
                    </div>
                    {checked ? (
                      <span style={{
                        fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "0.06em",
                        color: resistedToday ? "var(--green)" : "var(--red)",
                        background: resistedToday ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                        border: `1px solid ${resistedToday ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                        padding: "2px 7px", borderRadius: 4,
                      }}>
                        {resistedToday ? "RESISTED" : "SLIPPED"}
                      </span>
                    ) : (
                      <div style={{ display: "flex", gap: 5 }}>
                        <button
                          onClick={() => onResistQuit?.(g.id)}
                          style={{
                            fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)",
                            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                            color: "var(--green)", borderRadius: 4, padding: "3px 8px", cursor: "pointer",
                          }}
                        >✓ OK</button>
                        <button
                          onClick={() => onSuccumbQuit?.(g.id)}
                          style={{
                            fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)",
                            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                            color: "var(--red)", borderRadius: 4, padding: "3px 8px", cursor: "pointer",
                          }}
                        >✗ Slipped</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add habit shortcut */}
      {(habits.length > 0 || quitGoals.length > 0) && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-light)" }}>
          <button
            onClick={onGoToGoals}
            style={{
              ...S.ghostBtn,
              width: "100%",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.04em",
              textAlign: "center",
            }}
          >
            + Add / manage goals
          </button>
        </div>
      )}
    </div>
  );
}
