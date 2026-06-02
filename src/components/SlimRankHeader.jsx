import { RANK_COLOR } from "../constants";
import { getTier } from "../theme.config.js";

/**
 * Slim persistent rank header — the daily-game's compact summary of where the
 * user stands. Renders ABOVE the fold so the threshold bar + the single
 * next-action line are always glanceable; the full RankHero card lives down
 * in the Becoming zone for those who want the detail.
 *
 * Composition (per Phase 4 spec):
 *   - small glowing tier mark (celestial name + small letter chip)
 *   - thin threshold bar
 *   - one next-action line ("ready — advance" / "980 XP to Flare" / "Trial open")
 *
 * Phase 5 will refine the next-action line into a bottleneck-first message.
 * For now this is a minimal next-step indicator.
 *
 * Props mirror what App.jsx already pre-computes — this component reads no
 * state itself.
 */
export default function SlimRankHeader({
  rank,
  arcView,                // null when no arc; else { gates, nextRank, ... }
  overallScore,
  canAdvance = false,
  onAdvance,
  onExpand,               // tap-to-jump-to-full-detail (optional)
}) {
  const tier = getTier(rank);
  const rankColor = RANK_COLOR[rank] || "var(--accent)";

  // Gate progress %. Arc-active = XP gate of the current level; legacy
  // (no arc) = per-dimension overall rank progress fallback.
  let pct = 0;
  let nextActionLine;
  if (arcView) {
    const { current, required, met } = arcView.gates.xp;
    pct = Math.min(100, Math.round((current / Math.max(1, required)) * 100));
    if (canAdvance) {
      nextActionLine = `Threshold open — advance to ${getTier(arcView.nextRank || rank).name}`;
    } else if (!met) {
      const diff = Math.max(0, required - current);
      const nextName = arcView.nextRank ? getTier(arcView.nextRank).name : tier.name;
      nextActionLine = `${diff} XP to next threshold · ${nextName}`;
    } else {
      nextActionLine = "Trial in progress";
    }
  } else {
    nextActionLine = canAdvance ? "Threshold open — advance" : "Keep going";
  }

  return (
    <div
      onClick={onExpand}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `2px solid ${rankColor}`,
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
        marginBottom: 12,
        cursor: onExpand ? "pointer" : "default",
        display: "flex", alignItems: "center", gap: 14,
        boxShadow: `0 0 24px ${rankColor}08`,
      }}
    >
      {/* Tier mark (small) — celestial name + letter chip */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0 }}>
        <span style={{
          fontSize: 22, fontWeight: 300,
          fontFamily: "'Instrument Serif', Georgia, serif",
          color: rankColor, lineHeight: 1, letterSpacing: "-0.02em",
          textShadow: `0 0 14px ${rankColor}70`,
        }}>{tier.name}</span>
        <span style={{
          fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700,
          color: rankColor, letterSpacing: "0.06em",
          padding: "1px 5px", borderRadius: 3,
          background: `${rankColor}10`, border: `1px solid ${rankColor}30`,
        }}>{tier.rank}</span>
      </div>

      {/* Bar + next-action line */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden",
          marginBottom: 5,
        }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: `linear-gradient(90deg, ${rankColor}70, ${rankColor})`,
            borderRadius: 2,
            transition: "width 0.6s var(--easing-out)",
            boxShadow: `0 0 6px ${rankColor}60`,
          }} />
        </div>
        <div style={{
          fontSize: 10, fontFamily: "var(--font-mono)",
          color: canAdvance ? "var(--green)" : "var(--text-tertiary)",
          letterSpacing: "0.04em",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {nextActionLine}
        </div>
      </div>

      {/* Advance affordance — only when canAdvance */}
      {canAdvance && (
        <button
          onClick={(e) => { e.stopPropagation(); onAdvance?.(); }}
          style={{
            flexShrink: 0,
            background: "var(--green)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 11, fontWeight: 600,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.04em",
            cursor: "pointer",
            boxShadow: "0 2px 12px rgba(34,197,94,0.22)",
          }}
        >Advance →</button>
      )}
    </div>
  );
}
