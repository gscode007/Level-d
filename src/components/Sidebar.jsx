import styles from "../styles.module.css";
import { NAV_ICONS, BrandMark } from "./icons/NavIcons";
import { THEME_CONFIG } from "../theme.config.js";

const NAV_ITEMS = [
  ["dashboard", "Dashboard"],
  ["goals",     "Goals"    ],
  ["reports",   "Reports"  ],
  ["history",   "History"  ],
  ["settings",  "Settings" ],
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
      {/* Brand mark */}
      <div style={{
        padding: "16px 0 12px",
        color: "var(--accent)",
      }}>
        <BrandMark size={22} glow color="var(--accent)" />
      </div>

      <div style={{ height: 1, background: "var(--border)", width: "80%", marginBottom: 8 }} />

      {/* Nav icons */}
      <nav style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        {NAV_ITEMS.map(([id, label]) => {
          const Icon = NAV_ICONS[id];
          return (
            <button
              key={id}
              title={label}
              onClick={() => setView(id)}
              style={{
                width: 34, height: 34, borderRadius: 6,
                background: view === id ? "var(--accent-dim)" : "transparent",
                border: `1px solid ${view === id ? "var(--accent)" : "transparent"}`,
                color: view === id ? "var(--accent)" : "var(--text-tertiary)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
                boxShadow: view === id ? "inset 0 0 10px rgba(59,130,246,0.1)" : "none",
              }}
            >
              {Icon && <Icon size={THEME_CONFIG.navIcons.sidebarCollapsedPx} />}
            </button>
          );
        })}
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
export default function Sidebar({ view, setView, levelNum, overallRank, user, onSignOut, isDrawer, onClose, collapsed, onToggle }) {
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, color: "var(--accent)" }}>
                <BrandMark size={20} glow color="var(--accent)" />
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
            {NAV_ITEMS.map(([id, label]) => {
              const Icon = NAV_ICONS[id];
              return (
                <button
                  key={id}
                  onClick={closeIfDrawer(() => setView(id))}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", textAlign: "left",
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
                >
                  {Icon && <Icon size={THEME_CONFIG.navIcons.sidebarPx} />}
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User footer — the profile chip is the SETTINGS entry point
            (Phase 7). A direct sign-out affordance sits beside it so
            users are never stranded if SettingsView fails to render. */}
        <div style={{
          display: "flex", alignItems: "stretch",
          borderTop: "1px solid var(--border)",
        }}>
          <button
            onClick={closeIfDrawer(() => setView("settings"))}
            title="Open settings"
            style={{
              flex: 1, minWidth: 0,
              display: "flex", alignItems: "center", gap: 9,
              padding: "12px 12px 16px",
              background: view === "settings" ? "var(--accent-dim)" : "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.15s",
            }}
          >
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
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.displayName || "User"}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>
                {user.email}
              </div>
            </div>
          </button>
          {onSignOut && (
            <button
              onClick={closeIfDrawer(onSignOut)}
              title="Sign out"
              style={{
                flexShrink: 0,
                padding: "0 14px",
                background: "transparent",
                border: "none",
                borderLeft: "1px solid var(--border)",
                color: "var(--text-tertiary)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "rgba(239,68,68,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "transparent"; }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 11L13 8L10 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 14H3.5C2.67157 14 2 13.3284 2 12.5V3.5C2 2.67157 2.67157 2 3.5 2H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
