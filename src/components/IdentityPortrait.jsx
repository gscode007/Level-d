import { USER_CATEGORIES, CAT_META } from "../constants";
import { getRank } from "../utils";
import { S } from "../styles";
import { useIsMobile } from "../hooks/useIsMobile";
import RadarChart from "./RadarChart";

/* ──────────────────────────────────────────────────────────────────────────
   IdentityPortrait — the dashboard's identity surface.
   Pairs the radar shape (the behavioral signal) with the identity statements
   the user wrote in onboarding. The connection between "who you claim to be"
   and "what your behavior shows" lives here.
   ────────────────────────────────────────────────────────────────────────── */

export default function IdentityPortrait({ level, state }) {
  const isMobile = useIsMobile();
  const radarSize = isMobile ? 200 : 240;

  // Strongest user-category identity — used for the becoming-line.
  // Skips Resilience since it's auto-managed, not an identity claim.
  const strongest = USER_CATEGORIES
    .map((c) => ({ cat: c, score: state.catScores?.[c] || 0 }))
    .sort((a, b) => b.score - a.score)[0];
  const strongestStatement = (level.categoryGoals?.[strongest.cat] || "").trim();

  return (
    <div style={{
      ...S.panel,
      marginBottom: 10,
      padding: isMobile ? "18px 16px" : "22px 26px",
    }}>
      {/* Header strip */}
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p style={S.panelLbl}>Identity Portrait</p>
        {strongest.score > 0 && (
          <span style={{
            fontSize: 10, color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
          }}>
            STRONGEST · <span style={{ color: CAT_META[strongest.cat]?.accent || "var(--accent)", fontWeight: 700 }}>
              {strongest.cat.toUpperCase()}
            </span>
          </span>
        )}
      </div>

      {/* Becoming-line: a single line summarizing the most visible identity */}
      {strongest.score > 0 && strongestStatement && (
        <p style={{
          fontSize: isMobile ? 14 : 16,
          fontStyle: "italic",
          color: "var(--text-secondary)",
          lineHeight: 1.4,
          marginBottom: 16,
        }}>
          Your behavior says you're <span style={{ color: CAT_META[strongest.cat]?.accent || "var(--accent)", fontWeight: 600 }}>
            {strongestStatement}
          </span>.
        </p>
      )}

      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 18 : 28,
        alignItems: isMobile ? "stretch" : "center",
      }}>
        {/* Radar */}
        <div style={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <RadarChart catScores={state.catScores} size={radarSize} />
        </div>

        {/* Identity list */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {USER_CATEGORIES.map((cat) => {
            const meta      = CAT_META[cat];
            const score     = state.catScores?.[cat] || 0;
            const rank      = state.catRanks?.[cat] || getRank(score);
            const statement = (level.categoryGoals?.[cat] || "").trim();
            return (
              <div key={cat} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "8px 10px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderLeft: `2px solid ${meta.accent}`,
                borderRadius: 6,
              }}>
                <span style={{ color: meta.accent, fontSize: 14, lineHeight: 1.2, flexShrink: 0 }}>
                  {meta.symbol}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: "var(--text-secondary)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontFamily: "var(--font-mono)",
                    }}>{cat}</span>
                    <span style={{
                      fontSize: 10, fontFamily: "var(--font-mono)",
                      fontWeight: 700, color: meta.accent,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {Math.round(score)} · {rank}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 12, fontStyle: "italic",
                    color: statement ? "var(--text-primary)" : "var(--text-tertiary)",
                    marginTop: 3, lineHeight: 1.35,
                    overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}>
                    {statement || "(no identity set)"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {strongest.score === 0 && (
        <p style={{
          marginTop: 14,
          fontSize: 11, color: "var(--text-tertiary)",
          fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
          textAlign: "center",
        }}>
          Complete habits to see your portrait take shape.
        </p>
      )}
    </div>
  );
}
