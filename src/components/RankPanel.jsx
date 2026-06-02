import { RANKS, RANK_COLOR, RANK_THRESHOLDS, CAT_META, USER_CATEGORIES } from "../constants";
import { getRankPct, getNextThresh } from "../utils";
import { getTier } from "../theme.config.js";
import styles from "../styles.module.css";

const DISPLAY = [...RANKS].reverse(); // S at top, E at bottom

export default function RankPanel({ overallScore, overallRank, catScores, catRanks }) {
  const currentIdx = RANKS.indexOf(overallRank);
  const pct        = getRankPct(overallScore, overallRank);
  const nextThresh = getNextThresh(overallRank);
  const xpLeft     = nextThresh ? nextThresh - Math.round(overallScore) : 0;

  // Insight: weakest and strongest user category
  const sorted = [...USER_CATEGORIES].sort((a, b) => (catScores[a] || 0) - (catScores[b] || 0));
  const weakest  = sorted[0];
  const strongest = sorted[sorted.length - 1];
  const weakestScore = catScores[weakest] || 0;
  const weakestRank  = catRanks[weakest] || "E";
  const weakestNext  = getNextThresh(weakestRank);
  const weakestLeft  = weakestNext ? weakestNext - Math.round(weakestScore) : 0;

  return (
    <div style={{
      width: 220,
      flexShrink: 0,
      borderLeft: "1px solid var(--border)",
      background: "rgba(8,14,26,0.55)",
      display: "flex",
      flexDirection: "column",
      padding: "22px 14px 16px",
      position: "sticky",
      top: 0,
      height: "100vh",
      overflowY: "auto",
      gap: 0,
    }}>

      {/* ── Rank Ladder ──────────────────────────────────────────────── */}
      <p className={styles.panelLbl} style={{ textAlign: "center", marginBottom: 14 }}>RANK PATH</p>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        {DISPLAY.map((rank, di) => {
          const rankIdx    = RANKS.indexOf(rank);
          const isAchieved = rankIdx <= currentIdx;
          const isCurrent  = rank === overallRank;
          const color      = RANK_COLOR[rank];
          const isLast     = di === DISPLAY.length - 1;

          const nextDisplay = DISPLAY[di + 1];
          const nextIdx     = nextDisplay ? RANKS.indexOf(nextDisplay) : -1;
          const segFull    = !isLast && currentIdx > nextIdx;
          const segPartial = !isLast && nextDisplay === overallRank;

          const segColor = segFull
            ? `linear-gradient(to bottom, ${color}, ${RANK_COLOR[nextDisplay]})`
            : segPartial
            ? `linear-gradient(to bottom, var(--border) ${100 - pct}%, ${RANK_COLOR[nextDisplay]} ${100 - pct}%)`
            : "var(--border)";

          return (
            <div key={rank} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%" }}>
              {/* Horizontal row at a fixed height so every rank's circle
                  center sits on the same vertical grid. Without this the
                  current-rank label (YOU ARE HERE + bar + XP-left) inflates
                  its row, breaking the connector's rhythm — D → E ends up
                  ~5 px farther apart than C → D. */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", position: "relative", height: 26, overflow: "visible" }}>
                {/* Circle node */}
                <div style={{
                  width: isCurrent ? 26 : 16,
                  height: isCurrent ? 26 : 16,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: isAchieved ? color : "var(--surface-2)",
                  border: `2px solid ${isAchieved ? color : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: isCurrent ? `0 0 14px ${color}80, 0 0 28px ${color}20` : "none",
                  animation: isCurrent ? "glowPulse 2.5s ease-in-out infinite" : "none",
                  transition: "all 0.3s var(--easing-out)",
                  marginLeft: isCurrent ? -5 : 0,
                  zIndex: 2,
                }}>
                  <span style={{
                    fontSize: isCurrent ? 10 : 7,
                    fontWeight: 900,
                    fontFamily: "var(--font-mono)",
                    color: isAchieved ? "#fff" : "var(--text-tertiary)",
                    lineHeight: 1,
                  }}>{rank}</span>
                </div>

                {/* Label */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isCurrent ? (
                    <>
                      <div style={{
                        display: "flex", alignItems: "baseline", gap: 5,
                        marginBottom: 2,
                      }}>
                        <span style={{
                          fontSize: 11, fontFamily: "'Instrument Serif', Georgia, serif",
                          color, fontWeight: 400, letterSpacing: "-0.01em", lineHeight: 1,
                          textShadow: `0 0 8px ${color}55`,
                        }}>
                          {getTier(rank).name}
                        </span>
                        <span style={{
                          fontSize: 6, fontFamily: "var(--font-mono)",
                          color: `${color}aa`, fontWeight: 700, letterSpacing: "0.08em",
                        }}>
                          YOU ARE HERE
                        </span>
                      </div>
                      <div style={{ height: 2, background: "var(--border)", borderRadius: 1 }}>
                        <div style={{
                          height: "100%", width: `${pct}%`,
                          background: color, borderRadius: 1,
                          boxShadow: `0 0 5px ${color}`,
                          transition: "width 0.6s var(--easing-out)",
                        }} />
                      </div>
                      {nextThresh ? (
                        <div style={{ fontSize: 7, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", marginTop: 2 }}>
                          {xpLeft.toLocaleString()} XP left
                        </div>
                      ) : (
                        <div style={{ fontSize: 7, fontFamily: "var(--font-mono)", color, marginTop: 2 }}>MAX</div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: 0 }}>
                      <span style={{
                        fontSize: 10, fontFamily: "'Instrument Serif', Georgia, serif",
                        color: isAchieved ? color : "var(--text-secondary)",
                        fontWeight: 400, letterSpacing: "-0.01em", lineHeight: 1,
                        opacity: isAchieved ? 1 : 0.65,
                      }}>
                        {getTier(rank).name}
                      </span>
                      <span style={{
                        fontSize: 7, fontFamily: "var(--font-mono)",
                        color: "var(--text-tertiary)",
                        letterSpacing: "0.04em",
                        opacity: 0.7,
                      }}>
                        {RANK_THRESHOLDS[rank] === 0 ? "START" : RANK_THRESHOLDS[rank].toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Connector */}
              {!isLast && (
                <div style={{
                  width: 2, height: 34,
                  background: segColor,
                  boxShadow: segFull || segPartial ? `0 0 5px ${color}40` : "none",
                  marginLeft: isCurrent ? 7 : 7,
                  flexShrink: 0,
                  transition: "background 0.4s",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Smart Insight ────────────────────────────────────────────── */}
      <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)", marginTop: 12 }}>
        <p className={styles.panelLbl} style={{ marginBottom: 8 }}>FOCUS NOW</p>

        <div style={{
          padding: "9px 10px",
          background: `${CAT_META[weakest].accent}0d`,
          border: `1px solid ${CAT_META[weakest].accent}30`,
          borderLeft: `2px solid ${CAT_META[weakest].accent}`,
          borderRadius: 6,
          marginBottom: 6,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ color: CAT_META[weakest].accent, fontSize: 11 }}>{CAT_META[weakest].symbol}</span>
            <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)", color: CAT_META[weakest].accent, letterSpacing: "0.06em" }}>
              {weakest.toUpperCase()}
            </span>
            <span style={{ fontSize: 8, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", marginLeft: "auto" }}>
              {weakestRank}
            </span>
          </div>
          <div style={{ fontSize: 8, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.03em" }}>
            {weakestLeft > 0
              ? `${weakestLeft.toLocaleString()} XP to ${RANKS[RANKS.indexOf(weakestRank) + 1] || "MAX"}`
              : "MAX RANK"}
          </div>
        </div>

        {strongest !== weakest && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ color: CAT_META[strongest].accent, fontSize: 10 }}>{CAT_META[strongest].symbol}</span>
            <span style={{ fontSize: 8, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
              {strongest.slice(0, 4).toUpperCase()} strongest
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
