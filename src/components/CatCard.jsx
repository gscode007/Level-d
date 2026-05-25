import { CAT_META, RANK_COLOR } from "../constants";
import { getRankPct } from "../utils";

// Performance color based on progress % toward next rank
function perfColor(pct) {
  if (pct >= 66) return "var(--green)";
  if (pct >= 33) return "var(--yellow)";
  return "var(--red)";
}

export default function CatCard({ cat, score, rank, weight, statement, onClick }) {
  const { symbol, accent } = CAT_META[cat];
  const pct      = getRankPct(score, rank);
  const rankColor = RANK_COLOR[rank];
  const perf     = perfColor(pct);
  const isAuto   = cat === "Resilience";

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        padding: "16px 18px",
        border: "1px solid var(--border)",
        borderTop: `2px solid ${accent}`,
        boxShadow: `var(--shadow-sm), 0 0 18px ${perf}08`,
        position: "relative",
        overflow: "hidden",
        transition: "box-shadow 0.2s, border-color 0.2s, transform 0.15s",
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `var(--shadow-md), 0 0 28px ${accent}22`;
        e.currentTarget.style.borderColor = `${accent}60`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = `var(--shadow-sm), 0 0 18px ${perf}08`;
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {/* Faint category accent watermark */}
      <div style={{
        position: "absolute", right: -4, bottom: -8,
        fontSize: 48, color: accent, opacity: 0.06,
        fontWeight: 700, pointerEvents: "none", userSelect: "none",
        lineHeight: 1,
      }}>{symbol}</div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: accent, fontSize: 13 }}>{symbol}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, color: "var(--text-secondary)",
            letterSpacing: "0.1em", textTransform: "uppercase",
            fontFamily: "var(--font-mono)",
          }}>{cat}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {isAuto && (
            <span style={{
              fontSize: 7, fontWeight: 700, letterSpacing: "0.08em",
              fontFamily: "var(--font-mono)",
              color: "var(--text-tertiary)",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              padding: "1px 4px", borderRadius: 2,
            }}>AUTO</span>
          )}
          <span style={{
            fontSize: 9, fontWeight: 700, color: rankColor,
            padding: "2px 6px", borderRadius: 3,
            background: `${rankColor}12`,
            border: `1px solid ${rankColor}35`,
            letterSpacing: "0.08em",
            fontFamily: "var(--font-mono)",
            boxShadow: `0 0 8px ${rankColor}30`,
          }}>{rank}</span>
        </div>
      </div>

      {/* Identity statement — quiet line above the score */}
      {statement && (
        <div style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          fontStyle: "italic",
          marginBottom: 8,
          lineHeight: 1.35,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}>
          {statement}
        </div>
      )}

      {/* Score */}
      <div style={{
        fontSize: 30, fontWeight: 700,
        fontFamily: "var(--font-mono)",
        color: "var(--text-primary)",
        letterSpacing: "-0.03em",
        marginBottom: 10,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
      }}>
        {Math.round(score)}
      </div>

      {/* Progress bar — color coded */}
      <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginBottom: 7 }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: perf,
          borderRadius: 2,
          transition: "width 0.6s var(--easing-out)",
          boxShadow: `0 0 8px ${perf}90`,
        }} />
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{
          fontSize: 9, color: "var(--text-tertiary)",
          fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
        }}>
          {isAuto ? "CONSISTENCY" : `${weight}% WGT`}
        </span>
        <span style={{
          fontSize: 9, fontFamily: "var(--font-mono)",
          fontWeight: 700, color: perf, letterSpacing: "0.06em",
          textShadow: `0 0 6px ${perf}60`,
        }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}
