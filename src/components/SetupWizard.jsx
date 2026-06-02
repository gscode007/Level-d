import { useState } from "react";
import { USER_CATEGORIES, CAT_META } from "../constants";
import styles from "../styles.module.css";
import AddSheet from "./AddSheet";
import QuestSheet from "./QuestSheet";

/* ──────────────────────────────────────────────────────────────────────────
   SetupWizard — four-step onboarding using Level-d's existing visual system.
   Steps:
     1. Arc goal — the 3–8 year master aspiration that frames every level
        that follows. Finishing setup auto-starts the arc and stamps the
        current chapter as "Level 1".
     2. Identity statements (per dimension)
     3. Weights — how the dimensions are prioritized inside this arc. No
        "target rank" picker; under an arc, advancement is governed by the
        rank dual-gate (XP + boss) defined in gamification.config.js.
     4. Initial goals — a few habits / quit-habits / milestones / quests that
        the level starts with. These are stamped locked:true, so they share
        the same 3-day edit window as before: editable for the first 3 days
        of the level, immutable after. More can still be added later.
   ────────────────────────────────────────────────────────────────────────── */

const STEPS = ["Arc", "Identities", "Weights", "Goals"];

const GOAL_TYPES = [
  { key: "habitual",  label: "Habit" },
  { key: "milestone", label: "Milestone" },
  { key: "quitHabit", label: "Quit" },
  { key: "quest",     label: "Quest" },
];

export default function SetupWizard({ level, onFinish }) {
  const [step, setStep] = useState(0);
  const [arcGoal, setArcGoal] = useState("");
  const [catGoals, setCatGoals] = useState({ ...level.categoryGoals });
  const [weights, setWeights] = useState({ ...level.weights });

  // Step 4 — initial goals collected before the level begins.
  const [goals, setGoals]   = useState([]); // habit / milestone / quit payloads
  const [quests, setQuests] = useState([]); // quest payloads
  const [addType, setAddType] = useState(null);   // opens AddSheet for this type
  const [questOpen, setQuestOpen] = useState(false);

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

  const canAdvance = step === 0 ? !!arcGoal.trim() : true;
  function next()   { setStep((s) => Math.min(STEPS.length - 1, s + 1)); }
  function back()   { setStep((s) => Math.max(0, s - 1)); }
  function finish() { onFinish(arcGoal.trim(), catGoals, weights, goals, quests); }

  function addGoalPayload(g)  { setGoals((arr) => [...arr, g]); setAddType(null); }
  function removeGoal(i)      { setGoals((arr) => arr.filter((_, idx) => idx !== i)); }
  function addQuestPayload(q) { setQuests((arr) => [...arr, q]); setQuestOpen(false); }
  function removeQuest(i)     { setQuests((arr) => arr.filter((_, idx) => idx !== i)); }

  return (
    <div className={styles.setupWrap}>
      <div className={styles.setupCard} style={{ maxWidth: 520 }}>

        {/* Step indicators */}
        <div className={styles.stepRow} style={{ alignItems: "flex-start" }}>
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

        {/* Step 0 — arc goal */}
        {step === 0 && (
          <div style={{ animation: "fadeUp 0.3s var(--easing-out)" }}>
            <p className={styles.eyebrow}>Level 1</p>
            <h1 className={styles.setupH}>What's the arc<br />you're starting?</h1>
            <p className={styles.setupDesc}>
              The master goal that frames the next several years. Levels (Level 1, 2, 3…) ladder up
              inside this arc. Rank climbs E → S as you clear qualifying levels.
            </p>
            <input
              className={styles.bigInput}
              value={arcGoal}
              onChange={(e) => setArcGoal(e.target.value)}
              placeholder="e.g., Become a published novelist"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && canAdvance && next()}
            />
            <button
              className={styles.nextBtn}
              style={{ opacity: canAdvance ? 1 : 0.35 }}
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
            <p className={styles.eyebrow}>{arcGoal}</p>
            <h1 className={styles.setupH}>Who you're<br />becoming</h1>
            <p className={styles.setupDesc}>An identity statement for each dimension. Your habits will be evidence for these.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {USER_CATEGORIES.map((cat) => (
                <div key={cat} className={styles.catGoalRow}>
                  <div className={styles.catGoalLbl}>
                    <span style={{ color: CAT_META[cat].accent, fontSize: 14 }}>{CAT_META[cat].symbol}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.03em" }}>{cat}</span>
                  </div>
                  <input
                    className={styles.inlineInput}
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
                <div className={styles.catGoalLbl}>
                  <span style={{ color: CAT_META.Resilience.accent, fontSize: 14 }}>{CAT_META.Resilience.symbol}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.03em" }}>Resilience</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                  AUTO · +5 XP per habit · decays on missed days
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button className={styles.backBtn} onClick={back}>← Back</button>
              <button className={styles.nextBtn} onClick={next}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 2 — weights (no per-level rank picker under arc mode) */}
        {step === 2 && (
          <div style={{ animation: "fadeUp 0.3s var(--easing-out)" }}>
            <p className={styles.eyebrow}>{arcGoal}</p>
            <h1 className={styles.setupH}>Prioritize your<br />dimensions</h1>
            <p className={styles.setupDesc}>Drag to weight each dimension — total stays 100%.</p>
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

            <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
              <button className={styles.backBtn} onClick={back}>← Back</button>
              <button className={styles.nextBtn} onClick={next}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3 — initial goals */}
        {step === 3 && (
          <div style={{ animation: "fadeUp 0.3s var(--easing-out)" }}>
            <p className={styles.eyebrow}>{arcGoal}</p>
            <h1 className={styles.setupH}>Set your<br />starting goals</h1>
            <p className={styles.setupDesc}>
              A few habits, milestones, quit-habits, or quests to begin with. These lock 3 days
              after the level starts — choose carefully. You can always add more later.
            </p>

            {/* Type buttons */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, marginBottom: 14 }}>
              {GOAL_TYPES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => (key === "quest" ? setQuestOpen(true) : setAddType(key))}
                  style={{
                    flex: 1, minWidth: 80, borderRadius: 6, padding: "9px 0",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "var(--font-mono)", letterSpacing: "0.03em",
                    background: "var(--surface-2)", color: "var(--text-secondary)",
                    border: "1px solid var(--border)", transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >+ {label}</button>
              ))}
            </div>

            {/* Collected list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
              {goals.length === 0 && quests.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", padding: "18px 0", fontStyle: "italic" }}>
                  No starting goals yet — add a few, or begin with none.
                </p>
              )}
              {goals.map((g, i) => {
                const cat = g.type === "quitHabit" ? "Resilience" : g.category;
                const meta = CAT_META[cat] || {};
                const typeLabel = g.type === "quitHabit" ? "QUIT" : g.type === "milestone" ? "MILESTONE" : "HABIT";
                return (
                  <SetupGoalRow key={`g${i}`} accent={meta.accent} symbol={meta.symbol}
                    name={g.name} meta={`${typeLabel} · ${cat.toUpperCase()}`} onRemove={() => removeGoal(i)} />
                );
              })}
              {quests.map((q, i) => {
                const meta = CAT_META[q.dimension] || {};
                return (
                  <SetupGoalRow key={`q${i}`} accent="var(--yellow)" symbol="◇"
                    name={q.title} meta={`QUEST · ${q.dimension.toUpperCase()} · ${String(q.band).toUpperCase()}${q.signature ? " · ★" : ""}`}
                    onRemove={() => removeQuest(i)} />
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button className={styles.backBtn} onClick={back}>← Back</button>
              <button className={styles.nextBtn} onClick={finish}>Begin Level 1</button>
            </div>
          </div>
        )}
      </div>

      {addType && (
        <AddSheet
          type={addType}
          onAdd={(g) => addGoalPayload(g)}
          onClose={() => setAddType(null)}
        />
      )}
      {questOpen && (
        <QuestSheet
          chapterTitle={title}
          onAdd={(q) => addQuestPayload(q)}
          onClose={() => setQuestOpen(false)}
        />
      )}
    </div>
  );
}

function SetupGoalRow({ accent, symbol, name, meta, onRemove }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", borderRadius: 6,
      background: "var(--surface-2)", border: "1px solid var(--border)",
      borderLeft: `2px solid ${accent || "var(--accent)"}`,
    }}>
      <span style={{ color: accent || "var(--accent)", fontSize: 13, flexShrink: 0 }}>{symbol}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", marginTop: 2 }}>{meta}</div>
      </div>
      <button onClick={onRemove} title="Remove" className={styles.delBtn} style={{ flexShrink: 0 }}>✕</button>
    </div>
  );
}
