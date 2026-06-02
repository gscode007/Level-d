/**
 * Layer 1 — Static vertical gradient, lighter top → true black bottom.
 * Sits above the time-of-day tint and below everything else. Pure CSS,
 * no state, no animation. (Formerly "DungeonDepth"; the name was rolled
 * into the celestial vocabulary — depth without the dungeon.)
 */
export default function Depth() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        zIndex: 1,
        background: "linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.0) 35%, rgba(0,0,0,0.55) 100%)",
      }}
    />
  );
}
