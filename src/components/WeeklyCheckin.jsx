import { useState } from "react";
import { USER_CATEGORIES, CAT_META } from "../constants";
import { S } from "../styles";

/* ──────────────────────────────────────────────────────────────────────────
   WeeklyCheckin — surfaces tension between identity statements and actual
   behavior. For each USER_CATEGORY, shows:
     - The user's identity statement (inline-editable)
     - Vote count this past week (habit completions tagged to this identity)
     - Tension tone (red / yellow / green) so misalignment is visible at a glance
   On submit, persists updated catGoals + lastWeeklyCheckin.
   ────────────────────────────────────────────────────────────────────────── */

// Voting tone thresholds — kept lenient so single-habit weeks don't read red
const TONE = {
  none: { color: "var(--red)",    bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.25)",  label: "no votes" },
  thin: { color: "var(--yellow)", bg: "rgba(250,204,21,0.08)", border: "rgba(250,204,21,0.25)", label: "thin"     },
  alive: { color: "var(--green)", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.25)",  label: "alive"    },
};

function getTone(votes) {
  if (votes <= 0) return TONE.none;
  if (votes <= 2) return TONE.thin;
  return TONE.alive;
}

export default function WeeklyCheckin({ level, weeklyVotes, onSubmit, onSkip, onClose }) {
  const [statements, setStatements] = useState({ ...level.categoryGoals });

  function update(cat, value) {
    setStatements((s) => ({ ...s, [cat]: value }));
  }

  function handleSubmit() { onSubmit(statements); }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div style={{
        background: "var(--surface)",
        borderRadius: "12px 12px 0 0",
        borderTop: "1px solid var(--border)",
        borderLeft: "1px solid var(--border)",
        borderRight: "1px solid var(--border)",
        padding: "22px 26px 28px",
        width: "100%", maxWidth: 580,
        animation: "slideUp 0.3s var(--easing-spring)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ width: 28, height: 3, background: "var(--border)", borderRadius: 2, margin: "0 auto 22px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.02em" }}>
            ◇ Weekly Check-in
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "var(--surface-2)", border: "1px solid var(--border)",
              width: 26, height: 26, borderRadius: 4,
              fontSize: 13, color: "var(--text-secondary)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >×</button>
        </div>

        <p style={{
          fontSize: 12, color: "var(--text-secondary)",
          lineHeight: 1.55, marginBottom: 18,
        }}>
          Each identity below is followed by the number of votes your behavior cast for it this week.
          Where there's tension, you can adjust your claim — or commit to the behavior next week.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {USER_CATEGORIES.map((cat) => {
            const meta = CAT_META[cat];
            const votes = weeklyVotes?.[cat] || 0;
            const tone = getTone(votes);
            return (
              <div key={cat} style={{
                padding: "12px 14px",
                background: tone.bg,
                border: `1px solid ${tone.border}`,
                borderLeft: `2px solid ${meta.accent}`,
                borderRadius: 6,
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginBottom: 8, gap: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ color: meta.accent, fontSize: 14 }}>{meta.symbol}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: "var(--text-secondary)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontFamily: "var(--font-mono)",
                    }}>{cat}</span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
                    color: tone.color, fontVariantNumeric: "tabular-nums",
                    textShadow: votes > 0 ? `0 0 6px ${tone.color}50` : "none",
                  }}>
                    {votes} {votes === 1 ? "VOTE" : "VOTES"} · {tone.label.toUpperCase()}
                  </span>
                </div>

                <input
                  value={statements[cat] || ""}
                  onChange={(e) => update(cat, e.target.value)}
                  placeholder="becoming…"
                  style={{
                    width: "100%",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    padding: "8px 10px",
                    fontSize: 13,
                    color: "var(--text-primary)",
                    fontStyle: statements[cat] ? "italic" : "normal",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />

                {tone === TONE.none && (statements[cat] || "").trim() && (
                  <p style={{
                    fontSize: 10, color: tone.color, marginTop: 6,
                    fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                  }}>
                    Claimed but not lived. Adjust your claim or your behavior.
                  </p>
                )}
                {tone === TONE.none && !(statements[cat] || "").trim() && (
                  <p style={{
                    fontSize: 10, color: "var(--text-tertiary)", marginTop: 6,
                    fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                  }}>
                    No identity statement yet — write one or skip.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            onClick={onSkip}
            style={{ ...S.backBtn, flex: "0 0 auto" }}
          >Skip this week</button>
          <button
            onClick={handleSubmit}
            style={{ ...S.nextBtn, flex: 1, marginTop: 0 }}
          >Mark check-in complete</button>
        </div>
      </div>
    </div>
  );
}
