import { useEffect, useState } from "react";

/**
 * Resolves whether the reactive background should run in reduced-motion mode.
 *
 * Resolution order:
 *   - `userPref === true`  → reduce
 *   - `userPref === false` → motion (explicit override of OS pref)
 *   - `userPref === undefined / null` → follow OS `prefers-reduced-motion`
 *
 * Meaning layers (tier-aura color, threshold-vignette state, supernova
 * corona color, gold edge) still apply when reduced. Only motion is
 * suppressed by each layer.
 */
export function useReducedMotion(userPref) {
  const [osPrefers, setOsPrefers] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setOsPrefers(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  if (userPref === true)  return true;
  if (userPref === false) return false;
  return osPrefers;
}
