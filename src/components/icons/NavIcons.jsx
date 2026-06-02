/**
 * Nav icon set (Phase 8) — thin-line SVGs for navigation/structural use.
 * Matches the line-and-glow aesthetic: 1.5px stroke, rounded caps/joins,
 * currentColor so callers can tint via parent `color`.
 *
 * SACRED — DO NOT REPLACE: the six category glyphs (♡ ◇ △ ✦ ✿ ○) defined
 * in constants.js. Those are identity markers, not nav icons.
 *
 * Sizes come from theme.config.navIcons.* by default; per-instance `size`
 * prop overrides.
 */

import { THEME_CONFIG } from "../../theme.config.js";

const DEFAULT_SIZE = THEME_CONFIG.navIcons.sidebarPx;

function Svg({ size = DEFAULT_SIZE, children, ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "inline-block", flexShrink: 0 }}
      {...rest}
    >
      {children}
    </svg>
  );
}

// Dashboard — 4-square grid (replaces ⊞)
export function DashboardIcon(props) {
  return (
    <Svg {...props}>
      <rect x="3.5"  y="3.5"  width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5"  width="7" height="7" rx="1" />
      <rect x="3.5"  y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </Svg>
  );
}

// Goals — concentric circles with center dot (replaces ◎)
export function GoalsIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

// Reports — ascending bar chart (replaces ▤)
export function ReportsIcon(props) {
  return (
    <Svg {...props}>
      <line x1="4"  y1="20" x2="20" y2="20" />
      <line x1="6"  y1="20" x2="6"  y2="15" />
      <line x1="11" y1="20" x2="11" y2="11" />
      <line x1="16" y1="20" x2="16" y2="7" />
    </Svg>
  );
}

// History — stacked horizontal lines with a forward chevron (replaces ≡)
export function HistoryIcon(props) {
  return (
    <Svg {...props}>
      <line x1="4"  y1="7"  x2="16" y2="7" />
      <line x1="4"  y1="12" x2="16" y2="12" />
      <line x1="4"  y1="17" x2="16" y2="17" />
      <polyline points="18,8 21,12 18,16" />
    </Svg>
  );
}

// Settings — a small ringed dot (matches the ◌ glyph the toggle used to use)
export function SettingsIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.5 4.5l2 2 M17.5 17.5l2 2 M19.5 4.5l-2 2 M6.5 17.5l-2 2" />
    </Svg>
  );
}

// Brand mark — replaces the ◈ logo used at the top of the sidebar.
// A diamond-on-grid suggestion that nods to the rank-mark showpiece.
export function BrandMark({ size = DEFAULT_SIZE, glow = false, color = "currentColor" }) {
  return (
    <Svg size={size} style={{
      display: "inline-block", flexShrink: 0,
      filter: glow ? `drop-shadow(0 0 6px ${color})` : undefined,
    }} stroke={color}>
      <path d="M12 3 L21 12 L12 21 L3 12 Z" />
      <circle cx="12" cy="12" r="2.2" fill={color} stroke="none" />
    </Svg>
  );
}

export const NAV_ICONS = {
  dashboard: DashboardIcon,
  goals:     GoalsIcon,
  reports:   ReportsIcon,
  history:   HistoryIcon,
  settings:  SettingsIcon,
};
