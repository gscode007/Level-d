import { RANKS, RANK_COLOR } from "../constants";
import { getRankPct, getNextThresh, todayStr } from "../utils";
import { S } from "../styles";
import { useIsMobile } from "../hooks/useIsMobile";

export default function RankHero({ overallScore, overallRank, level, state, levelComplete, onAdvance }) {
  const isMobile   = useIsMobile();
  const pct        = getRankPct(overallScore, overallRank);
  const nextThresh = getNextThresh(overallRank);
  const xpToNext   = nextThresh ? nextThresh - Math.round(overallScore) : 0;
  const nextRank   = nextThresh ? RANKS[RANKS.indexOf(overallRank) + 1] : null;
  const rankColor  = RANK_COLOR[overallRank] || "var(--accent)";
  const t          = todayStr();

  const todayXP = (level.goals || [])
    .filter(g => g.type === "habitual" && state.lastCompletions?.[g.id] === t)
    .reduce((s, g) => s + (g.weight || 10), 0);

  const maxStreak = Math.max(0, ...Object.values(state.streaks || {}).map(Number));
  const totalHabits = (level.goals || []).filter(g => g.type === "habitual").length;
  const doneToday   = (level.goals || []).filter(g => g.type === "habitual" && state.lastCompletions?.[g.id] === t).length;

  const cardStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderLeft: `3px solid ${rankColor}`,
    borderRadius: "var(--radius-lg)",
    padding: isMobile ? "18px 16px" : "24px 28px",
    marginBottom: 10,
    position: "relative",
    overflow: "hidden",
    boxShadow: `var(--shadow-md), 0 0 50px ${rankColor}10, inset 3px 0 24px ${rankColor}06`,
  };

  return (
    <div style={cardStyle}>
      {/* Watermark */}
      <div style={{
        position: "absolute", right: -10, top: -20,
        fontSize: isMobile ? 120 : 180, fontWeight: 900,
        fontFamily: "var(--font-mono)",
        color: rankColor, opacity: 0.04,
        lineHeight: 1, letterSpacing: "-0.05em",
        pointerEvents: "none", userSelect: "none",
      }}>{overallRank}</div>

      {isMobile ? (
        /* ── Mobile layout ── */
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            {/* Rank letter */}
            <div>
              <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.14em", marginBottom: 2 }}>
                OVERALL RANK
              </div>
              <div style={{
                fontSize: 72, fontWeight: 900, fontFamily: "var(--font-mono)",
                color: rankColor, lineHeight: 1, letterSpacing: "-0.04em",
                textShadow: `0 0 24px ${rankColor}90, 0 0 60px ${rankColor}30`,
                animation: "glowPulse 3.5s ease-in-out infinite",
              }}>{overallRank}</div>
            </div>

            {/* Stats cluster */}
            <div style={{ display: "flex", gap: 16, paddingTop: 4 }}>
              <Stat label="SCORE"  value={Math.round(overallScore)} />
              <Stat label="TODAY"  value={todayXP > 0 ? `+${todayXP}` : "—"} color={todayXP > 0 ? "var(--green)" : "var(--text-tertiary)"} glow={todayXP > 0} />
              <Stat label="STREAK" value={maxStreak > 0 ? `${maxStreak}D` : "—"} color={maxStreak >= 3 ? "var(--yellow)" : "var(--text-tertiary)"} glow={maxStreak >= 3} />
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>
                RANK PROGRESS
              </span>
              <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{pct}%</span>
            </div>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${pct}%`,
                background: `linear-gradient(90deg, ${rankColor}70, ${rankColor})`,
                borderRadius: 3,
                transition: "width 0.9s var(--easing-out)",
                boxShadow: `0 0 10px ${rankColor}80`,
              }} />
              {pct > 5 && (
                <div style={{
                  position: "absolute", top: 0, left: 0, width: "30%", height: "100%",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
                  animation: "scanline 2.4s ease-in-out infinite",
                  pointerEvents: "none",
                }} />
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.06em" }}>
                RANK {overallRank}
              </span>
              {nextRank
                ? <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: rankColor }}>{xpToNext} XP → {nextRank}</span>
                : <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: rankColor }}>MAX RANK</span>
              }
            </div>
          </div>

          {levelComplete && (
            <button style={{ ...S.advBtn, width: "100%", marginTop: 6, textAlign: "center" }} onClick={onAdvance}>
              Advance to Level {(level.num || 1) + 1} →
            </button>
          )}
        </div>
      ) : (
        /* ── Desktop layout ── */
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.14em", marginBottom: 4 }}>OVERALL RANK</div>
            <div style={{
              fontSize: 84, fontWeight: 900, fontFamily: "var(--font-mono)",
              color: rankColor, lineHeight: 1, letterSpacing: "-0.04em",
              textShadow: `0 0 30px ${rankColor}90, 0 0 80px ${rankColor}30`,
              animation: "glowPulse 3.5s ease-in-out infinite",
            }}>{overallRank}</div>
          </div>

          <div style={{ width: 1, height: 72, background: "var(--border)", flexShrink: 0 }} />

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em" }}>RANK PROGRESS</span>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", letterSpacing: "0.04em" }}>{pct}%</span>
            </div>
            <div style={{ height: 8, background: "var(--border)", borderRadius: 4, marginBottom: 10, position: "relative", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${pct}%`,
                background: `linear-gradient(90deg, ${rankColor}70, ${rankColor})`,
                borderRadius: 4,
                transition: "width 0.9s var(--easing-out)",
                boxShadow: `0 0 12px ${rankColor}80`,
              }} />
              {pct > 5 && (
                <div style={{
                  position: "absolute", top: 0, left: 0, width: "30%", height: "100%",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
                  animation: "scanline 2.4s ease-in-out infinite",
                  pointerEvents: "none",
                }} />
              )}
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <Stat label="SCORE" value={Math.round(overallScore)} />
              {nextRank
                ? <Stat label={`NEXT · ${nextRank}`} value={`${xpToNext} XP`} color={rankColor} />
                : <Stat label="STATUS" value="MAX RANK" color={rankColor} />
              }
              <Stat label="TARGET" value={level.requiredRank || "A"} />
            </div>
          </div>

          <div style={{ width: 1, height: 72, background: "var(--border)", flexShrink: 0 }} />

          <div style={{ flexShrink: 0, display: "flex", gap: 22 }}>
            <Stat label="TODAY"  value={todayXP > 0 ? `+${todayXP}` : "—"} color={todayXP > 0 ? "var(--green)" : "var(--text-tertiary)"} glow={todayXP > 0} />
            <Stat label="DONE"   value={totalHabits ? `${doneToday}/${totalHabits}` : "—"} color={doneToday === totalHabits && totalHabits > 0 ? "var(--green)" : "var(--text-primary)"} glow={doneToday === totalHabits && totalHabits > 0} />
            <Stat label="STREAK" value={maxStreak > 0 ? `${maxStreak}D` : "—"} color={maxStreak >= 3 ? "var(--yellow)" : "var(--text-tertiary)"} glow={maxStreak >= 3} />
          </div>

          {levelComplete && (
            <button style={{ ...S.advBtn, flexShrink: 0 }} onClick={onAdvance}>Advance →</button>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = "var(--text-primary)", glow = false }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.12em", marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)",
        color, letterSpacing: "-0.02em",
        textShadow: glow ? `0 0 14px ${color}90` : "none",
        transition: "color 0.3s, text-shadow 0.3s",
      }}>{value}</div>
    </div>
  );
}
