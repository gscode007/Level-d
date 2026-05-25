import { CATEGORIES, CAT_META } from "../constants";

export default function RadarChart({ catScores, size = 160, glowAccent = "var(--accent)" }) {
  const cx = size / 2, cy = size / 2;
  const r  = size / 2 - 24;
  const N  = CATEGORIES.length;
  const maxScore = Math.max(...CATEGORIES.map(c => catScores[c] || 0), 1);

  const getXY = (i, frac) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / N;
    return [cx + r * frac * Math.cos(angle), cy + r * frac * Math.sin(angle)];
  };

  const fracs = CATEGORIES.map(c => Math.min((catScores[c] || 0) / maxScore, 1));
  const dotPoints = CATEGORIES.map((c, i) => getXY(i, Math.max(fracs[i], 0.04)));
  const dataPath  = dotPoints.map(([x, y], i) =>
    `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
  ).join(" ") + "Z";

  const ringPaths = [0.25, 0.5, 0.75, 1].map(f => {
    const pts = CATEGORIES.map((_, i) => getXY(i, f));
    return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + "Z";
  });

  return (
    <svg width={size} height={size} style={{ overflow: "visible", display: "block" }}>
      {/* Grid rings */}
      {ringPaths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--border)" strokeWidth={0.8} opacity={0.55} />
      ))}

      {/* Axes */}
      {CATEGORIES.map((c, i) => {
        const [x1, y1] = getXY(i, 0);
        const [x2, y2] = getXY(i, 1);
        return (
          <line key={c}
            x1={x1.toFixed(1)} y1={y1.toFixed(1)}
            x2={x2.toFixed(1)} y2={y2.toFixed(1)}
            stroke="var(--border)" strokeWidth={0.8} opacity={0.55}
          />
        );
      })}

      {/* Data fill */}
      <path d={dataPath} fill={`${glowAccent}18`} stroke={glowAccent} strokeWidth={1.5} />

      {/* Category dots */}
      {CATEGORIES.map((c, i) => {
        const [x, y] = dotPoints[i];
        return (
          <circle key={c} cx={x.toFixed(1)} cy={y.toFixed(1)} r={3.5}
            fill={CAT_META[c].accent} opacity={fracs[i] > 0.04 ? 1 : 0.25}
          />
        );
      })}

      {/* Labels */}
      {CATEGORIES.map((c, i) => {
        const [lx, ly] = getXY(i, 1.38);
        return (
          <text key={c} x={lx.toFixed(1)} y={ly.toFixed(1)}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={7} fill={CAT_META[c].accent}
            fontFamily="var(--font-mono)" fontWeight="600" opacity={0.85}
          >
            {c.slice(0, 3).toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
}
