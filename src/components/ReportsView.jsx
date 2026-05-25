import { useState, useMemo } from "react";
import { CAT_META, CATEGORIES } from "../constants";
import { S } from "../styles";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  dayRange, weekRange, monthRange,
  aggregateRange, evaluateBadges, currentActiveRun, noteThemes,
} from "../reports";

const PERIODS = [
  { id: "day",   label: "Day",   range: dayRange },
  { id: "week",  label: "Week",  range: weekRange },
  { id: "month", label: "Month", range: monthRange },
];

export default function ReportsView({ state }) {
  const isMobile = useIsMobile();
  const [period, setPeriod] = useState("week");
  const [offset, setOffset] = useState(0);

  const cfg = PERIODS.find(p => p.id === period);
  const { start, end, label } = useMemo(() => cfg.range(offset), [cfg, offset]);
  const report = useMemo(() => aggregateRange(state, start, end), [state, start, end]);
  const badges = useMemo(() => evaluateBadges(state), [state]);
  const activeRun = useMemo(() => currentActiveRun(state), [state]);
  const { themes, totalNotes } = useMemo(() => noteThemes(state), [state]);

  const earnedCount = badges.filter(b => b.earned).length;
  const maxXP = Math.max(1, ...CATEGORIES.map(c => report.catXP[c] || 0));

  function switchPeriod(id) {
    setPeriod(id);
    setOffset(0);
  }

  return (
    <div style={{ ...S.page, maxWidth: "none", padding: isMobile ? "20px 14px 24px" : S.page.padding }}>
      <header style={{ marginBottom: 24 }}>
        <p style={S.eyebrow}>Snapshot</p>
        <h1 style={S.pageH1}>Reports</h1>
      </header>

      {/* Period selector */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 14,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 3,
        width: "fit-content",
      }}>
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => switchPeriod(p.id)}
            style={{
              background: period === p.id ? "var(--accent-dim)" : "transparent",
              border: `1px solid ${period === p.id ? "var(--accent)" : "transparent"}`,
              color: period === p.id ? "var(--accent)" : "var(--text-tertiary)",
              fontSize: 11, fontFamily: "var(--font-mono)",
              padding: "6px 14px",
              borderRadius: 5,
              cursor: "pointer",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              transition: "all 0.15s",
            }}
          >{p.label}</button>
        ))}
      </div>

      {/* Range nav */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
      }}>
        <button
          onClick={() => setOffset(o => o - 1)}
          style={navArrow}
        >‹</button>
        <div style={{
          fontSize: 12, fontFamily: "var(--font-mono)",
          color: "var(--text-secondary)", letterSpacing: "0.04em",
          minWidth: 130,
        }}>{label}</div>
        <button
          onClick={() => setOffset(o => Math.min(0, o + 1))}
          disabled={offset >= 0}
          style={{ ...navArrow, opacity: offset >= 0 ? 0.35 : 1, cursor: offset >= 0 ? "default" : "pointer" }}
        >›</button>
      </div>

      {/* Summary stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        gap: 8, marginBottom: 12,
      }}>
        <StatCard label="Total XP"      value={report.totalXP}      hint={report.topCategory ? `${report.topCategory} led` : "—"} />
        <StatCard label="Completions"   value={report.completions}  hint={`${report.resists} resists`} />
        <StatCard label="Active days"   value={`${report.activeDays}/${report.totalDays}`} hint={pctLabel(report.activeDays, report.totalDays)} />
        <StatCard label="Current streak" value={`${activeRun}D`}     hint={activeRun >= 7 ? "fire" : "keep going"} accent />
      </div>

      {/* Per-category XP bars */}
      <div style={{ ...S.panel, marginBottom: 10 }}>
        <p style={S.panelLbl}>XP by category · {label.toLowerCase()}</p>
        {report.totalXP === 0 ? (
          <EmptyHint>No XP in this period yet.</EmptyHint>
        ) : (
          CATEGORIES.map(cat => {
            const xp = report.catXP[cat] || 0;
            if (xp === 0) return null;
            return (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ width: 16, fontSize: 12, color: CAT_META[cat].accent, textAlign: "center", flexShrink: 0 }}>
                  {CAT_META[cat].symbol}
                </span>
                <span style={{
                  width: isMobile ? 70 : 100, fontSize: 10, color: "var(--text-secondary)",
                  letterSpacing: "0.06em", fontFamily: "var(--font-mono)",
                  textTransform: "uppercase", flexShrink: 0,
                }}>
                  {isMobile ? cat.slice(0, 4) : cat}
                </span>
                <div style={{ flex: 1, height: 2, background: "var(--border)", borderRadius: 1 }}>
                  <div style={{
                    height: "100%",
                    width: `${(xp / maxXP) * 100}%`,
                    background: CAT_META[cat].accent,
                    borderRadius: 1,
                    transition: "width 0.6s var(--easing-out)",
                    boxShadow: `0 0 8px ${CAT_META[cat].accent}`,
                  }} />
                </div>
                <span style={{
                  width: 48, fontSize: 12, color: "var(--text-primary)",
                  textAlign: "right", fontVariantNumeric: "tabular-nums",
                  fontFamily: "var(--font-mono)", fontWeight: 600,
                }}>
                  +{xp}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Top goals in period */}
      {report.perGoal.length > 0 && (
        <div style={{ ...S.panel, marginBottom: 10 }}>
          <p style={S.panelLbl}>Top goals</p>
          {report.perGoal.slice(0, 5).map(({ goal, count }) => (
            <div key={goal.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 0",
              borderBottom: "1px solid var(--border-light)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: CAT_META[goal.category]?.accent || "var(--text-tertiary)" }}>
                  {CAT_META[goal.category]?.symbol || "•"}
                </span>
                <span style={{
                  fontSize: 13, color: "var(--text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {goal.name || "Untitled"}
                </span>
              </div>
              <span style={{
                fontSize: 11, color: "var(--text-tertiary)",
                fontFamily: "var(--font-mono)", fontWeight: 600,
              }}>
                ×{count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Note themes */}
      {totalNotes > 0 && (
        <div style={{ ...S.panel, marginBottom: 10 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            marginBottom: 14,
          }}>
            <p style={{ ...S.panelLbl, marginBottom: 0 }}>Themes in your notes</p>
            <span style={{
              fontSize: 10, color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
            }}>
              LAST 30D · {totalNotes} NOTE{totalNotes !== 1 ? "S" : ""}
            </span>
          </div>
          {themes.length === 0 ? (
            <div style={{
              fontSize: 11, color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono)", letterSpacing: "0.02em",
            }}>
              Add a few more completion notes to surface recurring themes.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {themes.map(t => (
                <div
                  key={t.word}
                  title={t.sampleText}
                  style={{
                    padding: "5px 10px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-secondary)",
                    letterSpacing: "0.02em",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{ color: "var(--text-primary)" }}>{t.word}</span>
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>×{t.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Badges */}
      <div style={S.panel}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          marginBottom: 14,
        }}>
          <p style={{ ...S.panelLbl, marginBottom: 0 }}>Badges</p>
          <span style={{
            fontSize: 10, color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
          }}>
            {earnedCount}/{badges.length} EARNED
          </span>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 8,
        }}>
          {badges.map(b => <BadgeCard key={b.id} badge={b} />)}
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function StatCard({ label, value, hint, accent }) {
  return (
    <div style={{
      ...S.catCard,
      padding: "14px 14px",
      borderLeft: accent ? "2px solid var(--accent)" : "1px solid var(--border)",
    }}>
      <div style={{
        fontSize: 9, color: "var(--text-tertiary)",
        letterSpacing: "0.12em", textTransform: "uppercase",
        fontFamily: "var(--font-mono)", fontWeight: 600,
        marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 300,
        color: "var(--text-primary)",
        fontFamily: "'Instrument Serif', Georgia, serif",
        lineHeight: 1, marginBottom: 4,
        fontVariantNumeric: "tabular-nums",
      }}>{value}</div>
      <div style={{
        fontSize: 10, color: "var(--text-tertiary)",
        fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
      }}>{hint}</div>
    </div>
  );
}

function BadgeCard({ badge }) {
  const { icon, label, req, unit, value, earned, pct, group } = badge;
  return (
    <div style={{
      background: earned ? "var(--accent-dim)" : "var(--surface-2)",
      border: `1px solid ${earned ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 6,
      padding: "12px 14px",
      opacity: earned ? 1 : 0.7,
      boxShadow: earned ? "0 0 14px rgba(59,130,246,0.18)" : "none",
      transition: "all 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 4,
          background: earned ? "var(--accent)" : "var(--border)",
          color: earned ? "#fff" : "var(--text-tertiary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700,
          boxShadow: earned ? "0 0 10px rgba(59,130,246,0.5)" : "none",
        }}>{icon}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 12, fontWeight: 600,
            color: earned ? "var(--accent)" : "var(--text-secondary)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{label}</div>
          <div style={{
            fontSize: 9, color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>{group}</div>
        </div>
      </div>
      <div style={{ height: 2, background: "var(--border)", borderRadius: 1, marginBottom: 4 }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: earned ? "var(--accent)" : "var(--text-tertiary)",
          borderRadius: 1,
          transition: "width 0.6s var(--easing-out)",
        }} />
      </div>
      <div style={{
        fontSize: 10, color: "var(--text-tertiary)",
        fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
      }}>
        {value}/{req} {unit}
      </div>
    </div>
  );
}

function EmptyHint({ children }) {
  return (
    <div style={{
      fontSize: 12, color: "var(--text-tertiary)",
      fontFamily: "var(--font-mono)", letterSpacing: "0.02em",
      padding: "6px 0",
    }}>{children}</div>
  );
}

// ── Inline styles ──────────────────────────────────────────────────────────

const navArrow = {
  width: 28, height: 28,
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  color: "var(--text-secondary)",
  borderRadius: 5,
  cursor: "pointer",
  fontSize: 14,
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all 0.15s",
};

function pctLabel(active, total) {
  if (total === 0) return "—";
  const pct = Math.round((active / total) * 100);
  return `${pct}% on`;
}
