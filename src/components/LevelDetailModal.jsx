import { CAT_META, CATEGORIES } from "../constants";
import { calcBaseXP } from "../utils";
import { S } from "../styles";
import RadarChart from "./RadarChart";

function computeStats(level) {
  const habits     = (level.goals || []).filter(g => g.type === "habitual");
  const milestones = (level.goals || []).filter(g => g.type === "milestone");

  const habitStats = habits.map(g => {
    const count = (g.completions || []).length;
    const xpEach = (g.template && g.difficulty)
      ? calcBaseXP(g.template, g.difficulty, g.category, "habitual")
      : (g.weight || 10);
    return { ...g, count, totalXP: count * xpEach };
  });

  const milestoneStats = milestones.map(g => {
    const doneSteps  = (g.milestoneSteps || []).filter(s => s.completed).length;
    const totalSteps = (g.milestoneSteps || []).length;
    let earnedXP;
    if (g.template && g.difficulty) {
      const totalXP = calcBaseXP(g.template, g.difficulty, g.category, "milestone");
      earnedXP = totalSteps > 0 ? Math.round(totalXP * doneSteps / totalSteps) : 0;
    } else {
      earnedXP = (g.milestoneSteps || []).filter(s => s.completed).reduce((s, step) => s + (step.weight || 20), 0);
    }
    return { ...g, doneSteps, totalSteps, complete: totalSteps > 0 && doneSteps === totalSteps, earnedXP };
  });

  const totalXP              = habitStats.reduce((s, g) => s + g.totalXP, 0) + milestoneStats.reduce((s, g) => s + g.earnedXP, 0);
  const completedMilestones  = milestoneStats.filter(g => g.complete).length;
  const totalHabitCompletions = habitStats.reduce((s, g) => s + g.count, 0);

  const catXP = {};
  habitStats.forEach(g => { catXP[g.category] = (catXP[g.category] || 0) + g.totalXP; });
  milestoneStats.forEach(g => { catXP[g.category] = (catXP[g.category] || 0) + g.earnedXP; });

  return { habitStats, milestoneStats, totalXP, completedMilestones, totalHabitCompletions, catXP };
}

export default function LevelDetailModal({ level, onClose }) {
  const { habitStats, milestoneStats, totalXP, completedMilestones, totalHabitCompletions, catXP } = computeStats(level);
  const started = new Date(level.startedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

  // Build catScores map for radar (use catXP, fill missing categories with 0)
  const radarScores = Object.fromEntries(CATEGORIES.map(c => [c, catXP[c] || 0]));
  const hasActivity = Object.values(radarScores).some(v => v > 0);

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        animation: "fadeIn 0.2s ease",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)",
        width: "100%", maxWidth: 580,
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "var(--shadow-lg), 0 0 40px rgba(59,130,246,0.08)",
        animation: "scaleIn 0.3s var(--easing-spring)",
      }}>

        {/* Header */}
        <div style={{
          padding: "22px 24px 16px",
          borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0,
          background: "var(--surface)",
          zIndex: 1,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ ...S.eyebrow, marginBottom: 4 }}>Level {level.num}</p>
              <h2 style={{ fontSize: 22, fontWeight: 300, color: "var(--text-primary)", fontFamily: "'Instrument Serif', serif", letterSpacing: "-0.01em" }}>
                {level.title || "Untitled"}
              </h2>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", marginTop: 4 }}>
                Started {started}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "var(--surface-2)", border: "1px solid var(--border)",
                width: 28, height: 28, borderRadius: 4,
                fontSize: 14, color: "var(--text-secondary)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >×</button>
          </div>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>

          {/* ── Radar + Summary ──────────────────────────────── */}
          {hasActivity && (
            <div style={{
              display: "flex", gap: 16, alignItems: "center",
              padding: "16px 18px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
            }}>
              <div style={{ flexShrink: 0 }}>
                <RadarChart catScores={radarScores} size={130} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <SummaryCard label="Total XP" value={totalXP} color="var(--accent)" glow />
                <SummaryCard label="Habit Completions" value={totalHabitCompletions} />
                <SummaryCard
                  label={`Milestones ${completedMilestones}/${milestoneStats.length}`}
                  value={milestoneStats.length > 0
                    ? `${Math.round((completedMilestones / milestoneStats.length) * 100)}%`
                    : "—"}
                  color={completedMilestones === milestoneStats.length && milestoneStats.length > 0
                    ? "var(--green)" : "var(--text-primary)"}
                  glow={completedMilestones === milestoneStats.length && milestoneStats.length > 0}
                />
              </div>
            </div>
          )}

          {/* Fallback summary if no activity */}
          {!hasActivity && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              <SummaryCard label="Total XP" value={totalXP} color="var(--accent)" glow />
              <SummaryCard label="Habit Completions" value={totalHabitCompletions} />
              <SummaryCard label={`Milestones ${completedMilestones}/${milestoneStats.length}`} value={milestoneStats.length > 0 ? `${Math.round((completedMilestones / milestoneStats.length) * 100)}%` : "—"} />
            </div>
          )}

          {/* Category XP breakdown */}
          {Object.keys(catXP).length > 0 && (
            <Section label="XP by Dimension">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {CATEGORIES.filter(c => catXP[c] > 0).map(cat => {
                  const maxXP = Math.max(...Object.values(catXP));
                  const pct = Math.round((catXP[cat] / maxXP) * 100);
                  return (
                    <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ color: CAT_META[cat].accent, fontSize: 12, width: 16, textAlign: "center", flexShrink: 0 }}>
                        {CAT_META[cat].symbol}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", width: 90, fontFamily: "var(--font-mono)", letterSpacing: "0.04em", flexShrink: 0 }}>
                        {cat.toUpperCase()}
                      </span>
                      <div style={{ flex: 1, height: 3, background: "var(--border)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: CAT_META[cat].accent, borderRadius: 2, boxShadow: `0 0 6px ${CAT_META[cat].accent}80` }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontWeight: 600, width: 42, textAlign: "right", flexShrink: 0 }}>
                        {catXP[cat]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Habits */}
          {habitStats.length > 0 && (
            <Section label={`Habits · ${habitStats.length}`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {habitStats.map(g => (
                  <div key={g.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    background: g.count > 0 ? "rgba(34,197,94,0.04)" : "var(--surface-2)",
                    border: `1px solid ${g.count > 0 ? "rgba(34,197,94,0.15)" : "var(--border)"}`,
                    borderLeft: `2px solid ${CAT_META[g.category]?.accent || "var(--border)"}`,
                    borderRadius: 6,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {g.name}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", marginTop: 2 }}>
                        {g.category.toUpperCase()}
                        {g.template ? ` · ${g.template.toUpperCase()} · ${g.difficulty?.toUpperCase()}` : ""}
                        {g.locked ? " · ⚿" : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: g.count > 0 ? "var(--green)" : "var(--text-tertiary)" }}>
                        ×{g.count}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                        +{g.totalXP} XP
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Milestones */}
          {milestoneStats.length > 0 && (
            <Section label={`Milestones · ${milestoneStats.length}`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {milestoneStats.map(g => (
                  <div key={g.id} style={{
                    padding: "12px 14px",
                    background: g.complete ? "rgba(34,197,94,0.04)" : "var(--surface-2)",
                    border: `1px solid ${g.complete ? "rgba(34,197,94,0.15)" : "var(--border)"}`,
                    borderLeft: `2px solid ${CAT_META[g.category]?.accent || "var(--border)"}`,
                    borderRadius: 6,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: g.totalSteps > 0 ? 8 : 0 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{g.name}</div>
                        <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", marginTop: 2 }}>
                          {g.category.toUpperCase()} · {g.doneSteps}/{g.totalSteps} STEPS
                          {g.template ? ` · ${g.template.toUpperCase()}` : ""}
                          {g.locked ? " · ⚿" : ""}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
                        color: g.complete ? "var(--green)" : "var(--text-tertiary)",
                        background: g.complete ? "rgba(34,197,94,0.12)" : "var(--surface-2)",
                        border: `1px solid ${g.complete ? "rgba(34,197,94,0.25)" : "var(--border)"}`,
                        padding: "2px 8px", borderRadius: 4, letterSpacing: "0.06em",
                        boxShadow: g.complete ? "0 0 8px rgba(34,197,94,0.3)" : "none",
                        flexShrink: 0,
                      }}>
                        {g.complete ? "COMPLETE" : `${g.doneSteps}/${g.totalSteps}`}
                      </span>
                    </div>
                    {g.totalSteps > 0 && (
                      <div style={{ height: 3, background: "var(--border)", borderRadius: 2 }}>
                        <div style={{
                          height: "100%",
                          width: `${Math.round((g.doneSteps / g.totalSteps) * 100)}%`,
                          background: g.complete ? "var(--green)" : CAT_META[g.category]?.accent || "var(--accent)",
                          borderRadius: 2,
                          boxShadow: g.complete ? "0 0 8px rgba(34,197,94,0.5)" : "none",
                        }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Category intentions */}
          {CATEGORIES.some(c => level.categoryGoals?.[c]) && (
            <Section label="Intentions">
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {CATEGORIES.filter(c => level.categoryGoals?.[c]).map(cat => (
                  <div key={cat} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ color: CAT_META[cat].accent, fontSize: 13, flexShrink: 0, marginTop: 1 }}>
                      {CAT_META[cat].symbol}
                    </span>
                    <div>
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.06em" }}>
                        {cat.toUpperCase()} ·{" "}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {level.categoryGoals[cat]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {habitStats.length === 0 && milestoneStats.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", textAlign: "center", padding: "20px 0" }}>
              No goals were recorded for this level.
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
      <p style={{ ...S.panelLbl, marginBottom: 10 }}>{label}</p>
      {children}
    </div>
  );
}

function SummaryCard({ label, value, color = "var(--text-primary)", glow = false }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-sm)",
      padding: "8px 10px",
    }}>
      <div style={{
        fontSize: 18, fontWeight: 700,
        fontFamily: "var(--font-mono)",
        color,
        letterSpacing: "-0.02em",
        textShadow: glow ? `0 0 12px ${color}80` : "none",
        marginBottom: 2,
      }}>{value}</div>
      <div style={{
        fontSize: 8, color: "var(--text-tertiary)",
        fontFamily: "var(--font-mono)", letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}>{label}</div>
    </div>
  );
}
