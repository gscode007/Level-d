import { useState } from "react";
import { S } from "../styles";
import ApiKeysModal from "./ApiKeysModal";

const NAV_ITEMS = [
  ["dashboard", "Dashboard", "⊞"],
  ["goals",     "Goals",     "◎"],
  ["reports",   "Reports",   "▤"],
  ["history",   "History",   "≡"],
];

// ── Collapsed icon-bar (desktop only) ────────────────────────────────────────
function CollapsedBar({ view, setView, onToggle }) {
  return (
    <aside style={{
      width: 52,
      background: "rgba(8,14,26,0.94)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      position: "sticky",
      top: 0,
      height: "100vh",
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "16px 0 12px" }}>
        <div style={{
          width: 24, height: 24, borderRadius: 4,
          background: "var(--accent-dim)", border: "1px solid var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, color: "var(--accent)", fontWeight: 700,
          boxShadow: "0 0 8px var(--accent-glow)",
        }}>◈</div>
      </div>

      <div style={{ height: 1, background: "var(--border)", width: "80%", marginBottom: 8 }} />

      {/* Nav icons */}
      <nav style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        {NAV_ITEMS.map(([id, label, icon]) => (
          <button
            key={id}
            title={label}
            onClick={() => setView(id)}
            style={{
              width: 34, height: 34, borderRadius: 6,
              background: view === id ? "var(--accent-dim)" : "transparent",
              border: `1px solid ${view === id ? "var(--accent)" : "transparent"}`,
              color: view === id ? "var(--accent)" : "var(--text-tertiary)",
              fontSize: 15, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
              boxShadow: view === id ? "inset 0 0 10px rgba(59,130,246,0.1)" : "none",
            }}
          >{icon}</button>
        ))}
      </nav>

      {/* Expand button */}
      <div style={{ marginTop: "auto", paddingBottom: 18 }}>
        <button
          onClick={onToggle}
          title="Expand sidebar"
          style={{
            width: 30, height: 30, borderRadius: 4,
            background: "var(--surface-2)", border: "1px solid var(--border)",
            color: "var(--text-tertiary)", fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >›</button>
      </div>
    </aside>
  );
}

// ── Full sidebar (expanded desktop or mobile drawer) ─────────────────────────
export default function Sidebar({ view, setView, levelNum, overallRank, user, onSignOut, onReset, collapsed, onToggle, isDrawer, onClose, aiAgentEnabled, onToggleAgent }) {
  const [keysOpen, setKeysOpen] = useState(false);

  if (collapsed && !isDrawer) {
    return <CollapsedBar view={view} setView={setView} onToggle={onToggle} />;
  }

  const closeIfDrawer = (fn) => (...args) => { fn?.(...args); if (isDrawer) onClose(); };

  return (
    <>
      {/* Backdrop (drawer only) */}
      {isDrawer && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 299,
            animation: "fadeIn 0.2s ease",
          }}
        />
      )}

      <aside style={{
        width: 220,
        background: "rgba(8,14,26,0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        ...(isDrawer ? {
          position: "fixed",
          top: 0, left: 0, bottom: 0,
          zIndex: 300,
          animation: "slideInLeft 0.26s var(--easing-spring)",
          boxShadow: "var(--shadow-lg), 8px 0 32px rgba(0,0,0,0.4)",
        } : {
          position: "sticky",
          top: 0,
          height: "100vh",
          flexShrink: 0,
        }),
      }}>
        <div style={{ flex: 1 }}>
          {/* Header */}
          <div style={{ padding: "20px 14px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 4, flexShrink: 0,
                  background: "var(--accent-dim)", border: "1px solid var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: "var(--accent)", fontWeight: 700,
                  boxShadow: "0 0 8px var(--accent-glow)",
                }}>◈</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.12em" }}>
                  LEVELD
                </div>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", paddingLeft: 30 }}>
                LV.{levelNum} · {overallRank}
              </div>
            </div>

            {/* Collapse / close button */}
            <button
              onClick={isDrawer ? onClose : onToggle}
              style={{
                width: 26, height: 26, borderRadius: 4,
                background: "var(--surface-2)", border: "1px solid var(--border)",
                color: "var(--text-tertiary)", fontSize: isDrawer ? 16 : 13,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >{isDrawer ? "×" : "‹"}</button>
          </div>

          <div style={{ height: 1, background: "var(--border)", margin: "18px 0 8px" }} />

          <nav style={{ padding: "0 8px" }}>
            {NAV_ITEMS.map(([id, label]) => (
              <button
                key={id}
                onClick={closeIfDrawer(() => setView(id))}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "9px 14px", border: "none", borderRadius: 0,
                  cursor: "pointer", fontSize: 13, letterSpacing: "0.01em",
                  background: view === id ? "var(--accent-dim)" : "transparent",
                  color: view === id ? "var(--accent)" : "var(--text-secondary)",
                  fontWeight: view === id ? 600 : 400,
                  borderLeft: view === id ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: 1,
                  boxShadow: view === id ? "inset 2px 0 12px rgba(59,130,246,0.08)" : "none",
                  transition: "all 0.15s",
                }}
              >{label}</button>
            ))}
          </nav>
        </div>

        {/* User footer */}
        <div style={{ padding: "10px 12px 18px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
            {user.photoURL ? (
              <img src={user.photoURL} alt="" style={{ width: 26, height: 26, borderRadius: 4, flexShrink: 0, border: "1px solid var(--border)" }} />
            ) : (
              <div style={{
                width: 26, height: 26, borderRadius: 4,
                background: "var(--accent-dim)", border: "1px solid var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: "var(--accent)", fontWeight: 700, flexShrink: 0,
              }}>
                {(user.displayName || user.email || "?")[0].toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.displayName || "User"}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>
                {user.email}
              </div>
            </div>
          </div>

          {/* Dev unlock for the optional, paid AI Agent feature.
              In production this gate would be flipped by a real billing event. */}
          <button
            onClick={() => onToggleAgent?.()}
            title={aiAgentEnabled ? "AI Agent unlocked (dev). Click to lock." : "AI Agent locked. Click to unlock for testing."}
            style={{
              width: "100%",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "7px 12px",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.08em",
              border: `1px solid ${aiAgentEnabled ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 6,
              background: aiAgentEnabled ? "var(--accent-dim)" : "transparent",
              color: aiAgentEnabled ? "var(--accent)" : "var(--text-tertiary)",
              cursor: "pointer",
              marginBottom: 5,
              transition: "all 0.15s",
              boxShadow: aiAgentEnabled ? "0 0 8px var(--accent-glow)" : "none",
            }}
          >
            <span>◆ AI AGENT</span>
            <span style={{ fontWeight: 700 }}>{aiAgentEnabled ? "ON" : "PRO"}</span>
          </button>

          <button
            onClick={() => setKeysOpen(true)}
            style={{ ...S.ghostBtn, width: "100%", fontSize: 11, padding: "6px 12px", textAlign: "left", letterSpacing: "0.04em", fontFamily: "var(--font-mono)", marginBottom: 5, color: "var(--text-tertiary)" }}
          >◇ Claude Connector</button>

          <button
            onClick={closeIfDrawer(() => { if (window.confirm("Reset all progress?")) onReset(); })}
            style={{ ...S.ghostBtn, width: "100%", fontSize: 11, padding: "6px 12px", textAlign: "left", letterSpacing: "0.04em", fontFamily: "var(--font-mono)", marginBottom: 5, color: "var(--text-tertiary)" }}
          >Start Over</button>
          <button
            onClick={closeIfDrawer(onSignOut)}
            style={{ ...S.ghostBtn, width: "100%", fontSize: 11, padding: "6px 12px", textAlign: "left", letterSpacing: "0.04em", fontFamily: "var(--font-mono)" }}
          >Sign out</button>
        </div>
      </aside>

      {keysOpen && <ApiKeysModal onClose={() => setKeysOpen(false)} />}
    </>
  );
}
