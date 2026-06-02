import { useEffect, useRef, useCallback } from "react";
import { THEME_CONFIG } from "../../../theme.config.js";
import { useSharedCanvasLoop } from "../hooks/useSharedCanvasLoop.js";

/**
 * Supernova motes — sparse (≤ 6) slow-rising gold particles, replacing the
 * warm ember field at this tier. Extravagant scarcity: a few, not many.
 *
 * Shares the rAF with the standard Embers via useSharedCanvasLoop. Since
 * only one of the two ever mounts (Supernova xor Standard), the loop has
 * at most one ember-class subscriber at a time.
 */
export default function SupernovaMotes({ reduceMotion = false }) {
  const cfg = THEME_CONFIG.supernova;
  const canvasRef = useRef(null);
  const dprRef = useRef(1);
  const sizeRef = useRef({ w: 0, h: 0 });
  const motesRef = useRef([]);

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
      });
    };
    resize();
    let debounce;
    const onResize = () => { clearTimeout(debounce); debounce = setTimeout(resize, 150); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(raf); clearTimeout(debounce); };
  }, []);

  useEffect(() => {
    const pool = [];
    const now = performance.now();
    for (let i = 0; i < cfg.moteCount; i++) {
      const life = cfg.moteLifetimeMs.min + Math.random() * (cfg.moteLifetimeMs.max - cfg.moteLifetimeMs.min);
      pool.push({
        x0: Math.random(),
        startedAt: now - Math.random() * life,
        life,
        r: 1.4 + Math.random() * 1.4,
      });
    }
    motesRef.current = pool;
  }, [cfg.moteCount, cfg.moteLifetimeMs]);

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
    const grad = ctx.createLinearGradient(0, h, 0, h - 160);
    grad.addColorStop(0, "rgba(232,197,106,0.08)");
    grad.addColorStop(1, "rgba(232,197,106,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, h - 160, w, 160);
    ctx.restore();
  }, [reduceMotion]);

  const onFrame = useCallback((t) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    ctx.save();
    ctx.scale(dprRef.current, dprRef.current);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = cfg.moteColor;
    for (const m of motesRef.current) {
      let age = t - m.startedAt;
      if (age >= m.life) {
        m.x0 = Math.random();
        m.startedAt = t;
        m.life = cfg.moteLifetimeMs.min + Math.random() * (cfg.moteLifetimeMs.max - cfg.moteLifetimeMs.min);
        age = 0;
      }
      const u = age / m.life;
      const x = m.x0 * w + Math.sin((age / 1000) * 0.6) * 8;
      const y = h - 30 - cfg.moteRisePx * u;
      const alpha = u < 0.2 ? u / 0.2 : (1 - u) / 0.8;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.85;
      ctx.beginPath(); ctx.arc(x, y, m.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }, [cfg]);

  useSharedCanvasLoop(onFrame, !reduceMotion);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 4 }}
    />
  );
}
