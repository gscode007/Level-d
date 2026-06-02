import { useMemo } from "react";
import { LABELS } from "../theme.config.js";
import { useReducedMotion } from "./background/hooks/useReducedMotion.js";

/**
 * Phase 9 — fresh-arc hero. The first thing a new user sees on their
 * brand-new Level 1 dashboard: a small dim constellation with one lit
 * star, and a single serif line ("Your first step lights the sky.").
 *
 * Renders ONLY when:
 *   - arc is active (state.arc.status === "active")
 *   - no habits defined yet (level.goals has no habitual)
 *   - no completions on any goal yet
 *
 * Reduced-motion: the lit star's glow pulse is suppressed; the dim field
 * and the lit star itself remain. No animation that conveys nothing
 * meaningful runs under reduced-motion.
 */

// Deliberate 6-star asterism — hand-placed inside the 240×120 viewport so the
// connecting lines form a recognizable open shape (a stylized comet trail
// arcing upward). The lit star sits at the brightest node so it reads as the
// leading point, not an orphan dot.
const DIM_STARS = [
  { x: 56,  y: 88, r: 1.4 },   // tail-end, lower-left
  { x: 84,  y: 70, r: 1.2 },   // mid-tail
  { x: 152, y: 36, r: 1.5 },   // upper-right companion
  { x: 184, y: 22, r: 1.3 },   // top tip
  { x: 96,  y: 26, r: 1.1 },   // upper-left
  { x: 200, y: 70, r: 1.0 },   // far-right anchor
];
const LIT_STAR = { x: 120, y: 50, r: 2.6 };
// Lines describing the constellation — each connects two named points so the
// shape is intentional rather than a random asterisk burst.
const LINES = [
  [DIM_STARS[0], DIM_STARS[1]],   // tail-end → mid-tail
  [DIM_STARS[1], LIT_STAR],        // mid-tail → lit (the leading edge)
  [LIT_STAR, DIM_STARS[2]],        // lit → upper-right companion
  [DIM_STARS[2], DIM_STARS[3]],   // companion → top tip
  [LIT_STAR, DIM_STARS[4]],        // lit → upper-left (opens the shape)
];

export default function FreshArcHero({ arcGoal, onAddHabit, reduceMotionPref }) {
  const reduceMotion = useReducedMotion(reduceMotionPref);
  const pulseStyle = useMemo(() => reduceMotion ? {} : {
    animation: "glowPulse 3.5s ease-in-out infinite",
  }, [reduceMotion]);

  // Arc goal can arrive as null/undefined (no arc), an empty/whitespace string
  // (cleared by the user), or — historically — a stale base36 id-shaped
  // fragment from a buggy seed path. The "walking toward …" clause is purely
  // contextual flavor: if we don't have a real goal to name, skip it cleanly
  // rather than render mangled text.
  const cleanGoal = typeof arcGoal === "string" ? arcGoal.trim() : "";

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      padding: "28px 24px 26px",
      marginBottom: 12,
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Constellation — a deliberate 6-star asterism. Lines drawn under the
          stars so dim circles overlap the line ends cleanly. */}
      <svg
        viewBox="0 0 240 120"
        width="240"
        height="120"
        aria-hidden="true"
        style={{
          display: "block",
          margin: "0 auto 22px",
          maxWidth: "100%",
        }}
      >
        <g stroke="#CBD5E1" strokeOpacity="0.22" strokeWidth="0.6" strokeLinecap="round">
          {LINES.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          ))}
        </g>
        {DIM_STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#CBD5E1" opacity="0.55" />
        ))}
        {/* Outer halo behind the lit star — soft warm glow */}
        <circle
          cx={LIT_STAR.x} cy={LIT_STAR.y}
          r={LIT_STAR.r * 4.8}
          fill="#E2E8F0"
          opacity="0.10"
          style={pulseStyle}
        />
        {/* Inner halo — tighter glow */}
        <circle
          cx={LIT_STAR.x} cy={LIT_STAR.y}
          r={LIT_STAR.r * 2.2}
          fill="#F1F5F9"
          opacity="0.18"
          style={pulseStyle}
        />
        {/* The lit star itself */}
        <circle
          cx={LIT_STAR.x} cy={LIT_STAR.y}
          r={LIT_STAR.r}
          fill="#F8FAFC"
          opacity="1"
          style={pulseStyle}
        />
      </svg>

      {/* Serif hero copy */}
      <p style={{
        fontSize: 24, fontWeight: 300, fontStyle: "italic",
        fontFamily: "'Instrument Serif', Georgia, serif",
        color: "var(--text-primary)",
        letterSpacing: "-0.01em", lineHeight: 1.25,
        maxWidth: 420, margin: "0 auto 8px",
      }}>
        {LABELS.emptyState.constellationHero}
      </p>

      {/* Quiet body line — names the arc, sets the stakes. Skip entirely when
          no real goal exists; never render the clause without something
          meaningful to name. */}
      {cleanGoal && (
        <p style={{
          fontSize: 13, color: "var(--text-tertiary)",
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontStyle: "italic",
          lineHeight: 1.5,
          maxWidth: 420, margin: "0 auto 22px",
        }}>
          You're walking toward <span style={{ color: "var(--text-secondary)" }}>{cleanGoal}</span>.
        </p>
      )}

      {onAddHabit && (
        <button
          onClick={onAddHabit}
          style={{
            background: "transparent",
            color: "var(--accent)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            padding: "9px 18px",
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.06em",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-dim)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          + Define your first habit
        </button>
      )}
    </div>
  );
}
