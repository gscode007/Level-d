import { useEffect, useRef, useState, useCallback } from "react";
import { THEME_CONFIG, litStarIndices } from "../../theme.config.js";
import { useSharedCanvasLoop } from "./hooks/useSharedCanvasLoop.js";

/**
 * Layer 3 — Constellation. Canvas with deterministic star positions.
 *
 * Performance contract:
 *   - The canvas is repainted ONCE per scene change (count change, resize),
 *     not every frame.
 *   - During an active flare burst the component subscribes to the shared
 *     rAF for the burst duration (~1.2s); once it settles, we drop out of
 *     the loop.
 *
 * Reduced-motion path: no flare burst — the canvas is just the static
 * lit/dim scene, repainted once per count change.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateStars(seed, count, cfg, w, h) {
  const rnd = mulberry32(seed);
  const skyH = h * cfg.skyYMaxPct;
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const y = rnd() * skyH;
    const r = cfg.starRadiusPx.min + rnd() * (cfg.starRadiusPx.max - cfg.starRadiusPx.min);
    out[i] = { x, y, r };
  }
  return out;
}

function paintScene(ctx, stars, litCount, cfg, w, h, dpr, flares) {
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = cfg.dormantColor;
  ctx.globalAlpha = cfg.dormantOpacity;
  for (let i = litCount; i < stars.length; i++) {
    const s = stars[i];
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = cfg.litColor;
  for (let i = 0; i < litCount; i++) {
    const s = stars[i];
    const flare = flares.get(i);
    const baseAlpha = 0.9;
    const alpha = flare ? Math.max(baseAlpha, flare.opacity) : baseAlpha;
    const scale = flare ? flare.scale : 1;
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * scale, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export default function Constellation({ completedAchievements = 0, reduceMotion = false }) {
  const cfg = THEME_CONFIG.constellation;
  const canvasRef = useRef(null);
  const starsRef = useRef([]);
  const dprRef = useRef(1);
  const sizeRef = useRef({ w: 0, h: 0 });
  const flaresRef = useRef(new Map());
  const prevCountRef = useRef(0);
  const [tick, setTick] = useState(0);
  const [flareActive, setFlareActive] = useState(false);

  const litCount = litStarIndices(completedAchievements, cfg.totalStars);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const resize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const dpr = window.devicePixelRatio || 1;
        const w = window.innerWidth;
        const h = window.innerHeight;
        dprRef.current = dpr;
        sizeRef.current = { w, h };
        canvas.width  = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width  = `${w}px`;
        canvas.style.height = `${h}px`;
        starsRef.current = generateStars(cfg.seed, cfg.totalStars, cfg, w, h);
        setTick((t) => t + 1);
      });
    };
    resize();
    let debounce;
    const onResize = () => { clearTimeout(debounce); debounce = setTimeout(resize, 150); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(raf); clearTimeout(debounce); };
  }, [cfg]);

  useEffect(() => {
    const prev = prevCountRef.current;
    if (litCount > prev && !reduceMotion) {
      const now = performance.now();
      for (let i = prev; i < litCount; i++) {
        flaresRef.current.set(i, { startedAt: now, opacity: 0, scale: 0.4 });
      }
      setFlareActive(true);
    }
    prevCountRef.current = litCount;
    setTick((t) => t + 1);
  }, [litCount, reduceMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { w, h } = sizeRef.current;
    if (!w || !h || !starsRef.current.length) return;
    paintScene(ctx, starsRef.current, litCount, cfg, w, h, dprRef.current, flaresRef.current);
  }, [tick, litCount, cfg]);

  const onFrame = useCallback((t) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const flares = flaresRef.current;
    if (flares.size === 0) { setFlareActive(false); return; }
    let stillActive = false;
    for (const [idx, f] of flares) {
      const elapsed = t - f.startedAt;
      const p = Math.min(1, elapsed / cfg.flareDurationMs);
      if (p < 0.2) {
        f.opacity = p / 0.2;
        f.scale = 0.4 + (1.6 - 0.4) * (p / 0.2);
      } else {
        const q = (p - 0.2) / 0.8;
        f.opacity = 1.0 + (0.9 - 1.0) * q;
        f.scale = 1.6 + (1.0 - 1.6) * q;
      }
      if (p >= 1) flares.delete(idx);
      else stillActive = true;
    }
    const ctx = canvas.getContext("2d");
    const { w, h } = sizeRef.current;
    paintScene(ctx, starsRef.current, litCount, cfg, w, h, dprRef.current, flares);
    if (!stillActive) setFlareActive(false);
  }, [cfg, litCount]);

  useSharedCanvasLoop(onFrame, flareActive && !reduceMotion);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 3 }}
    />
  );
}
