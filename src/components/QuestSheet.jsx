import { useState } from "react";
import { USER_CATEGORIES, CAT_META } from "../constants";
import { DEFAULT_GAMIFICATION_CONFIG } from "../gamification.config.js";
import styles from "../styles.module.css";

const BANDS = ["small", "medium", "large"];

export default function QuestSheet({ chapterTitle, onAdd, onClose }) {
  const bands = DEFAULT_GAMIFICATION_CONFIG.quests.bands;
  const [title, setTitle]         = useState("");
  const [dimension, setDimension] = useState("Emotional");
  const [band, setBand]           = useState(DEFAULT_GAMIFICATION_CONFIG.quests.defaultBand);
  const [signature, setSignature] = useState(false);
  const [chapterLinked, setChapterLinked] = useState(true);

  function handleSubmit() {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), dimension, band, signature, chapterLinked });
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
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
            New Quest
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

        {/* Title */}
        <div style={{ marginBottom: 14 }}>
          <label className={styles.fLbl}>Title</label>
          <input
            className={styles.fInput}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g., Ship the portfolio site"
            autoFocus
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
          />
        </div>

        {/* Dimension */}
        <div style={{ marginBottom: 14 }}>
          <label className={styles.fLbl}>Identity dimension</label>
          <select className={styles.fInput} value={dimension} onChange={e => setDimension(e.target.value)}>
            {USER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Band */}
        <div style={{ marginBottom: 14 }}>
          <label className={styles.fLbl}>Reward band</label>
          <div style={{ display: "flex", gap: 6 }}>
            {BANDS.map(b => (
              <button
                key={b}
                onClick={() => setBand(b)}
                style={{
                  flex: 1, borderRadius: 6, padding: "8px 0",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                  textTransform: "capitalize",
                  background: band === b ? "var(--accent)" : "var(--surface-2)",
                  color: band === b ? "#fff" : "var(--text-secondary)",
                  border: `1px solid ${band === b ? "var(--accent)" : "var(--border)"}`,
                  boxShadow: band === b ? "0 0 10px rgba(59,130,246,0.3)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {b} · +{bands[b]}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          <Toggle
            checked={signature}
            onToggle={() => setSignature(v => !v)}
            label="Signature quest"
            hint="Defines what advancement looks like — counts toward this level's trial."
            color="var(--yellow)"
          />
          <Toggle
            checked={chapterLinked}
            onToggle={() => setChapterLinked(v => !v)}
            label="Link to this chapter"
            hint={chapterLinked ? `Tied to "${chapterTitle || "current chapter"}".` : "Standalone — not tied to any chapter."}
            color="var(--accent)"
          />
        </div>

        {/* XP preview */}
        <div style={{
          padding: "10px 14px", borderRadius: 6,
          background: "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.18)",
          marginBottom: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
            XP ON COMPLETION · {CAT_META[dimension]?.symbol} {dimension.toUpperCase()}
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
            +{bands[band]}
          </span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!title.trim()}
          className={styles.nextBtn}
          style={{ opacity: title.trim() ? 1 : 0.35, marginTop: 4 }}
        >
          Add Quest
        </button>
      </div>
    </div>
  );
}

function Toggle({ checked, onToggle, label, hint, color }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "10px 12px", borderRadius: 7, textAlign: "left",
        background: checked ? `${color}12` : "var(--surface-2)",
        border: `1px solid ${checked ? color : "var(--border)"}`,
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
        background: checked ? color : "transparent",
        border: `1.5px solid ${checked ? color : "var(--border)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, color: "#fff", fontWeight: 700,
      }}>{checked ? "✓" : ""}</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: checked ? color : "var(--text-secondary)" }}>{label}</div>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2, lineHeight: 1.4 }}>{hint}</div>
      </div>
    </button>
  );
}
