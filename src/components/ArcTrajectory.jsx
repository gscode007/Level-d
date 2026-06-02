import { RANK_COLOR } from "../constants";
import { getTier } from "../theme.config.js";

/**
 * Phase 12 — Arc as a trajectory. A sky-arc that visualizes the user's
 * journey across the current arc: past levels as waypoints behind, the
 * goal ahead, current position marked.
 *
 *   ╭────────────────╮
 *   │   •  •  ●  ·  ·   ◇        │
 *   │  past  here  goal           │
 *   ╰────────────────╯
 *
 * Data:
 *   arc          — { goal, status, startDate }
 *   currentLevel — { sequenceInArc, displayName, rank? }
 *   tierRank     — string E…S; used to color the "here" marker
 *
 * Visuals are minimal and additive: a quadratic arc path with evenly
 * distributed waypoints. No animation by default (a quiet long-loop
 * surface, not a dance).
 */
export default function ArcTrajectory({ arc, currentLevel, tierRank }) {
  if (!arc || arc.status !== "active" || !currentLevel) return null;

  const tier = getTier(tierRank || currentLevel.rank || "E");
  const currentColor = RANK_COLOR[tier.rank] || "var(--accent)";

  // Position math. Show at most MAX waypoints — past levels collapse into
  // a "…" ellipsis if there are more than that. Each level after the first
  // is a waypoint; current position is the brightest.
  const MAX_WAYPOINTS = 12;
  const seq = Math.max(1, currentLevel.sequenceInArc || 1);
  const compressing = seq > MAX_WAYPOINTS;
  const shownCount = compressing ? MAX_WAYPOINTS : seq;

  // Arc path geometry — viewBox 320x100, quadratic curve from (20,80) to
  // (300,80) with control point (160,10).
  const path = "M 20 80 Q 160 10 300 80";
  // Resolve a point on the quadratic bezier at parameter t (0..1).
  const pointAt = (t) => {
    const x = (1 - t) * (1 - t) * 20 + 2 * (1 - t) * t * 160 + t * t * 300;
    const y = (1 - t) * (1 - t) * 80 + 2 * (1 - t) * t * 10  + t * t * 80;
    return [x, y];
  };

  // Distribute waypoints. The current level is at the (shownCount-1)/MAX_WAYPOINTS
  // position when compressing, or shownCount-1 / (MAX_WAYPOINTS) otherwise.
  // The arc's TERMINUS (the goal) sits at t = 1.0 and is always shown as a
  // soft serif label / glyph.
  // We reserve t = 0..0.85 for waypoints; t = 1.0 for the goal terminus.
  const waypointSpan = 0.85;
  const positions = [];
  for (let i = 0; i < shownCount; i++) {
    const t = shownCount === 1 ? 0 : (i / (shownCount - 1)) * waypointSpan;
    positions.push(t);
  }
  // The last entry IS the current position.
  const currentT = positions[positions.length - 1] ?? 0;
  const [curX, curY] = pointAt(currentT);
  const [goalX, goalY] = pointAt(1.0);

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      padding: "20px 22px 18px",
      marginBottom: 10,
    }}>
      <div style={{
        fontSize: 9, fontFamily: "var(--font-mono)",
        color: "var(--text-tertiary)", letterSpacing: "0.14em",
        textTransform: "uppercase", marginBottom: 8,
      }}>
        Arc Trajectory
      </div>

      <svg
        viewBox="0 0 320 110"
        width="100%"
        height="auto"
        aria-hidden="true"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* The arc path — faint dotted line */}
        <path
          d={path}
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="1"
          strokeDasharray="2 4"
          opacity="0.5"
        />

        {/* Past waypoints — small dim dots */}
        {positions.slice(0, -1).map((t, i) => {
          const [x, y] = pointAt(t);
          return (
            <circle
              key={`past-${i}`}
              cx={x.toFixed(1)} cy={y.toFixed(1)}
              r={1.6}
              fill="#94A3B8"
              opacity="0.55"
            />
          );
        })}

        {/* Ellipsis when there are more past levels than we can show */}
        {compressing && (
          <text
            x={pointAt(0.04)[0]}
            y={pointAt(0.04)[1] + 4}
            fontSize="10"
            fontFamily="var(--font-mono)"
            fill="var(--text-tertiary)"
            opacity="0.6"
          >·····</text>
        )}

        {/* Current position — bright tier-colored marker + halo */}
        <circle
          cx={curX.toFixed(1)} cy={curY.toFixed(1)}
          r={6}
          fill={currentColor}
          opacity="0.18"
        />
        <circle
          cx={curX.toFixed(1)} cy={curY.toFixed(1)}
          r={3.2}
          fill={currentColor}
          style={{ filter: `drop-shadow(0 0 6px ${currentColor})` }}
        />
        {/* Current label — "Level N · Tier" in serif */}
        <text
          x={curX.toFixed(1)}
          y={(curY - 12).toFixed(1)}
          textAnchor="middle"
          fontSize="11"
          fontFamily="'Instrument Serif', Georgia, serif"
          fontStyle="italic"
          fill={currentColor}
        >
          {currentLevel.displayName || `Level ${seq}`} · {tier.name}
        </text>

        {/* Goal terminus — a faint diamond glyph + serif label */}
        <g transform={`translate(${goalX.toFixed(1)}, ${goalY.toFixed(1)})`}>
          <path
            d="M 0 -5 L 5 0 L 0 5 L -5 0 Z"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth="1"
            opacity="0.7"
          />
        </g>
        <text
          x={(goalX).toFixed(1)}
          y={(goalY - 11).toFixed(1)}
          textAnchor="middle"
          fontSize="9"
          fontFamily="var(--font-mono)"
          fill="var(--text-tertiary)"
          letterSpacing="0.1em"
        >GOAL</text>
      </svg>

      {/* Goal text — quietly stated below the arc */}
      <p style={{
        marginTop: 12,
        fontSize: 13, fontStyle: "italic",
        fontFamily: "'Instrument Serif', Georgia, serif",
        color: "var(--text-secondary)",
        lineHeight: 1.4,
      }}>
        Walking toward <span style={{ color: "var(--text-primary)" }}>{arc.goal}</span>.
        <span style={{
          marginLeft: 8,
          fontSize: 10, fontFamily: "var(--font-mono)",
          color: "var(--text-tertiary)", fontStyle: "normal",
          letterSpacing: "0.06em",
        }}>
          · {seq} {seq === 1 ? "level" : "levels"} in
        </span>
      </p>
    </div>
  );
}
