import { CATEGORIES, CAT_META } from "../constants";
import styles from "../styles.module.css";

export default function RadarPanel({ scores }) {
  const N = CATEGORIES.length;
  const cx = 130, cy = 130, r = 90;
  const maxS = Math.max(...CATEGORIES.map(c => scores[c] || 0), 200);

  const pt = (i, val) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const d = (val / maxS) * r;
    return [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
  };

  const ax = (i, sc = 1) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(a) * r * sc, cy + Math.sin(a) * r * sc];
  };

  const poly = CATEGORIES.map((c, i) => pt(i, scores[c] || 0).join(",")).join(" ");

  return (
    <div className={styles.panel}>
      <p className={styles.panelLbl}>Dimension Balance</p>
      <svg viewBox="0 0 260 260" style={{ width: "100%", maxWidth: 220, display: "block", margin: "0 auto" }}>
        {/* Grid rings */}
        {[0.25, 0.5, 0.75, 1].map((lv, i) => (
          <polygon
            key={i}
            points={CATEGORIES.map((_, j) => ax(j, lv).join(",")).join(" ")}
            fill="none"
            stroke="#1C2E48"
            strokeWidth={1}
          />
        ))}

        {/* Axis lines */}
        {CATEGORIES.map((_, i) => {
          const [x, y] = ax(i);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#1C2E48" strokeWidth={1} />;
        })}

        {/* Data polygon */}
        <polygon
          points={poly}
          fill="rgba(59,130,246,0.08)"
          stroke="#3B82F6"
          strokeWidth={1.5}
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 4px rgba(59,130,246,0.4))" }}
        />

        {/* Data points */}
        {CATEGORIES.map((c, i) => {
          const [px, py] = pt(i, scores[c] || 0);
          return (
            <circle
              key={c} cx={px} cy={py} r={3.5}
              fill={CAT_META[c].accent}
              style={{ filter: `drop-shadow(0 0 3px ${CAT_META[c].accent})` }}
            />
          );
        })}

        {/* Labels */}
        {CATEGORIES.map((c, i) => {
          const [lx, ly] = ax(i, 1.3);
          return (
            <text
              key={c} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={8} fill="#496080"
              fontFamily="JetBrains Mono, SF Mono, monospace" fontWeight={600}
              letterSpacing="0.1em"
            >
              {c.slice(0, 3).toUpperCase()}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
