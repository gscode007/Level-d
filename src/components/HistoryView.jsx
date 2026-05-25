import { useState } from "react";
import { CATEGORIES, CAT_META, RANK_COLOR } from "../constants";
import { S } from "../styles";
import { useIsMobile } from "../hooks/useIsMobile";
import LevelDetailModal from "./LevelDetailModal";

export default function HistoryView({ state }) {
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState(null);

  return (
    <div style={{ ...S.page, maxWidth: "none", padding: isMobile ? "20px 14px 24px" : S.page.padding }}>
      <header style={{ marginBottom: 32 }}>
        <p style={S.eyebrow}>Records</p>
        <h1 style={S.pageH1}>History</h1>
      </header>

      {/* All-time scores */}
      <div style={{ ...S.panel, marginBottom: 10 }}>
        <p style={S.panelLbl}>All-time scores</p>
        {CATEGORIES.map(cat => {
          const score = state.catScores[cat] || 0;
          const rank  = state.catRanks[cat] || "E";
          return (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{ width: 16, fontSize: 12, color: CAT_META[cat].accent, flexShrink: 0, textAlign: "center" }}>
                {CAT_META[cat].symbol}
              </span>
              <span style={{
                width: isMobile ? 60 : 90, fontSize: 10, color: "var(--text-secondary)",
                letterSpacing: "0.06em", fontFamily: "var(--font-mono)",
                textTransform: "uppercase", flexShrink: 0,
              }}>
                {isMobile ? cat.slice(0, 3) : cat}
              </span>
              <div style={{ flex: 1, height: 2, background: "var(--border)", borderRadius: 1 }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(100, (score / 1400) * 100)}%`,
                  background: CAT_META[cat].accent,
                  borderRadius: 1,
                  transition: "width 0.6s var(--easing-out)",
                  boxShadow: `0 0 8px ${CAT_META[cat].accent}`,
                }} />
              </div>
              <span style={{
                width: 44, fontSize: 12, color: "var(--text-primary)",
                textAlign: "right", fontVariantNumeric: "tabular-nums",
                fontFamily: "var(--font-mono)", fontWeight: 600,
              }}>
                {score}
              </span>
              <span style={{
                width: 22, fontSize: 11, fontWeight: 700,
                color: RANK_COLOR[rank], textAlign: "right",
                letterSpacing: "0.06em", fontFamily: "var(--font-mono)",
                textShadow: `0 0 8px ${RANK_COLOR[rank]}60`,
              }}>
                {rank}
              </span>
            </div>
          );
        })}
      </div>

      {/* Level list — clickable */}
      <div style={S.panel}>
        <p style={S.panelLbl}>Levels · click to inspect</p>
        {state.levels.map((lv, i) => {
          const isCurrent = lv.id === state.currentLevelId;
          const habitCount = (lv.goals || []).filter(g => g.type === "habitual").length;
          const milestoneCount = (lv.goals || []).filter(g => g.type === "milestone").length;
          const totalCompletions = (lv.goals || [])
            .filter(g => g.type === "habitual")
            .reduce((s, g) => s + (g.completions || []).length, 0);

          return (
            <div
              key={lv.id}
              onClick={() => setSelected(lv)}
              style={{
                display: "flex", gap: 14, alignItems: "center",
                paddingBottom: i < state.levels.length - 1 ? 14 : 0,
                borderBottom: i < state.levels.length - 1 ? "1px solid var(--border-light)" : "none",
                marginBottom: i < state.levels.length - 1 ? 14 : 0,
                cursor: "pointer",
                borderRadius: 6,
                padding: "10px 8px",
                margin: i < state.levels.length - 1 ? "0 -8px" : "0 -8px 0",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface-2)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {/* Level badge */}
              <div style={{
                width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                background: isCurrent ? "var(--accent-dim)" : "var(--surface-2)",
                border: `1px solid ${isCurrent ? "var(--accent)" : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                color: isCurrent ? "var(--accent)" : "var(--text-tertiary)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em",
                boxShadow: isCurrent ? "0 0 10px rgba(59,130,246,0.25)" : "none",
              }}>
                {i + 1}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                    {lv.title || "Untitled"}
                  </span>
                  {isCurrent && (
                    <span style={{
                      fontSize: 8, fontFamily: "var(--font-mono)", fontWeight: 700,
                      color: "var(--accent)", background: "var(--accent-dim)",
                      border: "1px solid var(--accent)", padding: "1px 5px", borderRadius: 3,
                      letterSpacing: "0.08em",
                    }}>ACTIVE</span>
                  )}
                </div>
                <div style={{
                  fontSize: 10, color: "var(--text-tertiary)", marginTop: 3,
                  fontFamily: "var(--font-mono)", letterSpacing: "0.05em",
                }}>
                  {habitCount}H · {milestoneCount}M · {totalCompletions} completions
                  {" · "}
                  {new Date(lv.startedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()}
                </div>
              </div>

              {/* Chevron */}
              <span style={{ color: "var(--text-tertiary)", fontSize: 12, flexShrink: 0 }}>›</span>
            </div>
          );
        })}
      </div>

      {selected && (
        <LevelDetailModal level={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
