import { THEME_CONFIG } from "../../theme.config.js";

/**
 * Layer 6 (optional) — film grain. OFF by default in theme.config.filmGrain
 * because it can be costly on low-end mobile (SVG noise patterns defeat
 * compositor optimization). Static — no animation here.
 */
export default function FilmGrain({ reduceMotion = false }) {
  const cfg = THEME_CONFIG.filmGrain;
  if (!cfg.enabled) return null;
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>
      <filter id='n'>
        <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>
        <feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0'/>
      </filter>
      <rect width='100%' height='100%' filter='url(#n)' opacity='0.6'/>
    </svg>`;
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        zIndex: 6,
        backgroundImage: url,
        backgroundSize: "160px 160px",
        opacity: cfg.opacity,
        mixBlendMode: "overlay",
        animation: reduceMotion ? "none" : undefined,
      }}
    />
  );
}
