import { useState, useEffect, useRef } from "react";

const AUTO_DISMISS_MS = 5000;

export default function QuickNotePopup({ goalName, onSubmit, onClose, comeback = false }) {
  const [note, setNote] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  // Auto-dismiss after 5s of inactivity. Reset on every keystroke / focus.
  function resetTimer() {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
  }

  useEffect(() => {
    resetTimer();
    return () => clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (dismissed) {
      // Brief fade before close
      const t = setTimeout(onClose, 200);
      return () => clearTimeout(t);
    }
  }, [dismissed, onClose]);

  function handleSubmit(e) {
    e?.preventDefault();
    if (note.trim()) onSubmit(note.trim());
    setDismissed(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      onClick={() => { clearTimeout(timerRef.current); }}
      style={{
        position: "fixed",
        bottom: 80,
        right: 28,
        zIndex: 998,
        background: "var(--surface)",
        border: `1px solid ${comeback ? "var(--green)" : "var(--accent)"}`,
        borderLeft: `2px solid ${comeback ? "var(--green)" : "var(--accent)"}`,
        borderRadius: 8,
        padding: "10px 12px",
        width: 280,
        boxShadow: comeback
          ? "var(--shadow-lg), 0 0 24px rgba(34,197,94,0.3)"
          : "var(--shadow-lg), 0 0 24px rgba(59,130,246,0.25)",
        opacity: dismissed ? 0 : 1,
        transform: dismissed ? "translateY(8px)" : "translateY(0)",
        transition: "opacity 0.2s, transform 0.2s",
      }}
    >
      {comeback && (
        <div style={{
          fontSize: 9, fontWeight: 700, color: "var(--green)",
          fontFamily: "var(--font-mono)", letterSpacing: "0.12em",
          textTransform: "uppercase", marginBottom: 6,
          display: "flex", alignItems: "center", gap: 5,
          textShadow: "0 0 8px rgba(34,197,94,0.5)",
        }}>
          ◈ Back on track — the return is what counts
        </div>
      )}
      <div style={{
        fontSize: 9, color: "var(--text-tertiary)",
        fontFamily: "var(--font-mono)", letterSpacing: "0.1em",
        textTransform: "uppercase", marginBottom: 6,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          maxWidth: 200,
        }}>
          {goalName}
        </span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            background: "none", border: "none", color: "var(--text-tertiary)",
            cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1,
          }}
        >×</button>
      </div>
      <input
        ref={inputRef}
        autoFocus
        value={note}
        onChange={e => { setNote(e.target.value); resetTimer(); }}
        onFocus={resetTimer}
        placeholder="How was it?"
        style={{
          width: "100%",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 5,
          padding: "7px 9px",
          fontSize: 12,
          color: "var(--text-primary)",
          outline: "none",
          fontFamily: "'Geist', sans-serif",
        }}
      />
      <div style={{
        fontSize: 8, color: "var(--text-tertiary)",
        fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
        marginTop: 5, textAlign: "right",
      }}>
        ENTER TO SAVE · AUTO-DISMISS 5s
      </div>
    </form>
  );
}
