import { useEffect, useRef, useCallback } from "react";
import { THEME_CONFIG, embersForStreak } from "../../theme.config.js";
import { useSharedCanvasLoop } from "./hooks/useSharedCanvasLoop.js";

/**
 * Layer 4 — Embers. Warm motes rising from the bottom edge with horizontal
 * wobble, fading as they go. Particle cap scales with the user's longest
 * active streak via theme.config.embers.streakBuckets.
 *
 * Performance contract:
 *   - Single canvas, capped particle count (hard ceiling 24).
 *   - Shared rAF — joins the loop only when ≥ 1 particle to render.
 *   - Particles are recycled in place; no Array.push / shift churn.
 *
 * Reduced-motion path: paint a single soft static glow at the bottom edge
 * proportional to the would-be particle count, then skip the rAF entirely.
 *
 * (Formerly "StreakEmbers"; the "streak" linkage stays in code via
 * embersForStreak — only the component name dropped the prefix.)
 */

function makeParticle(p, w, cfg, now) {
  const life = cfg.lifetimeMs.min + Math.random() * (cfg.lifetimeMs.max - cfg.lifetimeMs.min);
  p.x0 = Math.random() * w;
  p.y0 = 0;
  p.startedAt = now - Math.random() * life;
  p.life = life;
  p.color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
  p.r = 1.2 + Math.random() * 1.4;
  p.wobblePhase = Math.random() * Math.PI * 2;
  // Halved from 0.6 + 0.5 → 0.3 + 0.25 so the wobble matches the slower rise
  // set in theme.config.embers.lifetimeMs. Keeps oscillation count per life
  // roughly constant rather than doubling it.
  p.wobbleHz = 0.3 + Math.random() * 0.25;
  return p;
}

export default function Embers({ longestStreak = 0, reduceMotion = false }) {
  const cfg = THEME_CONFIG.embers;
  const canvasRef = useRef(null);
  const dprRef = useRef(1);
  const sizeRef = useRef({ w: 0, h: 0 });
  const particlesRef = useRef([]);

  const targetCount = embersForStreak(longestStreak, cfg);

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
        for (const p of particlesRef.current) p.x0 = Math.random() * w;
      });
    };
    resize();
    let debounce;
    const onResize = () => { clearTimeout(debounce); debounce = setTimeout(resize, 150); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(raf); clearTimeout(debounce); };
  }, []);

  useEffect(() => {
    const pool = particlesRef.current;
    const now = performance.now();
    const { w } = sizeRef.current;
    while (pool.length < targetCount) pool.push(makeParticle({}, w || 320, cfg, now));
    while (pool.length > targetCount) pool.pop();
  }, [targetCount, cfg]);

  useEffect(() => {
    if (!reduceMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    ctx.save();
    ctx.scale(dprRef.current, dprRef.current);
    ctx.clearRect(0, 0, w, h);
    if (targetCount > 0) {
      const intensity = Math.min(1, targetCount / cfg.maxParticles);
      const grad = ctx.createLinearGradient(0, h, 0, h - 140);
      grad.addColorStop(0, `rgba(251,191,36,${0.10 * intensity})`);
      grad.addColorStop(1, "rgba(251,191,36,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, h - 140, w, 140);
    }
    ctx.restore();
  }, [reduceMotion, targetCount, cfg]);

  const onFrame = useCallback((t) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pool = particlesRef.current;
    if (pool.length === 0) return;
    const ctx = canvas.getContext("2d");
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    ctx.save();
    ctx.scale(dprRef.current, dprRef.current);
    ctx.clearRect(0, 0, w, h);
    const rise = cfg.riseDistancePx;
    const wobble = cfg.horizontalWobblePx;
    for (const p of pool) {
      let age = t - p.startedAt;
      if (age >= p.life) {
        const life = cfg.lifetimeMs.min + Math.random() * (cfg.lifetimeMs.max - cfg.lifetimeMs.min);
        p.x0 = Math.random() * w;
        p.startedAt = t;
        p.life = life;
        p.wobblePhase = Math.random() * Math.PI * 2;
        age = 0;
      }
      const u = age / p.life;
      const y = h - 24 - rise * u;
      const wob = Math.sin(p.wobblePhase + (age / 1000) * Math.PI * 2 * p.wobbleHz) * wobble;
      const x = p.x0 + wob;
      const alpha = u < 0.15 ? u / 0.15 : (1 - u) / 0.85;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.85;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }, [cfg]);

  useSharedCanvasLoop(onFrame, !reduceMotion && targetCount > 0);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 4 }}
    />
  );
}
