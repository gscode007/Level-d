import { useState } from "react";
import { CATEGORIES, USER_CATEGORIES, CAT_META, RANKS, HABIT_TEMPLATES, MILESTONE_TEMPLATES, DIFFICULTY_MULTIPLIER, SMART_TEMPLATE, FREQUENCY_OPTIONS } from "../constants";
import { genId, calcBaseXP } from "../utils";
import { S } from "../styles";

export default function SetupScreen({ level, onFinish }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(level.title || "");
  const [catGoals, setCatGoals] = useState({ ...level.categoryGoals });
  const [weights, setWeights] = useState({ ...level.weights });
  const [reqRank, setReqRank] = useState(level.requiredRank || "A");

  // Step 3 — goals
  const [goalTab, setGoalTab]     = useState("habitual");
  // Quit habit form
  const [qName, setQName]         = useState("");
  const [qTemplate, setQTemplate] = useState(SMART_TEMPLATE["Resilience"].habitual);
  const [qDiff, setQDiff]         = useState("Medium");
  const [goals, setGoals]         = useState([]);
  const [hName, setHName]         = useState("");
  const [hCat, setHCat]           = useState("Emotional");
  const [hTemplate, setHTemplate] = useState(SMART_TEMPLATE["Emotional"].habitual);
  const [hDiff, setHDiff]         = useState("Medium");
  const [hFreq, setHFreq]         = useState(7);
  const [mName, setMName]         = useState("");
  const [mCat, setMCat]           = useState("Emotional");
  const [mTemplate, setMTemplate] = useState(SMART_TEMPLATE["Emotional"].milestone);
  const [mDiff, setMDiff]         = useState("Medium");
  const [mSteps, setMSteps]       = useState([{ name: "" }, { name: "" }]);

  function setWeight(cat, raw) {
    const v = Math.max(0, Math.min(100, parseInt(raw) || 0));
    const others = USER_CATEGORIES.filter(c => c !== cat);
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

  function addHabit() {
    if (!hName.trim()) return;
    setGoals(g => [...g, {
      id: genId(), name: hName.trim(), category: hCat,
      template: hTemplate, difficulty: hDiff, frequency: hFreq,
      type: "habitual", completions: [], locked: true,
    }]);
    setHName("");
  }

  function addQuitHabit() {
    if (!qName.trim()) return;
    setGoals(g => [...g, {
      id: genId(), name: qName.trim(), category: "Resilience",
      template: qTemplate, difficulty: qDiff,
      type: "quitHabit", completions: [],
      currentStreak: 0, bestStreak: 0, lastResistDate: null, lastCheckedDate: null, succumbLog: [], resistLog: [],
      locked: true,
    }]);
    setQName("");
  }

  function addMilestone() {
    if (!mName.trim()) return;
    const validSteps = mSteps.filter(s => s.name.trim()).map(s => ({ name: s.name.trim(), completed: false }));
    if (validSteps.length === 0) return;
    setGoals(g => [...g, {
      id: genId(), name: mName.trim(), category: mCat,
      template: mTemplate, difficulty: mDiff,
      type: "milestone", milestoneSteps: validSteps, completions: [], locked: true,
    }]);
    setMName("");
    setMSteps([{ name: "" }, { name: "" }]);
  }

  function removeGoal(id) {
    setGoals(g => g.filter(x => x.id !== id));
  }

  const STEPS = ["Title", "Goals", "Weights", "Add Goals"];

  return (
    <div style={S.setupWrap}>
      <div style={{ ...S.setupCard, maxWidth: step === 3 ? 560 : 500 }}>
        {/* Step indicators */}
        <div style={{ ...S.stepRow, alignItems: "flex-start" }}>
          {/* Connector line behind indicators */}
          <div style={{
            position: "absolute",
            top: 11,
            left: "6.5%",
            right: "6.5%",
            height: 1,
            background: "var(--border)",
            zIndex: 0,
          }} />
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, zIndex: 1 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 4,
                background: i < step ? "var(--accent)" : i === step ? "var(--accent)" : "var(--surface-2)",
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
                transition: "color 0.2s",
              }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Step 0 — title */}
        {step === 0 && (
          <div style={{ animation: "fadeUp 0.3s var(--easing-out)" }}>
            <p style={S.eyebrow}>Level {level.num}</p>
            <h1 style={S.setupH}>Name this chapter<br />of your life</h1>
            <p style={S.setupDesc}>A short title for this level — the name of your current chapter.</p>
            <input
              style={S.bigInput}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Building the Foundation"
              autoFocus
              onKeyDown={e => e.key === "Enter" && title.trim() && setStep(1)}
            />
            <button
              style={{ ...S.nextBtn, opacity: title.trim() ? 1 : 0.35 }}
              disabled={!title.trim()}
              onClick={() => setStep(1)}
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 1 — category goals */}
        {step === 1 && (
          <div style={{ animation: "fadeUp 0.3s var(--easing-out)" }}>
            <p style={S.eyebrow}>{title}</p>
            <h1 style={S.setupH}>One goal per<br />dimension</h1>
            <p style={S.setupDesc}>The main intention for each area this level.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {USER_CATEGORIES.map(cat => (
                <div key={cat} style={S.catGoalRow}>
                  <div style={S.catGoalLbl}>
                    <span style={{ color: CAT_META[cat].accent, fontSize: 14 }}>{CAT_META[cat].symbol}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.03em" }}>{cat}</span>
                  </div>
                  <input
                    style={S.inlineInput}
                    value={catGoals[cat]}
                    onChange={e => setCatGoals(g => ({ ...g, [cat]: e.target.value }))}
                    placeholder={`${cat.toLowerCase()} intention…`}
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
              <button style={S.backBtn} onClick={() => setStep(0)}>← Back</button>
              <button style={S.nextBtn} onClick={() => setStep(2)}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 2 — weights */}
        {step === 2 && (
          <div style={{ animation: "fadeUp 0.3s var(--easing-out)" }}>
            <p style={S.eyebrow}>{title}</p>
            <h1 style={S.setupH}>Prioritize your<br />dimensions</h1>
            <p style={S.setupDesc}>Drag to weight each dimension — total stays 100%.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 16 }}>
              {USER_CATEGORIES.map(cat => (
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
                      onChange={e => setWeight(cat, e.target.value)}
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
                {RANKS.map(r => (
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
              <button style={S.backBtn} onClick={() => setStep(1)}>← Back</button>
              <button style={S.nextBtn} onClick={() => setStep(3)}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3 — goals */}
        {step === 3 && (
          <div style={{ animation: "fadeUp 0.3s var(--easing-out)" }}>
            <p style={S.eyebrow}>{title}</p>
            <h1 style={S.setupH}>Add your first<br />goals</h1>
            <p style={S.setupDesc}>
              Habits earn XP daily. Milestones are objectives broken into steps.
            </p>
            <div style={{
              padding: "8px 12px", marginBottom: 14,
              background: "var(--accent-dim)",
              border: "1px solid var(--accent)",
              borderRadius: 6,
            }}>
              <p style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                ◆ ANCHORS & NOTES · add after launch · editable for 3 days
              </p>
            </div>

            {/* Tab switcher */}
            <div style={{
              display: "flex", gap: 2,
              background: "var(--surface-2)", borderRadius: 8, padding: 3,
              marginBottom: 18, border: "1px solid var(--border)",
            }}>
              {[["habitual","HABIT"],["milestone","MILESTONE"],["quitHabit","QUIT"]].map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setGoalTab(t)}
                  style={{
                    flex: 1, border: "none", borderRadius: 5, padding: "8px 0",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                    letterSpacing: "0.04em",
                    background: goalTab === t ? (t === "quitHabit" ? "#7C3AED" : "var(--accent)") : "transparent",
                    color: goalTab === t ? "#fff" : "var(--text-secondary)",
                    boxShadow: goalTab === t ? "0 1px 8px rgba(59,130,246,0.4)" : "none",
                    transition: "all 0.2s var(--easing-spring)",
                  }}
                >{label}</button>
              ))}
            </div>

            {/* Habit form */}
            {goalTab === "habitual" && (
              <div style={{ marginBottom: 14 }}>
                <input
                  style={{ ...S.fInput, marginBottom: 8 }}
                  value={hName}
                  onChange={e => setHName(e.target.value)}
                  placeholder="e.g., Meditate 10 min"
                  onKeyDown={e => e.key === "Enter" && addHabit()}
                  autoFocus
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
                  <select style={S.fInput} value={hCat} onChange={e => {
                    setHCat(e.target.value);
                    setHTemplate(SMART_TEMPLATE[e.target.value]?.habitual || "Standard");
                  }}>
                    {USER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select style={S.fInput} value={hTemplate} onChange={e => setHTemplate(e.target.value)}>
                    {Object.entries(HABIT_TEMPLATES).map(([k, v]) => (
                      <option key={k} value={k}>{k} ({v})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {Object.entries(DIFFICULTY_MULTIPLIER).map(([d, m]) => (
                    <button key={d} onClick={() => setHDiff(d)} style={{
                      flex: 1, borderRadius: 6, padding: "7px 0",
                      fontSize: 11, fontWeight: 600, cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                      background: hDiff === d ? "var(--accent)" : "var(--surface-2)",
                      color: hDiff === d ? "#fff" : "var(--text-secondary)",
                      border: `1px solid ${hDiff === d ? "var(--accent)" : "var(--border)"}`,
                      transition: "all 0.15s",
                    }}>{d} ×{m}</button>
                  ))}
                  <button
                    onClick={addHabit}
                    disabled={!hName.trim()}
                    style={{ ...S.addBtn, padding: "7px 14px", opacity: hName.trim() ? 1 : 0.35, whiteSpace: "nowrap" }}
                  >+ Add</button>
                </div>
                {/* Frequency */}
                <div style={{ marginBottom: 8 }}>
                  <p style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", marginBottom: 6 }}>FREQUENCY</p>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {FREQUENCY_OPTIONS.map(({ label, value }) => (
                      <button key={value} onClick={() => setHFreq(value)} style={{
                        flex: 1, minWidth: 50, borderRadius: 5, padding: "5px 2px",
                        fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-mono)",
                        background: hFreq === value ? "var(--accent)" : "var(--surface-2)",
                        color: hFreq === value ? "#fff" : "var(--text-secondary)",
                        border: `1px solid ${hFreq === value ? "var(--accent)" : "var(--border)"}`,
                        transition: "all 0.15s",
                      }}>{label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                    XP PER COMPLETION
                  </p>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                    +{calcBaseXP(hTemplate, hDiff, hCat, "habitual")}
                  </span>
                </div>
              </div>
            )}

            {/* Milestone form */}
            {goalTab === "milestone" && (
              <div style={{ marginBottom: 14 }}>
                <input
                  style={{ ...S.fInput, marginBottom: 8 }}
                  value={mName}
                  onChange={e => setMName(e.target.value)}
                  placeholder="e.g., Finish online course"
                  autoFocus
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
                  <select style={S.fInput} value={mCat} onChange={e => {
                    setMCat(e.target.value);
                    setMTemplate(SMART_TEMPLATE[e.target.value]?.milestone || "Completion");
                  }}>
                    {USER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select style={S.fInput} value={mTemplate} onChange={e => setMTemplate(e.target.value)}>
                    {Object.entries(MILESTONE_TEMPLATES).map(([k, v]) => (
                      <option key={k} value={k}>{k} ({v})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {Object.entries(DIFFICULTY_MULTIPLIER).map(([d, m]) => (
                    <button key={d} onClick={() => setMDiff(d)} style={{
                      flex: 1, borderRadius: 6, padding: "7px 0",
                      fontSize: 11, fontWeight: 600, cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                      background: mDiff === d ? "var(--accent)" : "var(--surface-2)",
                      color: mDiff === d ? "#fff" : "var(--text-secondary)",
                      border: `1px solid ${mDiff === d ? "var(--accent)" : "var(--border)"}`,
                      transition: "all 0.15s",
                    }}>{d} ×{m}</button>
                  ))}
                </div>
                {(() => {
                  const validCount = mSteps.filter(s => s.name.trim()).length;
                  const totalXP = calcBaseXP(mTemplate, mDiff, mCat, "milestone");
                  const perStep = validCount > 0 ? Math.round(totalXP / validCount) : totalXP;
                  return (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <p style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                        TOTAL XP{validCount > 0 ? ` · ${perStep} PER STEP` : ""}
                      </p>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                        +{totalXP}
                      </span>
                    </div>
                  );
                })()}
                <p style={{ ...S.fLbl, marginBottom: 6 }}>Steps</p>
                {mSteps.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 7, marginBottom: 7, alignItems: "center" }}>
                    <input
                      style={{ ...S.fInput, flex: 1 }}
                      value={s.name}
                      onChange={e => setMSteps(st => st.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                      placeholder={`Step ${i + 1}`}
                    />
                    {mSteps.length > 1 && (
                      <button onClick={() => setMSteps(st => st.filter((_, idx) => idx !== i))} style={S.delBtn}>✕</button>
                    )}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 7, marginTop: 4 }}>
                  <button onClick={() => setMSteps(s => [...s, { name: "" }])} style={S.ghostBtn}>
                    + Step
                  </button>
                  <button
                    onClick={addMilestone}
                    disabled={!mName.trim() || !mSteps.some(s => s.name.trim())}
                    style={{
                      ...S.addBtn, padding: "8px 14px",
                      opacity: (mName.trim() && mSteps.some(s => s.name.trim())) ? 1 : 0.35,
                    }}
                  >
                    + Add
                  </button>
                </div>
              </div>
            )}

            {/* Quit habit form */}
            {goalTab === "quitHabit" && (
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  padding: "8px 12px", marginBottom: 10,
                  background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 6,
                }}>
                  <p style={{ fontSize: 10, color: "#A78BFA", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                    ○ RESILIENCE · XP only when your streak beats your personal best
                  </p>
                </div>
                <input
                  style={{ ...S.fInput, marginBottom: 8 }}
                  value={qName}
                  onChange={e => setQName(e.target.value)}
                  placeholder="e.g., No social media scrolling"
                  onKeyDown={e => e.key === "Enter" && addQuitHabit()}
                  autoFocus
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 7, marginBottom: 7 }}>
                  <select style={S.fInput} value={qTemplate} onChange={e => setQTemplate(e.target.value)}>
                    {Object.entries(HABIT_TEMPLATES).map(([k, v]) => (
                      <option key={k} value={k}>{k} ({v} base)</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {Object.entries(DIFFICULTY_MULTIPLIER).map(([d, m]) => (
                    <button key={d} onClick={() => setQDiff(d)} style={{
                      flex: 1, borderRadius: 6, padding: "7px 0",
                      fontSize: 11, fontWeight: 600, cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                      background: qDiff === d ? "#7C3AED" : "var(--surface-2)",
                      color: qDiff === d ? "#fff" : "var(--text-secondary)",
                      border: `1px solid ${qDiff === d ? "#A78BFA" : "var(--border)"}`,
                      transition: "all 0.15s",
                    }}>{d} ×{m}</button>
                  ))}
                  <button
                    onClick={addQuitHabit}
                    disabled={!qName.trim()}
                    style={{ ...S.addBtn, padding: "7px 14px", opacity: qName.trim() ? 1 : 0.35, whiteSpace: "nowrap", background: "#7C3AED", boxShadow: "0 2px 14px rgba(124,58,237,0.35)" }}
                  >+ Add</button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>XP ON NEW RECORD</p>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color: "#A78BFA" }}>
                    +{calcBaseXP(qTemplate, qDiff, "Resilience", "habitual")}
                  </span>
                </div>
              </div>
            )}

            {/* Added goals list */}
            {goals.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ height: 1, background: "var(--border-light)", marginBottom: 12 }} />
                <p style={{ ...S.panelLbl, marginBottom: 8 }}>
                  Added ({goals.length})
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {goals.map(g => (
                    <div key={g.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderLeft: `2px solid ${CAT_META[g.category]?.accent || "var(--accent)"}`,
                      borderRadius: 6,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, color: "var(--text-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {g.name}
                        </span>
                        <span style={{
                          fontSize: 10, color: "var(--text-secondary)",
                          fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                        }}>
                          {g.category.toUpperCase()} ·{" "}
                          {g.type === "habitual"
                            ? `+${calcBaseXP(g.template, g.difficulty, g.category, "habitual")} XP`
                            : g.type === "quitHabit"
                            ? `QUIT · +${calcBaseXP(g.template, g.difficulty, "Resilience", "habitual")} XP on record`
                            : `${g.milestoneSteps.length} STEPS · +${calcBaseXP(g.template, g.difficulty, g.category, "milestone")} XP`}
                        </span>
                      </div>
                      <button onClick={() => removeGoal(g.id)} style={S.delBtn}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={S.backBtn} onClick={() => setStep(2)}>← Back</button>
              <button
                style={S.nextBtn}
                onClick={() => onFinish(title, catGoals, weights, reqRank, goals)}
              >
                Begin Level {level.num}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
