import { THEME_CONFIG } from "../../../theme.config.js";

/**
 * Supernova corona — one wide soft radial above center: crimson core
 * fading through a faint gold rim to transparent. Slow opacity+scale
 * breathe via keyframe `bg-supernova-corona` (background.css).
 * Reduced-motion holds it at a static value.
 */
export default function SupernovaCorona({ reduceMotion = false }) {
  const cfg = THEME_CONFIG.supernova;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: "50%", top: "-15%",
        width: `${cfg.coronaRadiusPct * 1.6}%`,
        height: `${cfg.coronaRadiusPct * 1.2}%`,
        transformOrigin: "center",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 1,
        background: `radial-gradient(ellipse at center, ${cfg.coronaCrimson} 0%, ${cfg.coronaGold} 55%, transparent 80%)`,
        filter: "blur(2px)",
        animation: reduceMotion ? "none" : `bg-supernova-corona ${cfg.breatheMs}ms ease-in-out infinite`,
        opacity: reduceMotion ? 1 : undefined,
      }}
    />
  );
}
