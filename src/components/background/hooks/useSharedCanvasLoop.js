import { useEffect } from "react";

/**
 * ONE requestAnimationFrame loop, shared by every canvas layer in the
 * background tree (Constellation flare bursts, Embers, Supernova motes).
 *
 * Why share:
 *   - Browsers schedule each rAF independently; multiple uncoordinated loops
 *     can defeat the compositor's batching and burn battery.
 *   - We need exactly one place that listens for `visibilitychange` and
 *     stops scheduling frames while the tab is hidden.
 *
 * Contract:
 *   - Callbacks receive (timestampMs, deltaMs). dt is clamped to 100ms so a
 *     long background pause doesn't cause a giant time jump on the first
 *     resumed frame.
 *   - Pass `enabled = false` to suspend without unmounting (reduced-motion).
 *   - Pass a STABLE callback reference (useCallback / ref). A new identity
 *     every render would churn the subscriber Set.
 */

const subscribers = new Set();
let rafId = null;
let lastFrame = 0;

function tick(t) {
  rafId = null;
  if (typeof document !== "undefined" && document.hidden) return; // resumed via visibilitychange
  const dt = lastFrame ? Math.min(100, t - lastFrame) : 16;
  lastFrame = t;
  for (const fn of subscribers) {
    try { fn(t, dt); }
    catch (e) {
      // A subscriber throwing must NOT kill the loop — drop it and continue.
      console.error("[bg-loop] subscriber threw, removing:", e);
      subscribers.delete(fn);
    }
  }
  if (subscribers.size > 0) rafId = requestAnimationFrame(tick);
}

function start() {
  if (typeof window === "undefined") return;
  if (rafId == null && !document.hidden && subscribers.size > 0) {
    lastFrame = 0;
    rafId = requestAnimationFrame(tick);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else {
      start();
    }
  });
}

export function useSharedCanvasLoop(callback, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof callback !== "function") return;
    subscribers.add(callback);
    start();
    return () => { subscribers.delete(callback); };
  }, [callback, enabled]);
}

export function __resetSharedCanvasLoop() {
  subscribers.clear();
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  lastFrame = 0;
}
