import { useState } from "react";
import { USER_CATEGORIES, CAT_META, RANKS } from "../constants";
import { S } from "../styles";

/* ──────────────────────────────────────────────────────────────────────────
   SetupWizard — three-step onboarding using Level-d's existing visual system.
   Steps:
     1. Chapter title
     2. Identity statements (per dimension)
     3. Weights + required rank
   Habits are added later from the main app (manually via AddSheet, or via the
   optional AI Agent feature once unlocked). onFinish always passes goals=[].
   ────────────────────────────────────────────────────────────────────────── */

const STEPS = ["Chapter", "Identities", "Weights"];

export default function SetupWizard({ level, onFinish }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(level.title || "");
  const [catGoals, setCatGoals] = useState({ ...level.categoryGoals });
  const [weights, setWeights] = useState({ ...level.weights });
  const [reqRank, setReqRank] = useState(level.requiredRank || "A");

  function setWeight(cat, raw) {
    const v = Math.max(0, Math.min(100, parseInt(raw) || 0));
    const others = USER_CATEGORIES.filter((c) => c !== cat);
    const remaining = 100 - v;
    const oldTotal = others.reduce((s, c) => s + (weights[c] || 0), 0);
    const nw = { ...weights, [cat]: v, Resilience: 0 };
    if (oldTotal === 0) {
      const each = Math.floor(remaining / others.length);
      const leftover = remaining - each * (others.length - 1);
      others.forEach((c, i) => { nw[c] = i === others.length - 1 ? leftover : each; });
    } else {
      let dist = 0;
      others.forEach((c, i) => {
        if (i === others.length - 1) {
          nw[c] = Math.max(0, remaining - dist);
        } else {
          const share = Math.round((weights[c] / oldTotal) * remaining);
          nw[c] = Math.max(0, share);
          dist += nw[c];
        }
      });
    }
    setWeights(nw);
  }

  const canAdvance = step === 0 ? !!title.trim() : true;
  function next()   { setStep((s) => Math.min(STEPS.length - 1, s + 1)); }
  function back()   { setStep((s) => Math.max(0, s - 1)); }
  function finish() { onFinish(title, catGoals, weights, reqRank, []); }

  return (
    <div style={S.setupWrap}>
      <div style={{ ...S.setupCard, maxWidth: 520 }}>

        {/* Step indicators */}
        <div style={{ ...S.stepRow, alignItems: "flex-start" }}>
          <div style={{
            position: "absolute", top: 11, left: "12%", right: "12%",
            height: 1, background: "var(--border)", zIndex: 0,
          }} />
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, zIndex: 1 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 4,
                background: i <= step ? "var(--accent)" : "var(--surface-2)",
                color: i <= step ? "#fff" : "var(--text-tertiary)",
                border: `1px solid ${i <= step ? "var(--accent)" : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700,
                fontFamily: "var(--font-mono)",
                boxShadow: i === step ? "0 0 12px var(--accent-glow)" : "none",
                transition: "background 0.3s var(--easing-spring), box-shadow 0.3s",
              }}>
                {i < step ? "✓" : i + 1}
              </div>
              <span style={{
                fontSize: 10,
                color: i === step ? "var(--accent)" : "var(--text-tertiary)",
                fontWeight: i === step ? 600 : 400,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em",
              }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Step 0 — chapter title */}
        {step === 0 && (
          <div style={{ animation: "fadeUp 0.3s var(--easing-out)" }}>
            <p style={S.eyebrow}>Level {level.num}</p>
            <h1 style={S.setupH}>Name who you're<br />becoming</h1>
            <p style={S.setupDesc}>A short title for this chapter — the version of you taking shape.</p>
            <input
              style={S.bigInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Building the Foundation"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && canAdvance && next()}
            />
            <button
              style={{ ...S.nextBtn, opacity: canAdvance ? 1 : 0.35 }}
              disabled={!canAdvance}
              onClick={next}
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 1 — identity statements */}
        {step === 1 && (
          <div style={{ animation: "fadeUp 0.3s var(--easing-out)" }}>
            <p style={S.eyebrow}>{title}</p>
            <h1 style={S.setupH}>Who you're<br />becoming</h1>
            <p style={S.setupDesc}>An identity statement for each dimension. Your habits will be evidence for these.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {USER_CATEGORIES.map((cat) => (
                <div key={cat} style={S.catGoalRow}>
                  <div style={S.catGoalLbl}>
                    <span style={{ color: CAT_META[cat].accent, fontSize: 14 }}>{CAT_META[cat].symbol}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.03em" }}>{cat}</span>
                  </div>
                  <input
                    style={S.inlineInput}
                    value={catGoals[cat] || ""}
                    onChange={(e) => setCatGoals((g) => ({ ...g, [cat]: e.target.value }))}
                    placeholder="becoming…"
                  />
                </div>
              ))}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "9px 14px",
                background: "var(--surface-2)",
                borderRadius: 6, border: "1px solid var(--border)",
                opacity: 0.6,
              }}>
                <div style={S.catGoalLbl}>
                  <span style={{ color: CAT_META.Resilience.accent, fontSize: 14 }}>{CAT_META.Resilience.symbol}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.03em" }}>Resilience</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                  AUTO · +5 XP per habit · decays on missed days
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button style={S.backBtn} onClick={back}>← Back</button>
              <button style={S.nextBtn} onClick={next}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 2 — weights + required rank */}
        {step === 2 && (
          <div style={{ animation: "fadeUp 0.3s var(--easing-out)" }}>
            <p style={S.eyebrow}>{title}</p>
            <h1 style={S.setupH}>Prioritize your<br />dimensions</h1>
            <p style={S.setupDesc}>Drag to weight each dimension — total stays 100%.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 16 }}>
              {USER_CATEGORIES.map((cat) => (
                <div key={cat}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: CAT_META[cat].accent, fontSize: 13 }}>{CAT_META[cat].symbol}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{cat}</span>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: "var(--text-primary)",
                      fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)",
                    }}>
                      {weights[cat]}%
                    </span>
                  </div>
                  <div style={{ position: "relative", height: 2 }}>
                    <div style={{
                      position: "absolute", top: 0, left: 0, height: "100%",
                      width: `${weights[cat]}%`,
                      background: CAT_META[cat].accent,
                      borderRadius: 1, pointerEvents: "none",
                      transition: "width 0.15s var(--easing-out)",
                      boxShadow: `0 0 8px ${CAT_META[cat].accent}80`,
                    }} />
                    <input
                      type="range" min={0} max={100} value={weights[cat]}
                      onChange={(e) => setWeight(cat, e.target.value)}
                      style={{ position: "absolute", top: -8, left: 0, width: "100%", background: "transparent", zIndex: 1 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 20, padding: "9px 14px",
              background: "var(--surface-2)", borderRadius: 6,
              border: "1px solid var(--border)", opacity: 0.7,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ color: CAT_META.Resilience.accent, fontSize: 13 }}>{CAT_META.Resilience.symbol}</span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                RESILIENCE · AUTO · not weighted in overall rank
              </span>
            </div>

            <div style={{ marginTop: 20 }}>
              <p style={{ ...S.panelLbl, marginBottom: 10 }}>Target rank to complete level</p>
              <div style={{ display: "flex", gap: 6 }}>
                {RANKS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReqRank(r)}
                    style={{
                      ...S.rankPill,
                      background: reqRank === r ? "var(--accent)" : "transparent",
                      color: reqRank === r ? "#fff" : "var(--text-secondary)",
                      border: `1px solid ${reqRank === r ? "var(--accent)" : "var(--border)"}`,
                      boxShadow: reqRank === r ? "0 0 12px rgba(59,130,246,0.4)" : "none",
                    }}
                  >{r}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
              <button style={S.backBtn} onClick={back}>← Back</button>
              <button style={S.nextBtn} onClick={finish}>Begin Level {level.num}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
