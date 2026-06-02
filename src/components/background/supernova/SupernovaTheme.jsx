import { THEME_CONFIG } from "../../../theme.config.js";
import SupernovaCorona from "./SupernovaCorona.jsx";
import SupernovaShaft from "./SupernovaShaft.jsx";
import SupernovaVignette from "./SupernovaVignette.jsx";
import SupernovaMotes from "./SupernovaMotes.jsx";

/**
 * S-tier (Supernova) theme. Hard branch from ReactiveBackground — none of
 * the standard layers render. The void is the point: black field, one
 * crimson corona overhead, a faint gold shaft, a permanent gold edge
 * vignette ("sovereignty, not a state warning"), and a few gold motes.
 *
 * The visual treatment is the original throne aesthetic; only the file
 * names changed (was "Monarch*"). Per the spec: rename in place, do not
 * rebuild the visual.
 */
export default function SupernovaTheme({ reduceMotion = false }) {
  const cfg = THEME_CONFIG.supernova;
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0, pointerEvents: "none",
          zIndex: 0,
          background: cfg.base,
        }}
      />
      <SupernovaCorona reduceMotion={reduceMotion} />
      <SupernovaShaft  reduceMotion={reduceMotion} />
      <SupernovaMotes  reduceMotion={reduceMotion} />
      <SupernovaVignette />
    </>
  );
}
