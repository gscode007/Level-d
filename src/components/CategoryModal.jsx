import { CAT_META, RANK_COLOR, RANKS } from "../constants";
import { getRankPct, getNextThresh, calcBaseXP, getThisWeekCount, todayStr } from "../utils";

export default function CategoryModal({
  cat, score, rank, weight,
  level, state,
  onClose, onCompleteHabitual, onCompleteMilestoneStep,
}) {
  const { symbol, accent } = CAT_META[cat];
  const rankColor  = RANK_COLOR[rank];
  const pct        = getRankPct(score, rank);
  const nextThresh = getNextThresh(rank);
  const xpLeft     = nextThresh ? nextThresh - Math.round(score) : 0;
  const nextRank   = nextThresh ? RANKS[RANKS.indexOf(rank) + 1] : null;
  const isAuto     = cat === "Resilience";
  const t          = todayStr();

  const habits    = (level.goals || []).filter(g => g.type === "habitual"   && g.category === cat);
  const milestones = (level.goals || []).filter(g => g.type === "milestone" && g.category === cat);
  const quitGoals = (level.goals || []).filter(g => g.type === "quitHabit" && g.category === cat);

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        zIndex: 400,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "fadeIn 0.18s ease",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderTop: `2px solid ${accent}`,
        borderRadius: "var(--radius-xl)",
        width: "100%", maxWidth: 500,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: `var(--shadow-lg), 0 0 50px ${accent}18`,
        animation: "scaleIn 0.25s var(--easing-spring)",
      }}>

        {/* ── Sticky header ──────────────────────────────────────────── */}
        <div style={{
          padding: "20px 22px 18px",
          borderBottom: "1px solid var(--border)",
          background: `color-mix(in srgb, var(--surface) 92%, transparent)`,
          position: "sticky", top: 0, zIndex: 1,
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                background: `${accent}18`, border: `1px solid ${accent}45`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, color: accent,
                boxShadow: `0 0 22px ${accent}35`,
              }}>{symbol}</div>
              <div>
                <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: accent, letterSpacing: "0.1em", fontWeight: 700, marginBottom: 3 }}>
                  {isAuto ? "AUTO · CONSISTENCY" : `${weight}% WEIGHT`}
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{cat}</h2>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                fontSize: 15, fontWeight: 900, fontFamily: "var(--font-mono)",
                color: rankColor, padding: "4px 11px", borderRadius: 5,
                background: `${rankColor}18`, border: `1px solid ${rankColor}45`,
                boxShadow: `0 0 14px ${rankColor}45`, letterSpacing: "0.08em",
              }}>{rank}</span>
              <button onClick={onClose} style={{
                background: "var(--surface-2)", border: "1px solid var(--border)",
                width: 28, height: 28, borderRadius: 4, fontSize: 14,
                color: "var(--text-secondary)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>
            </div>
          </div>

          {/* Score + progress */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontSize: 34, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
                {Math.round(score)}
              </span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.04em" }}>
                {nextRank ? `${xpLeft.toLocaleString()} XP → ${nextRank}` : "MAX RANK"}
              </span>
            </div>
            <div style={{ height: 5, background: "var(--border)", borderRadius: 3 }}>
              <div style={{
                height: "100%", width: `${pct}%`,
                background: `linear-gradient(90deg, ${accent}80, ${accent})`,
                borderRadius: 3, boxShadow: `0 0 10px ${accent}80`,
                transition: "width 0.6s var(--easing-out)",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.06em" }}>RANK {rank}</span>
              <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: accent, fontWeight: 700 }}>{pct}% to {nextRank || "MAX"}</span>
            </div>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────── */}
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Resilience auto-info */}
          {isAuto && (
            <div style={{ padding: "12px 14px", background: `${accent}0d`, border: `1px solid ${accent}25`, borderRadius: 8 }}>
              <p style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: accent, letterSpacing: "0.06em", fontWeight: 700, marginBottom: 6 }}>
                HOW RESILIENCE WORKS
              </p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 8 }}>
                +5 XP automatically every time you complete any habit. Decays if you miss days — −2 XP on day 1, −3 on day 2, and so on.
              </p>
              <div style={{ display: "flex", gap: 16 }}>
                <MiniStat label="MISSED DAYS" value={state.consecutiveMissed || 0} color={state.consecutiveMissed > 0 ? "var(--red)" : "var(--green)"} />
                <MiniStat label="LAST HABIT" value={state.lastHabitDate ? new Date(state.lastHabitDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"} />
              </div>
            </div>
          )}

          {/* Habits */}
          {habits.length > 0 && (
            <Section label={`Habits · ${habits.length}`}>
              {habits.map(g => {
                const freq        = g.frequency || 7;
                const isWeekly    = freq < 7;
                const isDoneToday = state.lastCompletions?.[g.id] === t;
                const thisWeekCnt = isWeekly ? getThisWeekCount(g.completions || []) : 0;
                const weeklyMet   = isWeekly && thisWeekCnt >= freq;
                const isDone      = isWeekly ? weeklyMet : isDoneToday;
                const streak      = state.streaks?.[g.id] || 0;
                const xp          = g.template && g.difficulty
                  ? calcBaseXP(g.template, g.difficulty, g.category, "habitual")
                  : (g.weight || 10);
                const totalDone   = (g.completions || []).length;

                return (
                  <div key={g.id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 13px", marginBottom: 6,
                    background: isDone ? "rgba(34,197,94,0.05)" : `${accent}07`,
                    border: `1px solid ${isDone ? "rgba(34,197,94,0.18)" : `${accent}22`}`,
                    borderLeft: `2px solid ${isDone ? "var(--green)" : accent}`,
                    borderRadius: 7,
                    transition: "background 0.2s",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 500, marginBottom: 4,
                        color: isDone ? "var(--text-tertiary)" : "var(--text-primary)",
                        textDecoration: isDone ? "line-through" : "none",
                        display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap",
                      }}>
                        {g.name}
                        {isWeekly && <Tag color={accent}>{freq}×/WK</Tag>}
                        {g.locked && <Tag>⚿</Tag>}
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Info>+{xp} XP</Info>
                        {isWeekly
                          ? <Info>{thisWeekCnt}/{freq} this week</Info>
                          : streak > 0 ? <Info>{streak}D streak</Info> : null}
                        <Info>{totalDone} completions</Info>
                        {g.template && <Info>{g.template} · {g.difficulty}</Info>}
                      </div>
                    </div>
                    <button
                      onClick={() => !isDoneToday && onCompleteHabitual(g.id)}
                      disabled={isDoneToday}
                      style={{
                        width: 28, height: 28, borderRadius: 5, flexShrink: 0,
                        border: `1.5px solid ${isDoneToday ? "var(--green)" : "var(--border)"}`,
                        background: isDoneToday ? "var(--green)" : "transparent",
                        color: isDoneToday ? "#fff" : "transparent",
                        cursor: isDoneToday ? "default" : "pointer",
                        fontSize: 12, fontWeight: 700,
                        transition: "all 0.2s var(--easing-spring)",
                        boxShadow: isDoneToday ? "0 0 10px rgba(34,197,94,0.4)" : "none",
                      }}
                    >✓</button>
                  </div>
                );
              })}
            </Section>
          )}

          {/* Milestones */}
          {milestones.length > 0 && (
            <Section label={`Milestones · ${milestones.length}`}>
              {milestones.map(g => {
                const doneSteps = g.milestoneSteps.filter(s => s.completed).length;
                const total     = g.milestoneSteps.length;
                const milPct    = total ? Math.round((doneSteps / total) * 100) : 0;
                const totalXP   = g.template && g.difficulty
                  ? calcBaseXP(g.template, g.difficulty, g.category, "milestone")
                  : g.milestoneSteps.reduce((s, st) => s + (st.weight || 20), 0);
                const complete  = doneSteps === total && total > 0;

                return (
                  <div key={g.id} style={{
                    padding: "13px 14px", marginBottom: 8,
                    background: complete ? "rgba(34,197,94,0.04)" : `${accent}07`,
                    border: `1px solid ${complete ? "rgba(34,197,94,0.18)" : `${accent}22`}`,
                    borderLeft: `2px solid ${complete ? "var(--green)" : accent}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 3, display: "flex", alignItems: "center", gap: 7 }}>
                          {g.name}
                          {g.locked && <Tag>⚿</Tag>}
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <Info>{doneSteps}/{total} steps</Info>
                          <Info>+{totalXP} XP total</Info>
                          {g.template && <Info>{g.template} · {g.difficulty}</Info>}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)",
                        color: complete ? "var(--green)" : accent,
                        background: complete ? "rgba(34,197,94,0.12)" : `${accent}18`,
                        border: `1px solid ${complete ? "rgba(34,197,94,0.28)" : `${accent}38`}`,
                        padding: "2px 8px", borderRadius: 4, letterSpacing: "0.06em", flexShrink: 0,
                      }}>{complete ? "DONE" : `${milPct}%`}</span>
                    </div>

                    <div style={{ height: 2, background: "var(--border)", borderRadius: 1, marginBottom: 10 }}>
                      <div style={{
                        height: "100%", width: `${milPct}%`,
                        background: complete ? "var(--green)" : accent,
                        borderRadius: 1, boxShadow: `0 0 6px ${accent}80`,
                        transition: "width 0.4s var(--easing-out)",
                      }} />
                    </div>

                    {g.milestoneSteps.map((step, i) => {
                      const stepXP = g.template && g.difficulty
                        ? Math.round(totalXP / g.milestoneSteps.length)
                        : (step.weight || 20);
                      return (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "6px 0",
                          borderBottom: i < g.milestoneSteps.length - 1 ? "1px solid var(--border-light)" : "none",
                        }}>
                          <button
                            onClick={() => !step.completed && onCompleteMilestoneStep(g.id, i)}
                            disabled={step.completed}
                            style={{
                              width: 17, height: 17, borderRadius: 3, flexShrink: 0,
                              border: `1.5px solid ${step.completed ? accent : "var(--border)"}`,
                              background: step.completed ? accent : "transparent",
                              color: step.completed ? "#fff" : "transparent",
                              cursor: step.completed ? "default" : "pointer",
                              fontSize: 8, fontWeight: 700,
                              transition: "all 0.2s var(--easing-spring)",
                            }}
                          >✓</button>
                          <span style={{
                            flex: 1, fontSize: 12,
                            color: step.completed ? "var(--text-tertiary)" : "var(--text-primary)",
                            textDecoration: step.completed ? "line-through" : "none",
                          }}>{step.name}</span>
                          <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>+{stepXP}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </Section>
          )}

          {/* Quit habits */}
          {quitGoals.length > 0 && (
            <Section label={`Quit Habits · ${quitGoals.length}`}>
              {quitGoals.map(g => {
                const checked      = state.lastCompletions?.[g.id] === t;
                const slippedToday = checked && (g.succumbLog || []).slice(-1)[0] === t;
                const lastWeek     = new Date(); lastWeek.setDate(lastWeek.getDate() - 7);
                const weeklySlips  = (g.succumbLog || []).filter(d => new Date(d) >= lastWeek).length;
                return (
                  <div key={g.id} style={{
                    padding: "11px 13px", marginBottom: 6,
                    background: `${accent}07`, border: `1px solid ${accent}22`,
                    borderLeft: `2px solid ${accent}`, borderRadius: 7,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 5 }}>{g.name}</div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <MiniStat label="STREAK" value={`${g.currentStreak || 0}D`} color={accent} />
                      <MiniStat label="BEST" value={`${g.bestStreak || 0}D`} color={accent} />
                      <MiniStat label="SLIPS/WK" value={weeklySlips} color={weeklySlips > 0 ? "var(--red)" : "var(--green)"} />
                      {checked && (
                        <MiniStat
                          label="TODAY"
                          value={slippedToday ? "SLIPPED" : "RESISTED"}
                          color={slippedToday ? "var(--red)" : "var(--green)"}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </Section>
          )}

          {habits.length === 0 && milestones.length === 0 && quitGoals.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "24px 0", fontStyle: "italic" }}>
              No goals for {cat} this level.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <p style={{ fontSize: 9, fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10, fontFamily: "var(--font-mono)" }}>{label}</p>
      {children}
    </div>
  );
}

function Tag({ color = "var(--text-tertiary)", children }) {
  return (
    <span style={{ fontSize: 8, fontFamily: "var(--font-mono)", fontWeight: 700, color, letterSpacing: "0.06em", opacity: 0.85 }}>
      {children}
    </span>
  );
}

function Info({ children }) {
  return (
    <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
      {children}
    </span>
  );
}

function MiniStat({ label, value, color = "var(--text-primary)" }) {
  return (
    <div>
      <div style={{ fontSize: 8, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", color, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}
