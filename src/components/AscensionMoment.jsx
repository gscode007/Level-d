import { useEffect, useState } from "react";
import { RANK_COLOR } from "../constants";
import { THEME_CONFIG, TIER_BY_RANK } from "../theme.config.js";
import { useReducedMotion } from "./background/hooks/useReducedMotion.js";

/**
 * Phase 11 — Ascension moment. Fires once per tier-up. Brief (~3s),
 * skippable, editorial — NOT a holographic system burst.
 *
 *   - Standard (Spark…Nova): aura blooms, the new celestial name resolves
 *     typographically in serif, one line of editorial copy lands.
 *   - Supernova (S): same skeleton, but crimson + gold treatment, larger
 *     copy block, slightly different timing.
 *   - Reduced-motion: bloom + resolve animations are stripped; the
 *     typographic moment still lands as a static overlay.
 *
 * Props:
 *   newTier — the celestial tier just reached (string, "Spark"…"Supernova")
 *   onDone  — fired when the moment finishes naturally OR is skipped
 *   reduceMotionPref — user override, undefined = follow OS pref
 */
export default function AscensionMoment({ newTier, onDone, reduceMotionPref }) {
  const reduceMotion = useReducedMotion(reduceMotionPref);
  const cfg = THEME_CONFIG.ascension;
  const isSupernova = newTier === "Supernova";

  // The new tier's color comes from the underlying rank letter. Reverse-map
  // the celestial name through TIER_BY_RANK.
  const matchedRank =
    Object.entries(TIER_BY_RANK).find(([, t]) => t.name === newTier)?.[0] || "E";
  const tierColor = RANK_COLOR[matchedRank] || "var(--accent)";

  const copy = cfg.perTierCopy?.[newTier] || "";

  // Auto-dismiss after durationMs, skippable on click. The mount triggers a
  // brief enter animation; under reduced motion the enter is instant.
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setClosing(true), cfg.durationMs);
    return () => clearTimeout(id);
  }, [cfg.durationMs]);
  useEffect(() => {
    if (!closing) return;
    const id = setTimeout(() => onDone?.(), 350); // matches CSS exit
    return () => clearTimeout(id);
  }, [closing, onDone]);

  function skip() { setClosing(true); }

  // Treatment switches at Supernova. Crimson + gold + serif copy block.
  const bgGradient = isSupernova
    ? `radial-gradient(ellipse at 50% 30%, rgba(220,38,38,0.32) 0%, rgba(232,197,106,0.10) 40%, rgba(4,4,5,0.92) 75%, rgba(4,4,5,0.97) 100%)`
    : `radial-gradient(ellipse at 50% 30%, ${tierColor}22 0%, ${tierColor}10 35%, rgba(8,14,26,0.92) 70%, rgba(8,14,26,0.97) 100%)`;

  const nameColor = isSupernova ? "#E8C56A" : tierColor;
  const fontFamily = isSupernova ? THEME_CONFIG.supernova.serifFontStack : "'Instrument Serif', Georgia, serif";

  return (
    <div
      onClick={skip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") skip(); }}
      aria-label="Tier-up moment, press anywhere to dismiss"
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: bgGradient,
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "0 24px",
        cursor: "pointer",
        opacity: closing ? 0 : 1,
        transition: "opacity 350ms ease",
        animation: reduceMotion ? "none" : "fadeIn 0.45s ease",
      }}
    >
      {/* The pre-name eyebrow — small mono, fades in first */}
      <div style={{
        fontSize: 10, fontFamily: "var(--font-mono)",
        color: "var(--text-tertiary)", letterSpacing: "0.28em",
        marginBottom: 18,
        textTransform: "uppercase",
        animation: reduceMotion ? "none" : "fadeUp 0.8s 0.1s ease both",
      }}>
        {isSupernova ? "You have arrived" : "Tier up"}
      </div>

      {/* The celestial name — the moment's typographic peak */}
      <div style={{
        fontSize: isSupernova ? "clamp(56px, 14vw, 120px)" : "clamp(44px, 10vw, 88px)",
        fontWeight: 300,
        fontStyle: "italic",
        fontFamily,
        color: nameColor,
        lineHeight: 1, letterSpacing: "-0.02em",
        textAlign: "center",
        textShadow: reduceMotion ? "none" : `0 0 36px ${nameColor}80, 0 0 80px ${nameColor}40`,
        animation: reduceMotion ? "none" : "fadeUp 1s 0.35s ease both",
      }}>
        {newTier}
      </div>

      {/* One line of editorial copy */}
      {copy && (
        <p style={{
          marginTop: isSupernova ? 28 : 22,
          maxWidth: 520,
          fontSize: isSupernova ? "clamp(16px, 2.4vw, 20px)" : "clamp(14px, 2vw, 17px)",
          fontStyle: "italic",
          fontFamily: "'Instrument Serif', Georgia, serif",
          color: "var(--text-secondary)",
          lineHeight: 1.4, textAlign: "center",
          letterSpacing: "-0.005em",
          animation: reduceMotion ? "none" : "fadeUp 1s 0.85s ease both",
        }}>
          {copy}
        </p>
      )}

      {/* Skip hint */}
      <div style={{
        position: "fixed", bottom: 26, left: 0, right: 0,
        textAlign: "center",
        fontSize: 9, fontFamily: "var(--font-mono)",
        color: "var(--text-tertiary)", letterSpacing: "0.14em",
        textTransform: "uppercase",
        opacity: 0.7,
      }}>
        Press anywhere to continue
      </div>
    </div>
  );
}

