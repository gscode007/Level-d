import { USER_CATEGORIES, CAT_META } from "../constants";
import { getRank } from "../utils";
import { LABELS } from "../theme.config.js";
import styles from "../styles.module.css";
import { useIsMobile } from "../hooks/useIsMobile";
import RadarChart from "./RadarChart";

/* ──────────────────────────────────────────────────────────────────────────
   IdentityPortrait — the dashboard's identity surface, the long-loop's
   primary asset. Pairs the radar shape (behavioral signal) with the
   first-person identity statements the user wrote in setup.

   Phase 4 promotion: the "behavior says you're …" line is HERO copy —
   large serif, lands first, before any label or chart. This is the most
   original, least-derivative line in the app; it sets the tone.
   ────────────────────────────────────────────────────────────────────────── */

export default function IdentityPortrait({ level, state, historicalCatScores }) {
  const isMobile = useIsMobile();
  const radarSize = isMobile ? 200 : 240;

  const strongest = USER_CATEGORIES
    .map((c) => ({ cat: c, score: state.catScores?.[c] || 0 }))
    .sort((a, b) => b.score - a.score)[0];
  const strongestStatement = (level.categoryGoals?.[strongest.cat] || "").trim();
  const strongestAccent = CAT_META[strongest.cat]?.accent || "var(--accent)";
  const hasHero = strongest.score > 0 && strongestStatement;

  return (
    <div className={styles.panel} style={{
      marginBottom: 10,
      padding: isMobile ? "20px 16px" : "26px 28px",
    }}>
      {/* ── HERO IDENTITY LINE ────────────────────────────────────────────
          Phase 4: this used to be a 14-16px italic body line. Promoted to
          large serif, lands FIRST. The voice of the long loop. */}
      {hasHero ? (
        <div style={{ marginBottom: isMobile ? 18 : 22 }}>
          <p style={{
            fontSize: 9, fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)", letterSpacing: "0.14em",
            textTransform: "uppercase", fontWeight: 600,
            marginBottom: 8,
          }}>
            Strongest · <span style={{ color: strongestAccent, fontWeight: 700 }}>
              {strongest.cat}
            </span>
          </p>
          <p style={{
            fontSize: isMobile ? 22 : 28,
            fontWeight: 300,
            fontStyle: "italic",
            fontFamily: "'Instrument Serif', Georgia, serif",
            color: "var(--text-primary)",
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
          }}>
            Your behavior says you're{" "}
            <span style={{ color: strongestAccent, fontStyle: "italic", fontWeight: 400 }}>
              {strongestStatement}
            </span>.
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: isMobile ? 14 : 18 }}>
          <p style={{
            fontSize: 9, fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)", letterSpacing: "0.14em",
            textTransform: "uppercase", fontWeight: 600,
            marginBottom: 8,
          }}>
            Identity Portrait
          </p>
          <p style={{
            fontSize: isMobile ? 18 : 22,
            fontWeight: 300, fontStyle: "italic",
            fontFamily: "'Instrument Serif', Georgia, serif",
            color: "var(--text-tertiary)",
            lineHeight: 1.3,
          }}>
            Your portrait is waiting. Complete a habit to begin.
          </p>
        </div>
      )}

      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 18 : 28,
        alignItems: isMobile ? "stretch" : "center",
      }}>
        {/* Radar — current shape, optionally overlaid on a faint historical
            shape from `levelsBack` levels ago (Phase 10). */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <RadarChart
            catScores={state.catScores}
            compareScores={historicalCatScores?.scores}
            size={radarSize}
          />
          {historicalCatScores ? (
            <div style={{
              marginTop: 10,
              fontSize: 10, fontFamily: "var(--font-mono)",
              color: "var(--text-tertiary)", letterSpacing: "0.06em",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{
                  width: 12, height: 1, borderTop: "1.5px dashed var(--text-tertiary)",
                }} />
                THEN · {historicalCatScores.atLevel}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{
                  width: 12, height: 2, background: "var(--accent)", borderRadius: 1,
                }} />
                NOW
              </span>
            </div>
          ) : (
            <div style={{
              marginTop: 10, maxWidth: 220, textAlign: "center",
              fontSize: 11, fontStyle: "italic",
              fontFamily: "'Instrument Serif', Georgia, serif",
              color: "var(--text-tertiary)", lineHeight: 1.4,
            }}>
              {LABELS.emptyState.radarBaseline}
            </div>
          )}
        </div>

        {/* Per-dimension identity rows */}
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
                    fontSize: 13, fontStyle: "italic",
                    fontFamily: "'Instrument Serif', Georgia, serif",
                    color: statement ? "var(--text-primary)" : "var(--text-tertiary)",
                    marginTop: 4, lineHeight: 1.4,
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
    </div>
  );
}
