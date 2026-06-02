import { useMemo } from "react";
import { resolveTimeOfDayTint, THEME_CONFIG } from "../../theme.config.js";
import { useNow15min } from "./hooks/useNow15min.js";

/**
 * Layer 0 — Base fill whose hue tracks LOCAL time. Pure CSS, no animation;
 * recomputed at most every 15 min via useNow15min. Low-saturation,
 * near-black tones — atmosphere, not paint.
 */
export default function TimeOfDayTint() {
  const now = useNow15min(THEME_CONFIG.timeOfDay_recomputeMs);
  const tint = useMemo(() => {
    const hour = now.getHours() + now.getMinutes() / 60;
    return resolveTimeOfDayTint(hour);
  }, [now]);
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        zIndex: 0,
        background: tint,
        transition: "background 1500ms linear",
      }}
    />
  );
}
