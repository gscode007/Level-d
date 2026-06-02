import { THEME_CONFIG } from "../../theme.config.js";

/**
 * Layer 5 — ThresholdVignette. Edge tint carrying the level-gate state.
 *
 *   thresholdOpen=true                      → gold, slow pulse
 *   thresholdOpen=false, level overdue      → red, opacity scales with overdueness
 *   thresholdOpen=false, level on-pace      → ~0 opacity (neutral)
 *
 * Pure CSS — opacity transitions, no JS animation. The slow pulse is a
 * keyframe in background.css; reduced-motion strips it (gold edge stays,
 * just doesn't pulse).
 *
 * (Formerly "BossVignette" — renamed for the celestial vocabulary; the
 * threshold IS the gate, opened or closed.)
 */
export default function ThresholdVignette({
  thresholdOpen = false,
  levelStartedAt = 0,
  targetMs = 0,
  reduceMotion = false,
}) {
  const cfg = THEME_CONFIG.vignette;
  const now = Date.now();
  const elapsed = Math.max(0, now - (levelStartedAt || now));
  const fallbackMs = cfg.fallbackTargetDays * 24 * 60 * 60 * 1000;
  const tgt = targetMs > 0 ? targetMs : fallbackMs;
  const overdue = tgt > 0 ? Math.max(0, Math.min(1, (elapsed - tgt) / tgt)) : 0;

  let color, opacity, animation;
  if (thresholdOpen) {
    color = cfg.readyGold;
    opacity = 1;
    animation = reduceMotion ? "none" : `bg-vignette-pulse ${cfg.pulseMs}ms ease-in-out infinite`;
  } else if (overdue > 0) {
    color = cfg.overdueRedMax;
    opacity = overdue;
    animation = "none";
  } else {
    color = "transparent";
    opacity = 0;
    animation = "none";
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        zIndex: 5,
        background: `radial-gradient(ellipse at center, transparent 55%, ${color} 100%)`,
        opacity,
        transition: "background 1200ms ease, opacity 1200ms ease",
        animation,
      }}
    />
  );
}
