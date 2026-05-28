import { S } from "../styles";

/**
 * Per-chapter boss challenge card. Opt-in: when disabled it shows a quiet
 * "enable" affordance; advancement is never gated unless the user turns it on.
 */
export default function BossChallenge({ bossEval, onEnableBoss, onDisableBoss }) {
  if (!bossEval) return null;

  if (!bossEval.enabled) {
    return (
      <div style={{
        ...cardBase,
        borderLeft: "2px solid var(--border)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={lbl}>⚔ BOSS CHALLENGE · OFF</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.45 }}>
              Optionally gate this chapter's advancement behind a composite goal:
              sustained habit consistency plus a signature quest.
            </div>
          </div>
          <button onClick={onEnableBoss} style={enableBtn}>Enable</button>
        </div>
      </div>
    );
  }

  const { met, weeksAtTarget, weeksRequired, rateThreshold, sigDone, sigRequired, habitMet, sigMet } = bossEval;
  const accent = met ? "var(--green)" : "var(--yellow)";

  return (
    <div style={{ ...cardBase, borderLeft: `2px solid ${accent}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ ...lbl, color: accent }}>
          ⚔ BOSS CHALLENGE · {met ? "CLEARED" : "IN PROGRESS"}
        </div>
        <button onClick={onDisableBoss} style={disableBtn}>Disable</button>
      </div>

      <Criterion
        label={`Habit consistency · ${weeksAtTarget}/${weeksRequired} weeks ≥ ${Math.round(rateThreshold * 100)}%`}
        done={habitMet}
        pct={weeksRequired ? Math.round((weeksAtTarget / weeksRequired) * 100) : 0}
      />
      <Criterion
        label={`Signature quests · ${sigDone}/${sigRequired} completed`}
        done={sigMet}
        pct={sigRequired ? Math.min(100, Math.round((sigDone / sigRequired) * 100)) : 100}
      />

      <div style={{
        fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
        marginTop: 10, color: met ? "var(--green)" : "var(--text-tertiary)",
      }}>
        {met
          ? "◈ Boss cleared — advancement unlocked."
          : "Meet both criteria to unlock advancement."}
      </div>
    </div>
  );
}

function Criterion({ label, done, pct }) {
  const color = done ? "var(--green)" : "var(--yellow)";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span style={{
          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
          background: done ? "var(--green)" : "transparent",
          border: `1.5px solid ${done ? "var(--green)" : "var(--border)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, color: "#fff", fontWeight: 700,
        }}>{done ? "✓" : ""}</span>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", letterSpacing: "0.03em" }}>
          {label}
        </span>
      </div>
      <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginLeft: 24 }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: color, borderRadius: 2,
          boxShadow: `0 0 6px ${color}80`, transition: "width 0.5s var(--easing-out)",
        }} />
      </div>
    </div>
  );
}

const cardBase = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  padding: "16px 18px",
  marginBottom: 10,
};

const lbl = {
  fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
  letterSpacing: "0.12em", color: "var(--text-secondary)",
};

const enableBtn = {
  ...S.ghostBtn,
  flexShrink: 0,
  fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
};

const disableBtn = {
  background: "transparent", border: "none", color: "var(--text-tertiary)",
  fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
  cursor: "pointer", textDecoration: "underline", padding: 0,
};
