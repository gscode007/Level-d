import { useEffect, useState } from "react";
import { CAT_META } from "../constants";
import { calcBaseXP } from "../utils";
import { S } from "../styles";

/* ──────────────────────────────────────────────────────────────────────────
   AgentSuggestModal — calls /api/agent/generate, lets the user review the
   returned habits / milestones / quit habits, and adds the selected ones
   in a single batch via onAddGoals.

   Match the visual pattern of AddSheet (bottom-sheet on mobile, centered
   on desktop) so it blends with the rest of the app.
   ────────────────────────────────────────────────────────────────────────── */

export default function AgentSuggestModal({ level, existingGoalNames, onAddGoals, onClose }) {
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [suggestions, setSuggestions] = useState({ habits: [], milestones: [], quitHabits: [] });
  // selected keyed as `${kind}-${idx}` so we can toggle per item
  const [selected, setSelected]     = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/agent/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chapterTitle: level.title || "",
        categoryGoals: level.categoryGoals || {},
        existingGoalNames: existingGoalNames || [],
      }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setSuggestions(data);
        // Default: all items selected, the user opts out of ones they don't want
        const initial = {};
        (data.habits     || []).forEach((_, i) => { initial[`habit-${i}`]    = true; });
        (data.milestones || []).forEach((_, i) => { initial[`milestone-${i}`] = true; });
        (data.quitHabits || []).forEach((_, i) => { initial[`quit-${i}`]     = true; });
        setSelected(initial);
      })
      .catch((e) => { if (!cancelled) setError(e.message || String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [level.title, level.categoryGoals, existingGoalNames]);

  function toggle(key) {
    setSelected((s) => ({ ...s, [key]: !s[key] }));
  }

  function handleAdd() {
    const out = [];

    (suggestions.habits || []).forEach((h, i) => {
      if (!selected[`habit-${i}`]) return;
      out.push({
        name: h.name,
        category: h.category,
        template: h.template,
        difficulty: h.difficulty,
        type: "habitual",
        frequency: h.frequency,
      });
    });

    (suggestions.milestones || []).forEach((m, i) => {
      if (!selected[`milestone-${i}`]) return;
      out.push({
        name: m.name,
        category: m.category,
        template: m.template,
        difficulty: m.difficulty,
        type: "milestone",
        milestoneSteps: m.steps.map((s) => ({ name: s, completed: false })),
      });
    });

    (suggestions.quitHabits || []).forEach((q, i) => {
      if (!selected[`quit-${i}`]) return;
      out.push({
        name: q.name,
        category: "Resilience",
        template: q.template,
        difficulty: q.difficulty,
        type: "quitHabit",
        currentStreak: 0,
        bestStreak: 0,
        lastResistDate: null,
        lastCheckedDate: null,
        succumbLog: [],
        resistLog: [],
      });
    });

    if (out.length === 0) {
      onClose();
      return;
    }
    onAddGoals(out);
    onClose();
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const totalCount    = (suggestions.habits?.length || 0)
                      + (suggestions.milestones?.length || 0)
                      + (suggestions.quitHabits?.length || 0);

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
        width: "100%", maxWidth: 560,
        animation: "slideUp 0.3s var(--easing-spring)",
        maxHeight: "88vh", overflowY: "auto",
      }}>
        <div style={{ width: 28, height: 3, background: "var(--border)", borderRadius: 2, margin: "0 auto 22px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.02em" }}>
            ◆ AI Agent · Suggested Goals
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
          fontSize: 11, color: "var(--text-tertiary)",
          fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
          marginBottom: 18,
        }}>
          Generated from your chapter title and identity statements. Uncheck anything you don't want.
        </p>

        {loading && <Loading />}
        {error && <ErrorBlock message={error} onRetry={() => window.location.reload()} />}

        {!loading && !error && (
          <>
            <Section title="Habits" items={suggestions.habits} kindPrefix="habit" selected={selected} toggle={toggle} renderItem={renderHabit} />
            <Section title="Milestones" items={suggestions.milestones} kindPrefix="milestone" selected={selected} toggle={toggle} renderItem={renderMilestone} />
            <Section title="Quit Habits" items={suggestions.quitHabits} kindPrefix="quit" selected={selected} toggle={toggle} renderItem={renderQuit} />

            {totalCount === 0 && (
              <div style={{ padding: "30px 0", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
                  The agent didn't return any suggestions. Try filling in your identity statements first.
                </p>
              </div>
            )}

            <button
              onClick={handleAdd}
              disabled={selectedCount === 0}
              style={{
                ...S.nextBtn,
                marginTop: 18,
                opacity: selectedCount === 0 ? 0.35 : 1,
              }}
            >
              {selectedCount === 0
                ? "Select at least one to add"
                : `Add ${selectedCount} of ${totalCount}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, items, kindPrefix, selected, toggle, renderItem }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ ...S.panelLbl, marginBottom: 8 }}>{title} ({items.length})</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => {
          const key = `${kindPrefix}-${i}`;
          const isSelected = !!selected[key];
          const accent = CAT_META[item.category]?.accent || "#A78BFA";
          return (
            <div
              key={key}
              onClick={() => toggle(key)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "10px 12px",
                background: isSelected ? "rgba(59,130,246,0.06)" : "var(--surface-2)",
                border: `1px solid ${isSelected ? "rgba(59,130,246,0.25)" : "var(--border)"}`,
                borderLeft: `2px solid ${accent}`,
                borderRadius: 6, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {/* Checkbox */}
              <div style={{
                width: 18, height: 18, borderRadius: 3, flexShrink: 0,
                marginTop: 1,
                border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                background: isSelected ? "var(--accent)" : "transparent",
                color: "#fff", fontSize: 11, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
                boxShadow: isSelected ? "0 0 6px rgba(59,130,246,0.4)" : "none",
              }}>
                {isSelected && "✓"}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>{renderItem(item)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderHabit(h) {
  const xp = calcBaseXP(h.template, h.difficulty, h.category, "habitual");
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{h.name}</div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
        {h.category.toUpperCase()} · {h.template.toUpperCase()} · {h.difficulty.toUpperCase()} · {h.frequency >= 7 ? "DAILY" : `${h.frequency}×/WK`} · +{xp} XP
      </div>
    </>
  );
}

function renderMilestone(m) {
  const totalXP = calcBaseXP(m.template, m.difficulty, m.category, "milestone");
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{m.name}</div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
        {m.category.toUpperCase()} · {m.template.toUpperCase()} · {m.difficulty.toUpperCase()} · {m.steps.length} STEPS · +{totalXP} XP
      </div>
      <ul style={{ margin: "6px 0 0", padding: "0 0 0 14px", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.55 }}>
        {m.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </>
  );
}

function renderQuit(q) {
  const xp = calcBaseXP(q.template, q.difficulty, "Resilience", "habitual");
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{q.name}</div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
        RESILIENCE · {q.template.toUpperCase()} · {q.difficulty.toUpperCase()} · +{xp} XP ON RECORD
      </div>
    </>
  );
}

function Loading() {
  return (
    <div style={{ padding: "40px 0", textAlign: "center" }}>
      <div style={{
        width: 28, height: 28, margin: "0 auto",
        border: "2px solid var(--border)",
        borderTopColor: "var(--accent)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 14, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
        AGENT IS THINKING…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorBlock({ message, onRetry }) {
  return (
    <div style={{
      padding: "16px 18px",
      background: "rgba(239,68,68,0.06)",
      border: "1px solid rgba(239,68,68,0.25)",
      borderRadius: 6,
      marginBottom: 18,
    }}>
      <p style={{ fontSize: 12, color: "var(--red)", marginBottom: 8, fontWeight: 600 }}>
        ◇ Agent request failed
      </p>
      <p style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5, fontFamily: "var(--font-mono)" }}>
        {message}
      </p>
      <p style={{ fontSize: 10, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
        If this is your first time, you may need to set <code>ANTHROPIC_API_KEY</code> in your Vercel project env vars.
      </p>
      <button
        onClick={onRetry}
        style={{ ...S.ghostBtn, marginTop: 12, fontSize: 11, padding: "6px 12px" }}
      >Retry</button>
    </div>
  );
}
