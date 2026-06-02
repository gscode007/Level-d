import { THEME_CONFIG } from "../../theme.config.js";

/**
 * Layer 2 — Tier aura. Radial-gradient glow at top-center, keyed by the
 * user's current celestial tier (Ember…Nova). Color + opacity + radius live
 * in theme.config.rankAura. Cross-fades on tier change via CSS transition;
 * breathes via `@keyframes bg-aura-breathe` (defined in background.css) on
 * opacity only — no scale pump.
 *
 * Reduced-motion path: drop the breathe animation, hold at base opacity.
 * Color and radius still apply (meaning, not motion).
 */
export default function TierAura({ rank = "E", reduceMotion = false }) {
  const cfg = THEME_CONFIG.rankAura;
  const r = cfg[rank] || cfg.E;
  const minOp = Math.max(0, r.opacity - r.breatheAmplitude);
  const maxOp = Math.min(1, r.opacity + r.breatheAmplitude);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        zIndex: 2,
        background: `radial-gradient(ellipse ${r.radiusPct}% ${r.radiusPct * 0.7}% at 50% -10%, ${r.color} 0%, transparent 70%)`,
        opacity: reduceMotion ? r.opacity : undefined,
        animation: reduceMotion ? "none" : `bg-aura-breathe ${cfg.breatheMs}ms ease-in-out infinite`,
        transition: `background ${cfg.crossfadeMs}ms ease-in-out, opacity ${cfg.crossfadeMs}ms ease-in-out`,
        "--aura-min-opacity": minOp,
        "--aura-max-opacity": maxOp,
      }}
    />
  );
}
