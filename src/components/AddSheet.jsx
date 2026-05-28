import { useState, useEffect } from "react";
import { USER_CATEGORIES, CAT_META, HABIT_TEMPLATES, MILESTONE_TEMPLATES, DIFFICULTY_MULTIPLIER, SMART_TEMPLATE, FREQUENCY_OPTIONS } from "../constants";
import { calcBaseXP } from "../utils";
import { DEFAULT_GAMIFICATION_CONFIG } from "../gamification.config.js";
import { S } from "../styles";

const EMPTY_ANCHOR = { cue: "", location: "", action: "", prep: "" };

const ANCHOR_PLACEHOLDERS = {
  cue:      "after morning coffee",
  location: "kitchen counter",
  action:   "5-min brain dump in gray notebook",
  prep:     "notebook left open the night before (optional)",
};

const ANCHOR_LABELS = {
  cue:      "Cue",
  location: "Location",
  action:   "Action",
  prep:     "Prep",
};

export default function AddSheet({ type, editing, onAdd, onUpdate, onClose }) {
  const isEditMode = !!editing;
  const effectiveType = editing?.type || type;

  const [name, setName]         = useState(editing?.name || "");
  const [cat, setCat]           = useState(editing?.category && editing.category !== "Resilience" ? editing.category : "Emotional");
  const [template, setTemplate] = useState(editing?.template || SMART_TEMPLATE["Emotional"][effectiveType] || "Standard");
  const [difficulty, setDiff]   = useState(editing?.difficulty || "Medium");
  const [frequency, setFreq]    = useState(editing?.frequency || 7);
  const [steps, setSteps]       = useState(
    editing?.milestoneSteps?.map(s => ({ name: s.name, completed: s.completed })) || [{ name: "" }, { name: "" }]
  );

  // Secondary identities a habit "also votes for". Primary `cat` owns XP;
  // secondaries are visual credit only. Persisted as full list incl. primary.
  const [secondaries, setSecondaries] = useState(() => {
    const ids = editing?.identities;
    const primary = editing?.category;
    if (Array.isArray(ids) && ids.length > 0) return ids.filter(i => i !== primary);
    return [];
  });

  const [anchor, setAnchor]   = useState({ ...EMPTY_ANCHOR, ...(editing?.anchor || {}) });
  const [notes, setNotes]     = useState(editing?.notes || "");
  const [fallback, setFallback] = useState(editing?.ifThenFallback || "");
  const [anchorOpen, setAnchorOpen] = useState(isEditMode && !!editing?.anchor?.cue);

  // Optional surge variant — a harder target + a modest XP multiplier the user
  // can pick at completion. Habitual goals only.
  const [surgeTarget, setSurgeTarget] = useState(editing?.surge?.target || "");
  const [surgeMult, setSurgeMult]     = useState(editing?.surge?.multiplier || DEFAULT_GAMIFICATION_CONFIG.surge.defaultMultiplier);
  const [surgeOpen, setSurgeOpen]     = useState(isEditMode && !!editing?.surge?.target);

  // If the user changes primary category to one currently selected as secondary,
  // drop it from secondaries so a dimension can't be both primary and secondary.
  useEffect(() => {
    setSecondaries(prev => prev.filter(i => i !== cat));
  }, [cat]);

  useEffect(() => {
    if (isEditMode) return;
    setTemplate(SMART_TEMPLATE[cat]?.[effectiveType] || Object.keys(effectiveType === "milestone" ? MILESTONE_TEMPLATES : HABIT_TEMPLATES)[0]);
  }, [cat, effectiveType, isEditMode]);

  const isQuit    = effectiveType === "quitHabit";
  const templates = effectiveType === "milestone" ? MILESTONE_TEMPLATES : HABIT_TEMPLATES;
  const effectiveCat = isQuit ? "Resilience" : cat;
  const previewXP = calcBaseXP(template, difficulty, effectiveCat, effectiveType === "milestone" ? "milestone" : "habitual");
  const stepXP    = effectiveType === "milestone" && steps.filter(s => s.name.trim()).length > 0
    ? Math.round(previewXP / steps.filter(s => s.name.trim()).length)
    : 0;

  // Strip empty anchor fields, keep undefined if entirely blank
  function packAnchor() {
    const filled = Object.fromEntries(Object.entries(anchor).filter(([_, v]) => v.trim()));
    return Object.keys(filled).length ? filled : null;
  }

  function packExtras() {
    const extras = {};
    const a = packAnchor();
    if (a) extras.anchor = a;
    if (notes.trim()) extras.notes = notes.trim();
    if (fallback.trim()) extras.ifThenFallback = fallback.trim();
    return extras;
  }

  // Only persist `identities` when there's at least one secondary. Single-identity
  // habits keep the legacy shape (no identities field) — the helper handles that.
  function packIdentities() {
    if (isQuit || effectiveType !== "habitual") return null;
    if (secondaries.length === 0) return null;
    return [cat, ...secondaries];
  }

  // Surge variant: only when a target is set and it's a habit. multiplier is a
  // positive kicker; falls back to the config default if blank/invalid.
  function packSurge() {
    if (isQuit || effectiveType !== "habitual") return null;
    const target = surgeTarget.trim();
    if (!target) return null;
    const m = Number(surgeMult);
    return { target: target.slice(0, 80), multiplier: m > 0 ? m : DEFAULT_GAMIFICATION_CONFIG.surge.defaultMultiplier };
  }

  function handleSubmit() {
    if (!name.trim()) return;
    const extras = packExtras();
    const identities = packIdentities();
    const surge = packSurge();

    if (isEditMode) {
      const patch = { name: name.trim(), template, difficulty, ...extras };
      // Clear extras that were removed (so they don't persist as stale)
      if (!extras.anchor) patch.anchor = null;
      if (!extras.notes) patch.notes = null;
      if (!extras.ifThenFallback) patch.ifThenFallback = null;
      if (!isQuit) patch.category = cat;
      if (effectiveType === "habitual" || isQuit) patch.frequency = frequency;
      if (effectiveType === "milestone") {
        const validSteps = steps.filter(s => s.name.trim()).map(s => ({ name: s.name.trim(), completed: !!s.completed }));
        if (validSteps.length === 0) return;
        patch.milestoneSteps = validSteps;
      }
      // identities: explicit array when multi, explicit null when collapsed back to single
      if (!isQuit && effectiveType === "habitual") patch.identities = identities;
      // surge: explicit object when set, explicit null when cleared
      if (!isQuit && effectiveType === "habitual") patch.surge = surge;
      onUpdate(patch);
      return;
    }

    if (isQuit) {
      onAdd({
        name: name.trim(), category: "Resilience", template, difficulty,
        type: "quitHabit", completions: [],
        currentStreak: 0, bestStreak: 0, lastResistDate: null, lastCheckedDate: null, succumbLog: [], resistLog: [],
        ...extras,
      });
      return;
    }
    const base = { name: name.trim(), category: cat, template, difficulty, type: effectiveType, frequency, ...extras };
    if (identities) base.identities = identities;
    if (surge) base.surge = surge;
    if (effectiveType === "milestone") {
      const validSteps = steps.filter(s => s.name.trim()).map(s => ({ name: s.name.trim(), completed: false }));
      if (validSteps.length === 0) return;
      onAdd({ ...base, milestoneSteps: validSteps, completions: [] });
    } else {
      onAdd({ ...base, completions: [] });
    }
  }

  const titleLabel = isEditMode ? "Edit" : "New";
  const typeLabel  = isQuit ? "Quit Habit" : effectiveType === "habitual" ? "Habit" : "Milestone";

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "fadeIn 0.2s ease",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "var(--surface)",
        borderRadius: "12px 12px 0 0",
        borderTop: "1px solid var(--border)",
        borderLeft: "1px solid var(--border)",
        borderRight: "1px solid var(--border)",
        padding: "22px 26px 44px",
        width: "100%", maxWidth: 560,
        animation: "slideUp 0.3s var(--easing-spring)",
        maxHeight: "88vh", overflowY: "auto",
      }}>
        <div style={{ width: 28, height: 3, background: "var(--border)", borderRadius: 2, margin: "0 auto 22px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.02em" }}>
            {titleLabel} {typeLabel}
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

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <label style={S.fLbl}>Name</label>
          <input
            style={S.fInput}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={effectiveType === "habitual" ? "e.g., Meditate 10 min" : "e.g., Finish online course"}
            autoFocus
            onKeyDown={e => e.key === "Enter" && effectiveType === "habitual" && handleSubmit()}
          />
        </div>

        {/* Category + Template row */}
        <div style={{ display: "grid", gridTemplateColumns: isQuit ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
          {!isQuit && (
            <div>
              <label style={S.fLbl}>Category</label>
              <select style={S.fInput} value={cat} onChange={e => setCat(e.target.value)}>
                {USER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={S.fLbl}>{isQuit ? "Template (XP on new streak record)" : "Template"}</label>
            <select style={S.fInput} value={template} onChange={e => setTemplate(e.target.value)}>
              {Object.entries(templates).map(([k, v]) => (
                <option key={k} value={k}>{k} ({v} base)</option>
              ))}
            </select>
          </div>
        </div>
        {isQuit && (
          <div style={{ marginBottom: 10, padding: "8px 12px", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 6 }}>
            <p style={{ fontSize: 10, color: "#A78BFA", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
              ○ RESILIENCE · XP awarded only when you beat your previous best streak
            </p>
          </div>
        )}

        {/* Difficulty */}
        <div style={{ marginBottom: 14 }}>
          <label style={S.fLbl}>Difficulty</label>
          <div style={{ display: "flex", gap: 6 }}>
            {Object.entries(DIFFICULTY_MULTIPLIER).map(([d, m]) => (
              <button
                key={d}
                onClick={() => setDiff(d)}
                style={{
                  flex: 1, borderRadius: 6, padding: "8px 0",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                  background: difficulty === d ? "var(--accent)" : "var(--surface-2)",
                  color: difficulty === d ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${difficulty === d ? "var(--accent)" : "var(--border)"}`,
                  boxShadow: difficulty === d ? "0 0 10px rgba(59,130,246,0.3)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {d} ×{m}
              </button>
            ))}
          </div>
        </div>

        {/* Also votes for (secondary identities — habitual only) */}
        {!isQuit && effectiveType === "habitual" && (
          <div style={{ marginBottom: 14 }}>
            <label style={S.fLbl}>
              Also votes for{" "}
              <span style={{ color: "var(--text-tertiary)", fontWeight: 400, textTransform: "none", letterSpacing: "0.02em" }}>
                — extra identities this habit supports
              </span>
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {USER_CATEGORIES.filter(c => c !== cat).map(c => {
                const meta = CAT_META[c];
                const active = secondaries.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSecondaries(prev =>
                      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
                    )}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "5px 10px", borderRadius: 999,
                      fontSize: 11, fontWeight: 600, cursor: "pointer",
                      fontFamily: "var(--font-mono)", letterSpacing: "0.03em",
                      background: active ? `${meta.accent}20` : "var(--surface-2)",
                      color: active ? meta.accent : "var(--text-tertiary)",
                      border: `1px solid ${active ? meta.accent : "var(--border)"}`,
                      boxShadow: active ? `0 0 8px ${meta.accent}40` : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 12, lineHeight: 1 }}>{meta.symbol}</span>
                    {c}
                  </button>
                );
              })}
            </div>
            {secondaries.length === 0 && (
              <p style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 6, letterSpacing: "0.04em" }}>
                XP STILL ACCRUES ONLY TO {cat.toUpperCase()} · SECONDARIES ARE VISUAL VOTES
              </p>
            )}
          </div>
        )}

        {/* Frequency (habits only) */}
        {(effectiveType === "habitual" || isQuit) && (
          <div style={{ marginBottom: 14 }}>
            <label style={S.fLbl}>Frequency</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {FREQUENCY_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setFreq(value)}
                  style={{
                    flex: 1, minWidth: 56, borderRadius: 6, padding: "7px 4px",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                    fontFamily: "var(--font-mono)", letterSpacing: "0.02em",
                    background: frequency === value ? "var(--accent)" : "var(--surface-2)",
                    color: frequency === value ? "#fff" : "var(--text-secondary)",
                    border: `1px solid ${frequency === value ? "var(--accent)" : "var(--border)"}`,
                    transition: "all 0.15s",
                  }}
                >{label}</button>
              ))}
            </div>
            {frequency < 7 && (
              <p style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 5, letterSpacing: "0.04em" }}>
                STREAK TRACKS CONSECUTIVE WEEKS WHERE TARGET IS MET
              </p>
            )}
          </div>
        )}

        {/* XP Preview */}
        <div style={{
          padding: "10px 14px", borderRadius: 6,
          background: "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.18)",
          marginBottom: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
            {effectiveType === "habitual" ? "XP PER COMPLETION" : `TOTAL XP${stepXP ? ` · ${stepXP} PER STEP` : ""}`}
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
            +{previewXP}
          </span>
        </div>

        {/* Streak hint */}
        {(effectiveType === "habitual" || isQuit) && (
          <p style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", marginBottom: 16 }}>
            🔥 STREAK MULTIPLIER: ×1.2 at 7d · ×1.5 at 21d
          </p>
        )}

        {/* Milestone steps */}
        {!isQuit && effectiveType === "milestone" && (
          <div style={{ marginBottom: 14 }}>
            <label style={S.fLbl}>Steps</label>
            {steps.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 7, marginBottom: 7, alignItems: "center" }}>
                <input
                  style={{ ...S.fInput, flex: 1 }}
                  value={step.name}
                  onChange={e => setSteps(s => s.map((st, idx) => idx === i ? { ...st, name: e.target.value } : st))}
                  placeholder={`Step ${i + 1}`}
                />
                {steps.length > 1 && (
                  <button onClick={() => setSteps(s => s.filter((_, idx) => idx !== i))} style={S.delBtn}>✕</button>
                )}
              </div>
            ))}
            <button onClick={() => setSteps(s => [...s, { name: "" }])} style={S.ghostBtn}>
              + Add step
            </button>
          </div>
        )}

        {/* ── Surge variant (habits only) ── */}
        {!isQuit && effectiveType === "habitual" && (
          <div style={{
            marginTop: 8, marginBottom: 14,
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--surface-2)",
            overflow: "hidden",
          }}>
            <button
              type="button"
              onClick={() => setSurgeOpen(o => !o)}
              style={{
                width: "100%", background: "transparent", border: "none",
                padding: "11px 14px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                cursor: "pointer", color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
                textTransform: "uppercase", fontWeight: 600,
              }}
            >
              <span>
                ⚡ Surge &nbsp;
                <span style={{ color: "var(--text-tertiary)", fontWeight: 400, textTransform: "none", letterSpacing: "0.02em" }}>
                  optional harder target → bonus XP
                </span>
              </span>
              <span style={{ color: "var(--text-tertiary)" }}>{surgeOpen ? "−" : "+"}</span>
            </button>

            {surgeOpen && (
              <div style={{ padding: "4px 14px 14px" }}>
                <div style={{ marginBottom: 9 }}>
                  <label style={{ ...S.fLbl, fontSize: 8 }}>Surge target</label>
                  <input
                    style={S.fInput}
                    value={surgeTarget}
                    onChange={e => setSurgeTarget(e.target.value)}
                    placeholder="e.g., 100 push-ups (vs the usual 30)"
                  />
                </div>
                <div style={{ marginBottom: 4 }}>
                  <label style={{ ...S.fLbl, fontSize: 8 }}>Surge multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    style={{ ...S.fInput, maxWidth: 120 }}
                    value={surgeMult}
                    onChange={e => setSurgeMult(e.target.value)}
                  />
                </div>
                <p style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 6, letterSpacing: "0.02em" }}>
                  Pick baseline or surge when you complete. Surge counts as a normal completion for streaks; XP stacks with your streak (capped at the global ceiling).
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Anchor (implementation intention) ── */}
        <div style={{
          marginTop: 8, marginBottom: 14,
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--surface-2)",
          overflow: "hidden",
        }}>
          <button
            type="button"
            onClick={() => setAnchorOpen(o => !o)}
            style={{
              width: "100%", background: "transparent", border: "none",
              padding: "11px 14px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              cursor: "pointer", color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
              textTransform: "uppercase", fontWeight: 600,
            }}
          >
            <span>
              ◆ Anchor &nbsp;
              <span style={{ color: "var(--text-tertiary)", fontWeight: 400, textTransform: "none", letterSpacing: "0.02em" }}>
                trigger + location + action → 2× follow-through
              </span>
            </span>
            <span style={{ color: "var(--text-tertiary)" }}>{anchorOpen ? "−" : "+"}</span>
          </button>

          {anchorOpen && (
            <div style={{ padding: "4px 14px 14px" }}>
              {["cue", "location", "action", "prep"].map(key => (
                <div key={key} style={{ marginBottom: 9 }}>
                  <label style={{ ...S.fLbl, fontSize: 8 }}>{ANCHOR_LABELS[key]}{key === "prep" ? " (optional)" : ""}</label>
                  <input
                    style={S.fInput}
                    value={anchor[key]}
                    onChange={e => setAnchor(a => ({ ...a, [key]: e.target.value }))}
                    placeholder={ANCHOR_PLACEHOLDERS[key]}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 9 }}>
                <label style={{ ...S.fLbl, fontSize: 8 }}>If / Then Fallback (optional)</label>
                <input
                  style={S.fInput}
                  value={fallback}
                  onChange={e => setFallback(e.target.value)}
                  placeholder="If I miss morning coffee, then I will brain-dump at the desk before email"
                />
                <p style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 4, letterSpacing: "0.02em" }}>
                  Coping intention for the failure case — proven to lift follow-through under stress
                </p>
              </div>

              <div>
                <label style={{ ...S.fLbl, fontSize: 8 }}>Notes — why this habit matters</label>
                <textarea
                  style={{ ...S.fInput, minHeight: 60, resize: "vertical", fontFamily: "'Geist', sans-serif", lineHeight: 1.5 }}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="What does success look like? Why am I doing this?"
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || (!isQuit && effectiveType === "milestone" && !steps.some(s => s.name.trim()))}
          style={{
            ...S.nextBtn,
            opacity: (name.trim() && (isQuit || effectiveType !== "milestone" || steps.some(s => s.name.trim()))) ? 1 : 0.35,
            marginTop: 8,
          }}
        >
          {isEditMode ? "Save changes" : "Add Goal"}
        </button>
      </div>
    </div>
  );
}
