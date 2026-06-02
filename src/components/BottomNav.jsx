import { NAV_ICONS } from "./icons/NavIcons";
import { THEME_CONFIG } from "../theme.config.js";

const NAV = [
  { id: "dashboard", label: "Today"    },
  { id: "goals",     label: "Goals"    },
  { id: "history",   label: "History"  },
  { id: "settings",  label: "Settings" },
];

export default function BottomNav({ view, setView }) {
  const iconSize = THEME_CONFIG.navIcons.bottomNavPx;
  return (
    <nav style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      height: 58,
      background: "rgba(8,14,26,0.96)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderTop: "1px solid var(--border)",
      display: "flex",
      zIndex: 200,
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {NAV.map(({ id, label }) => {
        const active = view === id;
        const Icon = NAV_ICONS[id];
        return (
          <button
            key={id}
            onClick={() => setView(id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              border: "none",
              background: "none",
              cursor: "pointer",
              padding: "6px 0",
              borderTop: `2px solid ${active ? "var(--accent)" : "transparent"}`,
              transition: "border-color 0.15s, color 0.15s",
              color: active ? "var(--accent)" : "var(--text-tertiary)",
            }}
          >
            {Icon && <Icon size={iconSize} />}
            <span style={{
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
