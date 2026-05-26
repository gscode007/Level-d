import { useState } from "react";
import { USER_CATEGORIES, CAT_META } from "../constants";
import { todayStr, calcBaseXP, getThisWeekCount, canEditGoal, editWindowHoursLeft } from "../utils";
import { S } from "../styles";
import { useIsMobile } from "../hooks/useIsMobile";
import AddSheet from "./AddSheet";
import AgentSuggestModal from "./AgentSuggestModal";
import EmptyHint from "./EmptyHint";
import HabitCalendar from "./HabitCalendar";
import QuitCalendar from "./QuitCalendar";

export default function GoalsView({
  level, state, onAddGoal, onAddGoals, onDeleteGoal, onEditGoal,
  editingGoalId, setEditingGoalId,
  onCompleteHabitual, onCompleteMilestoneStep,
  onResistQuit, onSuccumbQuit,
  addOpen, setAddOpen, addType, setAddType,
  aiAgentEnabled,
}) {
  const [agentOpen, setAgentOpen] = useState(false);
  const editingGoal = editingGoalId
    ? level.goals.find(g => g.id === editingGoalId)
    : null;
  const hoursLeft = editWindowHoursLeft(level);
  const showEditBanner = hoursLeft > 0 && level.goals.some(g => g.locked);
  const isMobile = useIsMobile();
  const [tab, setTab]             = useState("habitual");
  const [calendarGoal, setCalendarGoal]     = useState(null);
  const [quitCalendarGoal, setQuitCalendarGoal] = useState(null);
  const t = todayStr();

  const habitual  = level.goals.filter(g => g.type === "habitual"   && g.category !== "Resilience");
  const milestones = level.goals.filter(g => g.type === "milestone"  && g.category !== "Resilience");
  const quitGoals = level.goals.filter(g => g.type === "quitHabit");

  const today = new Date();
  const lastWeek = new Date(); lastWeek.setDate(lastWeek.getDate() - 7);

  return (
    <div style={{ ...S.page, maxWidth: "none", padding: isMobile ? "20px 14px 24px" : S.page.padding }}>
      <header style={{ ...S.pageHead, marginBottom: isMobile ? 16 : S.pageHead.marginBottom }}>
        <div style={{ minWidth: 0 }}>
          <p style={S.eyebrow}>Level {level.num} · {level.title}</p>
          <h1 style={{ ...S.pageH1, fontSize: isMobile ? 24 : 30 }}>Goals</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <AgentButton enabled={aiAgentEnabled} onClick={() => setAgentOpen(true)} />
          <button style={S.addBtn} onClick={() => { setAddType(tab === "quit" ? "quitHabit" : tab); setAddOpen(true); }}>
            + Add
          </button>
        </div>
      </header>

      {showEditBanner && (
        <div style={{
          padding: "10px 14px", marginBottom: 14,
          background: "var(--accent-dim)",
          border: "1px solid var(--accent)",
          borderLeft: "2px solid var(--accent)",
          borderRadius: 6,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ color: "var(--accent)", fontSize: 12 }}>◆</span>
          <span style={{
            fontSize: 11, color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)", letterSpacing: "0.03em",
          }}>
            Edit window open · <span style={{ color: "var(--accent)", fontWeight: 700 }}>{hoursLeft}h left</span> to revise your initial goals
          </span>
        </div>
      )}

      {/* Category strip */}
      <div style={{
        ...S.catStrip,
        flexWrap: "nowrap",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        gap: isMobile ? 18 : 16,
        padding: isMobile ? "12px 14px" : S.catStrip.padding,
      }}>
        {USER_CATEGORIES.map(cat => (
          <div key={cat} style={{ display: "flex", alignItems: "flex-start", gap: 6, flexShrink: 0, minWidth: isMobile ? 90 : 120 }}>
            <span style={{ color: CAT_META[cat].accent, fontSize: 12, marginTop: 1, flexShrink: 0 }}>{CAT_META[cat].symbol}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                {cat}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: isMobile ? 80 : 120 }}>
                {level.categoryGoals?.[cat] || "—"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={S.tabRow}>
        {[
          ["habitual",  `Habits (${habitual.length})`],
          ["milestone", `Milestones (${milestones.length})`],
          ["quit",      `Quit (${quitGoals.length})`],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            ...S.tab,
            color: tab === id ? "var(--accent)" : "var(--text-tertiary)",
            borderBottom: tab === id ? "2px solid var(--accent)" : "2px solid transparent",
            fontWeight: tab === id ? 600 : 400,
            fontSize: 12, letterSpacing: "0.02em",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Habits tab ── */}
      {tab === "habitual" && (
        <div>
          {habitual.length === 0 && (
            <EmptyHint text="Daily habits earn XP every completion." onAdd={() => { setAddType("habitual"); setAddOpen(true); }} />
          )}
          {habitual.map(g => {
            const freq        = g.frequency || 7;
            const isWeekly    = freq < 7;
            const isDoneToday = state.lastCompletions[g.id] === t;
            const thisWeekCnt = isWeekly ? getThisWeekCount(g.completions || []) : 0;
            const weeklyMet   = isWeekly && thisWeekCnt >= freq;
            const isDone      = isWeekly ? weeklyMet : isDoneToday;
            const streak      = state.streaks[g.id] || 0;
            const xp          = g.template && g.difficulty ? calcBaseXP(g.template, g.difficulty, g.category, "habitual") : (g.weight || 10);
            return (
              <div key={g.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "13px 0", borderBottom: "1px solid var(--border-light)",
              }}>
                <div style={{ width: 4, height: 28, borderRadius: 2, background: CAT_META[g.category]?.accent || "var(--text-tertiary)", flexShrink: 0, opacity: isDone ? 0.3 : 1, transition: "opacity 0.2s" }} />

                {/* Clickable info → opens calendar */}
                <div
                  style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                  onClick={() => setCalendarGoal(g)}
                  title="View completion calendar"
                >
                  <div style={{
                    fontSize: 14,
                    color: isDone ? "var(--text-tertiary)" : "var(--text-primary)",
                    transition: "color 0.2s",
                    textDecoration: isDone ? "line-through" : "none",
                  }}>
                    {g.name}
                    {isWeekly && (
                      <span style={{ marginLeft: 8, fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, color: weeklyMet ? "var(--green)" : "var(--accent)", letterSpacing: "0.04em" }}>
                        {freq}×/WK
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3, letterSpacing: "0.06em", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 6 }}>
                    {g.category.toUpperCase()} · +{xp} XP
                    {isWeekly
                      ? ` · ${thisWeekCnt}/${freq} this week${streak > 1 ? ` · ${streak}W STK` : ""}`
                      : streak > 1 ? ` · ${streak}D STK` : ""}
                    <span style={{ fontSize: 8, color: "var(--text-tertiary)", opacity: 0.5 }}>📅</span>
                  </div>
                </div>

                <button
                  onClick={() => onCompleteHabitual(g.id)}
                  disabled={isDoneToday}
                  style={{
                    width: 26, height: 26, borderRadius: 4,
                    border: `1.5px solid ${isDoneToday ? "var(--green)" : weeklyMet ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                    background: isDoneToday ? "var(--green)" : "transparent",
                    color: isDoneToday ? "#fff" : "transparent",
                    cursor: isDoneToday ? "default" : "pointer",
                    fontSize: 11, fontWeight: 700, flexShrink: 0,
                    transition: "all 0.2s var(--easing-spring)",
                    boxShadow: isDoneToday ? "0 0 10px rgba(34,197,94,0.4)" : "none",
                  }}
                >✓</button>

                <GoalActions goal={g} level={level} onEdit={setEditingGoalId} onDelete={onDeleteGoal} />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Milestones tab ── */}
      {tab === "milestone" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {milestones.length === 0 && (
            <EmptyHint text="Define big objectives broken into steps." onAdd={() => { setAddType("milestone"); setAddOpen(true); }} />
          )}
          {milestones.map(g => {
            const doneCount = g.milestoneSteps.filter(s => s.completed).length;
            const total     = g.milestoneSteps.length;
            const pct       = total ? Math.round((doneCount / total) * 100) : 0;
            const totalXP   = g.template && g.difficulty
              ? calcBaseXP(g.template, g.difficulty, g.category, "milestone")
              : g.milestoneSteps.reduce((s, step) => s + (step.weight || 20), 0);
            return (
              <div key={g.id} style={{ ...S.mCard, borderLeft: `2px solid ${CAT_META[g.category]?.accent || "var(--accent)"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{g.name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3, letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>
                      {g.category.toUpperCase()} · {doneCount}/{total} · {pct}% · +{totalXP} XP
                    </div>
                  </div>
                  <GoalActions goal={g} level={level} onEdit={setEditingGoalId} onDelete={onDeleteGoal} />
                </div>

                <div style={{ height: 2, background: "var(--border)", borderRadius: 1, marginBottom: 12 }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: CAT_META[g.category]?.accent || "var(--accent)",
                    transition: "width 0.4s var(--easing-out)",
                    boxShadow: `0 0 8px ${CAT_META[g.category]?.accent || "var(--accent)"}`,
                  }} />
                </div>

                {g.milestoneSteps.map((step, i) => {
                  const stepXP = g.template && g.difficulty
                    ? Math.round(totalXP / g.milestoneSteps.length)
                    : (step.weight || 20);
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "7px 0",
                      borderBottom: i < g.milestoneSteps.length - 1 ? "1px solid var(--border-light)" : "none",
                    }}>
                      <button
                        onClick={() => onCompleteMilestoneStep(g.id, i)}
                        disabled={step.completed}
                        style={{
                          width: 18, height: 18, borderRadius: 3,
                          border: `1.5px solid ${step.completed ? "var(--accent)" : "var(--border)"}`,
                          background: step.completed ? "var(--accent)" : "transparent",
                          color: step.completed ? "#fff" : "transparent",
                          cursor: step.completed ? "default" : "pointer",
                          fontSize: 9, fontWeight: 700, flexShrink: 0,
                          transition: "all 0.2s var(--easing-spring)",
                          boxShadow: step.completed ? "0 0 8px rgba(59,130,246,0.4)" : "none",
                        }}
                      >✓</button>
                      <span style={{
                        fontSize: 13, color: step.completed ? "var(--text-tertiary)" : "var(--text-primary)",
                        flex: 1, transition: "color 0.2s", textDecoration: step.completed ? "line-through" : "none",
                      }}>{step.name}</span>
                      <span style={{ fontSize: 10, color: "var(--text-tertiary)", letterSpacing: "0.04em", fontFamily: "var(--font-mono)" }}>
                        +{stepXP}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Quit Habits tab ── */}
      {tab === "quit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {quitGoals.length === 0 && (
            <EmptyHint text="Track habits you're trying to quit. XP only for beating your best streak." onAdd={() => { setAddType("quitHabit"); setAddOpen(true); }} />
          )}
          {quitGoals.map(g => {
            const checked       = state.lastCompletions[g.id] === t;
            const slippedToday  = checked && (g.succumbLog || []).slice(-1)[0] === t;
            const resistedToday = checked && !slippedToday;
            const weeklySlips   = (g.succumbLog || []).filter(d => new Date(d) >= lastWeek).length;
            const curStreak     = g.currentStreak || 0;
            const bestStreak    = g.bestStreak || 0;
            const accent        = "#A78BFA";

            return (
              <div key={g.id} style={{
                padding: "14px 16px",
                background: resistedToday ? "rgba(34,197,94,0.04)" : slippedToday ? "rgba(239,68,68,0.04)" : "rgba(167,139,250,0.05)",
                border: `1px solid ${resistedToday ? "rgba(34,197,94,0.15)" : slippedToday ? "rgba(239,68,68,0.15)" : "rgba(167,139,250,0.18)"}`,
                borderLeft: `2px solid ${accent}`,
                borderRadius: 8,
              }}>
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div
                      style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 3, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                      onClick={() => setQuitCalendarGoal(g)}
                      title="View calendar"
                    >
                      {g.name}
                      <span style={{ fontSize: 8, color: "var(--text-tertiary)", opacity: 0.5 }}>📅</span>
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                      RESILIENCE · QUIT HABIT
                      {g.template ? ` · ${g.template.toUpperCase()} · ${g.difficulty?.toUpperCase()}` : ""}
                    </div>
                  </div>
                  <GoalActions goal={g} level={level} onEdit={setEditingGoalId} onDelete={onDeleteGoal} />
                </div>

                {/* Streak stats */}
                <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                  <StreakStat label="CURRENT" value={`${curStreak}D`} color={curStreak > 0 ? accent : "var(--text-tertiary)"} />
                  <StreakStat label="BEST" value={`${bestStreak}D`} color={accent} />
                  <StreakStat label="SLIPS / WEEK" value={weeklySlips} color={weeklySlips > 0 ? "var(--red)" : "var(--green)"} />
                </div>

                {/* XP info */}
                {bestStreak > 0 && curStreak <= bestStreak && !resistedToday && (
                  <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", marginBottom: 10 }}>
                    {curStreak < bestStreak
                      ? `${bestStreak - curStreak} more day${bestStreak - curStreak !== 1 ? "s" : ""} to beat your record`
                      : "One more day to set a new record!"}
                  </div>
                )}

                {/* Progress bar */}
                {bestStreak > 0 && (
                  <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 12 }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min(100, bestStreak > 0 ? Math.round((curStreak / bestStreak) * 100) : 0)}%`,
                      background: accent,
                      borderRadius: 2,
                      boxShadow: `0 0 6px ${accent}80`,
                      transition: "width 0.5s var(--easing-out)",
                    }} />
                  </div>
                )}

                {/* Check-in buttons */}
                {checked ? (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 10px", borderRadius: 6,
                    background: resistedToday ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                    border: `1px solid ${resistedToday ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                    fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
                    color: resistedToday ? "var(--green)" : "var(--red)",
                  }}>
                    {resistedToday ? "✓ RESISTED TODAY" : "✗ SLIPPED TODAY"}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => onResistQuit?.(g.id)}
                      style={{
                        flex: 1, padding: "8px 0", borderRadius: 6,
                        background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
                        color: "var(--green)", fontWeight: 700, fontFamily: "var(--font-mono)",
                        fontSize: 11, letterSpacing: "0.04em", cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >✓ Resisted Today</button>
                    <button
                      onClick={() => onSuccumbQuit?.(g.id)}
                      style={{
                        flex: 1, padding: "8px 0", borderRadius: 6,
                        background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
                        color: "var(--red)", fontWeight: 700, fontFamily: "var(--font-mono)",
                        fontSize: 11, letterSpacing: "0.04em", cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >✗ I Slipped</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <AddSheet
          type={addType}
          onAdd={g => { onAddGoal(g); setAddOpen(false); }}
          onClose={() => setAddOpen(false)}
        />
      )}

      {editingGoal && (
        <AddSheet
          type={editingGoal.type}
          editing={editingGoal}
          onUpdate={patch => { onEditGoal(editingGoal.id, patch); setEditingGoalId(null); }}
          onClose={() => setEditingGoalId(null)}
        />
      )}

      {calendarGoal && (
        <HabitCalendar goal={calendarGoal} onClose={() => setCalendarGoal(null)} />
      )}

      {quitCalendarGoal && (
        <QuitCalendar goal={quitCalendarGoal} onClose={() => setQuitCalendarGoal(null)} />
      )}

      {agentOpen && (
        <AgentSuggestModal
          level={level}
          existingGoalNames={level.goals.map(g => g.name)}
          onAddGoals={onAddGoals}
          onClose={() => setAgentOpen(false)}
        />
      )}
    </div>
  );
}

function AgentButton({ enabled, onClick }) {
  if (!enabled) {
    return (
      <button
        onClick={onClick}
        title="AI Agent is a Pro feature. Toggle the dev unlock in the sidebar."
        style={{
          padding: "9px 14px",
          fontSize: 12, fontWeight: 600,
          fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
          background: "transparent",
          color: "var(--text-tertiary)",
          border: "1px dashed var(--border)",
          borderRadius: 6,
          cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 8,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}
      >
        ◆ AI Agent
        <span style={{
          fontSize: 9, fontWeight: 700,
          background: "var(--surface-2)", border: "1px solid var(--border)",
          padding: "1px 5px", borderRadius: 3, letterSpacing: "0.08em",
        }}>PRO</span>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 14px",
        fontSize: 12, fontWeight: 600,
        fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
        background: "var(--accent-dim)",
        color: "var(--accent)",
        border: "1px solid var(--accent)",
        borderRadius: 6,
        cursor: "pointer",
        boxShadow: "0 0 12px var(--accent-glow)",
        transition: "all 0.15s",
      }}
    >
      ◆ AI Agent
    </button>
  );
}

function GoalActions({ goal, level, onEdit, onDelete }) {
  const editable = canEditGoal(goal, level);
  const hasAnchor = !!goal.anchor?.cue;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
      {hasAnchor && (
        <span title={goal.anchor.cue} style={{ fontSize: 10, color: "var(--accent)", padding: "2px 4px" }}>◆</span>
      )}
      {editable ? (
        <>
          <button
            onClick={() => onEdit(goal.id)}
            title="Edit goal"
            style={{
              ...S.delBtn,
              color: "var(--accent)",
              fontSize: 12,
            }}
          >✎</button>
          <button onClick={() => onDelete(goal.id)} title="Delete" style={S.delBtn}>✕</button>
        </>
      ) : (
        <>
          <button
            onClick={() => onEdit(goal.id)}
            title="Edit anchor & notes"
            style={{
              ...S.delBtn,
              color: "var(--text-tertiary)",
              fontSize: 12,
            }}
          >✎</button>
          <span title="Structural edits locked — anchor & notes still editable" style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", padding: "2px 4px" }}>⚿</span>
        </>
      )}
    </div>
  );
}

function StreakStat({ label, value, color = "var(--text-primary)" }) {
  return (
    <div>
      <div style={{ fontSize: 8, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}
