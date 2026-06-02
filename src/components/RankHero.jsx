import { useState } from "react";
import { RANKS, RANK_COLOR } from "../constants";
import { getRankPct, getNextThresh, todayStr } from "../utils";
import { getTier, LABELS } from "../theme.config.js";
import styles from "../styles.module.css";
import { useIsMobile } from "../hooks/useIsMobile";

/**
 * RankHero (Phase 5) — hierarchy reordered around the SINGLE next action.
 *
 *   ──────────────────────────────────────────────
 *   FLARE  [C]                            Advance →
 *
 *     ┊┊┊ Next action ┊┊┊
 *     "1 signature quest to go"
 *     ────────────────────────  67%
 *
 *     ▸ Detail   (tap to reveal)
 *   ──────────────────────────────────────────────
 *
 * The bottleneck-first line answers "what is the ONE thing blocking me?"
 * — the previously equal 7-stat strip now lives inside a tap-to-reveal
 * detail row so the primary surface stays calm.
 */

// ── Bottleneck resolver ────────────────────────────────────────────────────
// Returns one short sentence naming the single most important next action.
// Priority order: (1) canAdvance → ready (2) XP gate short (3) habit gate
// short (4) signature requirement (5) sustained / max.
function describeSignature(spec, progress) {
  if (!spec || spec.kind === "none") return null;
  const need = (n) => `${n - (progress?.done || 0)} more`;
  switch (spec.kind) {
    case "signatureQuests":
      if (spec.band === "large") return `${need(spec.count)} large signature quest`;
      return `${need(spec.count)} signature quest`;
    case "milestonesCompleted":
      return `${need(spec.count)} milestone`;
    case "streakAchieved":
      return `Reach a ${spec.days}-day streak`;
    case "surgePct":
      return `Lift surge share to ${Math.round((spec.min || 0) * 100)}%`;
    case "composite": {
      // First unmet sub-requirement wins — gives the user one clear next step.
      const parts = progress?.parts || [];
      const firstUnmet = parts.find(p => !p.met);
      if (!firstUnmet) return null;
      return describeSignature(firstUnmet.requirement, firstUnmet.progress);
    }
    default:
      return "Trial signature in progress";
  }
}

function resolveBottleneck({ canAdvance, arcView, overallRank, requiredRank }) {
  if (canAdvance) {
    return { kind: "ready", line: "Threshold open — advance" };
  }
  if (arcView) {
    const { xp, boss } = arcView.gates;
    if (!xp.met) {
      const diff = Math.max(0, xp.required - xp.current);
      const nextName = arcView.nextRank ? getTier(arcView.nextRank).name : getTier(arcView.rank).name;
      return { kind: "xp", line: `${diff.toLocaleString()} XP to ${nextName}` };
    }
    if (!boss.habitMet) {
      const wks = boss.trailingWeeks;
      const at  = boss.weeksAtTarget;
      const rate = Math.round((boss.requiredRate || 0) * 100);
      return { kind: "habit", line: `Habit consistency · ${at}/${wks} weeks ≥ ${rate}%` };
    }
    if (!boss.signatureMet) {
      const sig = describeSignature(boss.signatureRequirement, boss.signatureProgress);
      return { kind: "signature", line: sig || "Trial signature in progress" };
    }
    // S rank, sustained
    if (!arcView.nextRank) return { kind: "max", line: "Supernova — declare arc when ready" };
    return { kind: "wait", line: "Trial holding" };
  }
  // Legacy (no arc): the only signal is dimension overallRank vs requiredRank.
  if (overallRank && requiredRank && RANKS.indexOf(overallRank) < RANKS.indexOf(requiredRank)) {
    return { kind: "legacy", line: `Reach ${getTier(requiredRank).name} to advance` };
  }
  return { kind: "wait", line: "Keep going" };
}

export default function RankHero({ overallScore, overallRank, arcView, level, state, levelComplete, canAdvance = levelComplete, bossBlocked = false, onAdvance }) {
  const isMobile   = useIsMobile();
  const [detailOpen, setDetailOpen] = useState(false);
  const t          = todayStr();

  const displayRank   = arcView ? arcView.rank : overallRank;
  const tier          = getTier(displayRank);
  const rankColor     = RANK_COLOR[displayRank] || "var(--accent)";
  const pct           = arcView
    ? Math.min(100, Math.round((arcView.gates.xp.current / Math.max(1, arcView.gates.xp.required)) * 100))
    : getRankPct(overallScore, overallRank);
  const xpCurrent     = arcView ? arcView.gates.xp.current  : Math.round(overallScore);
  const xpRequired    = arcView ? arcView.gates.xp.required : (getNextThresh(overallRank) || 0);
  const xpToNext      = arcView ? Math.max(0, arcView.gates.xp.required - arcView.gates.xp.current)
                                : (xpRequired ? xpRequired - xpCurrent : 0);
  const nextRank      = arcView ? arcView.nextRank : (xpRequired ? RANKS[RANKS.indexOf(overallRank) + 1] : null);

  const todayXP = (level.goals || [])
    .filter(g => g.type === "habitual" && state.lastCompletions?.[g.id] === t)
    .reduce((s, g) => s + (g.weight || 10), 0);
  const maxStreak = Math.max(0, ...Object.values(state.streaks || {}).map(Number));
  const totalHabits = (level.goals || []).filter(g => g.type === "habitual").length;
  const doneToday   = (level.goals || []).filter(g => g.type === "habitual" && state.lastCompletions?.[g.id] === t).length;

  const bottleneck = resolveBottleneck({
    canAdvance,
    arcView,
    overallRank,
    requiredRank: level?.requiredRank,
  });
  const bottleneckColor = bottleneck.kind === "ready" ? "var(--green)" : rankColor;

  const cardStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderLeft: `3px solid ${rankColor}`,
    borderRadius: "var(--radius-lg)",
    padding: isMobile ? "18px 16px" : "24px 28px",
    marginBottom: 10,
    position: "relative",
    overflow: "hidden",
    boxShadow: `var(--shadow-md), 0 0 50px ${rankColor}06`,
  };

  return (
    <div style={cardStyle}>
      {/* Watermark — tier letter, barely there */}
      <div style={{
        position: "absolute", right: -10, top: -20,
        fontSize: isMobile ? 120 : 180, fontWeight: 900,
        fontFamily: "var(--font-mono)",
        color: rankColor, opacity: 0.04,
        lineHeight: 1, letterSpacing: "-0.05em",
        pointerEvents: "none", userSelect: "none",
      }}>{tier.rank}</div>

      {/* ── Row 1: tier mark + advance button ───────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        gap: 12, marginBottom: isMobile ? 16 : 18,
      }}>
        <div>
          <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.14em", marginBottom: 3 }}>
            {arcView ? "ARC TIER" : "OVERALL TIER"}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <div style={{
              fontSize: isMobile ? 36 : 48, fontWeight: 300,
              fontFamily: "'Instrument Serif', Georgia, serif",
              color: rankColor, lineHeight: 1, letterSpacing: "-0.02em",
              textShadow: `0 0 22px ${rankColor}90, 0 0 60px ${rankColor}30`,
              animation: "glowPulse 3.5s ease-in-out infinite",
            }}>{tier.name}</div>
            <div title={`Tier letter · ${tier.rank}`} style={{
              fontSize: isMobile ? 11 : 12, fontFamily: "var(--font-mono)", fontWeight: 700,
              color: rankColor, letterSpacing: "0.06em",
              padding: "2px 7px", borderRadius: 3,
              background: `${rankColor}10`, border: `1px solid ${rankColor}30`,
            }}>{tier.rank}</div>
          </div>
        </div>

        {canAdvance && (
          <button
            className={styles.advBtn}
            style={{ flexShrink: 0 }}
            onClick={onAdvance}
          >
            {arcView && level.sequenceInArc
              ? `Advance to Level ${level.sequenceInArc + 1} →`
              : `Advance →`}
          </button>
        )}
      </div>

      {/* ── Row 2: bottleneck-first NEXT ACTION line ────────────────────── */}
      <div style={{ marginBottom: isMobile ? 10 : 12 }}>
        <div style={{
          fontSize: 9, fontFamily: "var(--font-mono)",
          color: "var(--text-tertiary)", letterSpacing: "0.14em",
          marginBottom: 6,
        }}>
          {canAdvance ? "READY" : "NEXT"}
        </div>
        <div style={{
          fontSize: isMobile ? 18 : 22, fontWeight: 300,
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: "italic",
          color: bottleneckColor,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
        }}>
          {bottleneck.line}
        </div>
      </div>

      {/* ── Row 3: threshold bar ────────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ height: 6, background: "var(--border)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct}%`,
            background: `linear-gradient(90deg, ${rankColor}70, ${rankColor})`,
            borderRadius: 3,
            transition: "width 0.9s var(--easing-out)",
            boxShadow: `0 0 8px ${rankColor}60`,
          }} />
          {pct > 5 && (
            <div style={{
              position: "absolute", top: 0, left: 0, width: "30%", height: "100%",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
              animation: "scanline 2.4s ease-in-out infinite",
              pointerEvents: "none",
            }} />
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.06em" }}>
          <span>
            {arcView
              ? `${arcView.qualifyingLevelsAtRank}/${arcView.qualifyingToAdvance === Infinity ? "∞" : arcView.qualifyingToAdvance} levels → ${arcView.nextRank || "—"}`
              : `Tier ${tier.rank}`}
          </span>
          <span style={{ color: "var(--text-secondary)" }}>{pct}%</span>
        </div>
      </div>

      {bossBlocked && (
        <div style={{ ...bossLockStyle, marginTop: 8, justifyContent: "center" }}>
          {LABELS.trial.lockedNote}
        </div>
      )}

      {/* ── Row 4: tap-to-reveal detail row ─────────────────────────────── */}
      <button
        onClick={() => setDetailOpen(o => !o)}
        style={{
          marginTop: isMobile ? 10 : 12,
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: "6px 0",
          cursor: "pointer",
          fontSize: 9, fontFamily: "var(--font-mono)",
          color: "var(--text-tertiary)", letterSpacing: "0.14em",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <span style={{ transition: "transform 0.2s", display: "inline-block", transform: detailOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▸</span>
        DETAIL
      </button>
      {detailOpen && (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(6, auto)",
          gap: isMobile ? 14 : 22,
          marginTop: 10,
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
          animation: "fadeUp 0.2s var(--easing-spring)",
        }}>
          <Stat label={arcView ? "GATE XP" : "SCORE"}
                value={arcView ? `${xpCurrent}/${xpRequired}` : Math.round(overallScore)} />
          {arcView
            ? (arcView.nextRank
                ? <Stat label={`NEXT · ${arcView.nextRank}`} value={`${xpToNext} XP`} color={rankColor} />
                : <Stat label="STATUS" value="S — sustained" color={rankColor} />)
            : (nextRank
                ? <Stat label={`NEXT · ${nextRank}`} value={`${xpToNext} XP`} color={rankColor} />
                : <Stat label="STATUS" value="MAX" color={rankColor} />)
          }
          {arcView
            ? <Stat label="QUAL" value={`${arcView.qualifyingLevelsAtRank}/${arcView.qualifyingToAdvance === Infinity ? "∞" : arcView.qualifyingToAdvance}`} />
            : <Stat label="TARGET" value={level.requiredRank || "A"} />
          }
          <Stat label="TODAY"  value={todayXP > 0 ? `+${todayXP}` : "—"} color={todayXP > 0 ? "var(--green)" : "var(--text-tertiary)"} glow={todayXP > 0} />
          <Stat label="DONE"   value={totalHabits ? `${doneToday}/${totalHabits}` : "—"} color={doneToday === totalHabits && totalHabits > 0 ? "var(--green)" : "var(--text-primary)"} glow={doneToday === totalHabits && totalHabits > 0} />
          <Stat label="STREAK" value={maxStreak > 0 ? `${maxStreak}D` : "—"} color={maxStreak >= 3 ? "var(--yellow)" : "var(--text-tertiary)"} glow={maxStreak >= 3} />
        </div>
      )}
    </div>
  );
}

const bossLockStyle = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 12px", borderRadius: 6,
  background: "rgba(250,204,21,0.08)",
  border: "1px solid rgba(250,204,21,0.3)",
  color: "var(--yellow)",
  fontSize: 11, fontWeight: 700,
  fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
};

function Stat({ label, value, color = "var(--text-primary)", glow = false }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.12em", marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)",
        color, letterSpacing: "-0.02em",
        textShadow: glow ? `0 0 14px ${color}90` : "none",
        transition: "color 0.3s, text-shadow 0.3s",
      }}>{value}</div>
    </div>
  );
}
