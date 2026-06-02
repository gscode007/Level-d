import { THEME_CONFIG } from "../../../theme.config.js";

/**
 * Supernova vignette — PERMANENT gold edge. At this tier you are always
 * "ready"; the vignette is sovereignty, not a state warning. No pulse, no
 * transition, no JS — pure CSS at fixed opacity.
 */
export default function SupernovaVignette() {
  const cfg = THEME_CONFIG.supernova;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        zIndex: 5,
        background: `radial-gradient(ellipse at center, transparent 55%, ${cfg.vignetteGold} 100%)`,
      }}
    />
  );
}
