import { THEME_CONFIG } from "../../../theme.config.js";

/**
 * Supernova light shaft — a single faint vertical gold-white gradient
 * descending from top-center, blurred, very low opacity. Pulses on a
 * different beat than the corona so they never lock into a single rhythm.
 */
export default function SupernovaShaft({ reduceMotion = false }) {
  const cfg = THEME_CONFIG.supernova;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: `${50 - cfg.shaftWidthPct / 2}%`,
        top: 0,
        width: `${cfg.shaftWidthPct}%`,
        height: "100%",
        pointerEvents: "none",
        zIndex: 2,
        background: `linear-gradient(to bottom, ${cfg.shaftColor} 0%, transparent 60%)`,
        filter: "blur(28px)",
        animation: reduceMotion ? "none" : `bg-supernova-shaft ${cfg.shaftMs}ms ease-in-out infinite`,
        opacity: reduceMotion ? 0.8 : undefined,
      }}
    />
  );
}
