import { useState } from "react";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS  = ["S","M","T","W","T","F","S"];
const ACCENT      = "#A78BFA"; // Resilience purple

export default function QuitCalendar({ goal, onClose }) {
  const today    = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Build sets keyed as "YYYY-M-D"
  const resistSet  = new Set((goal.resistLog  || []).map(d => fmtKey(new Date(d))));
  const succumbSet = new Set((goal.succumbLog || []).map(d => fmtKey(new Date(d))));

  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthResist  = (goal.resistLog  || []).filter(d => { const x = new Date(d); return x.getFullYear() === year && x.getMonth() === month; }).length;
  const monthSlips   = (goal.succumbLog || []).filter(d => { const x = new Date(d); return x.getFullYear() === year && x.getMonth() === month; }).length;
  const totalResist  = (goal.resistLog  || []).length;
  const totalSlips   = (goal.succumbLog || []).length;
  const canGoNext    = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        zIndex: 400,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "fadeIn 0.18s ease",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderTop: `2px solid ${ACCENT}`,
        borderRadius: "var(--radius-xl)",
        width: "100%", maxWidth: 360,
        boxShadow: "var(--shadow-lg)",
        animation: "scaleIn 0.25s var(--easing-spring)",
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid var(--border)", background: `${ACCENT}0d` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ color: ACCENT, fontSize: 12 }}>○</span>
                <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: ACCENT, letterSpacing: "0.08em", fontWeight: 700 }}>QUIT HABIT</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 10 }}>{goal.name}</div>

              {/* Stats row */}
              <div style={{ display: "flex", gap: 18 }}>
                <Stat label="STREAK"      value={`${goal.currentStreak || 0}D`} color={ACCENT} />
                <Stat label="BEST"        value={`${goal.bestStreak || 0}D`}    color={ACCENT} />
                <Stat label="RESISTED"    value={totalResist} color="var(--green)" />
                <Stat label="SLIPPED"     value={totalSlips}  color="var(--red)" />
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "var(--surface-2)", border: "1px solid var(--border)",
              width: 26, height: 26, borderRadius: 4, fontSize: 13, color: "var(--text-secondary)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>×</button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 14, padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <LegendItem color="var(--green)" label="Resisted" />
          <LegendItem color="var(--red)"   label="Slipped" />
        </div>

        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 6px" }}>
          <NavBtn onClick={() => setViewDate(new Date(year, month - 1, 1))}>‹</NavBtn>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
              {MONTH_NAMES[month]} {year}
            </div>
            <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 1 }}>
              {monthResist} resisted · {monthSlips} slipped
            </div>
          </div>
          <NavBtn onClick={() => canGoNext && setViewDate(new Date(year, month + 1, 1))} disabled={!canGoNext}>›</NavBtn>
        </div>

        {/* Calendar grid */}
        <div style={{ padding: "0 14px 18px" }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
            {DAY_LABELS.map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 8, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontWeight: 600, padding: "2px 0" }}>{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const key     = `${year}-${month}-${day}`;
              const resisted = resistSet.has(key);
              const slipped  = succumbSet.has(key);
              const isToday  = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
              const future   = new Date(year, month, day) > today;

              const bg    = resisted ? "var(--green)" : slipped ? "rgba(239,68,68,0.85)" : "var(--surface-2)";
              const color = resisted || slipped ? "#fff" : isToday ? ACCENT : future ? "var(--text-tertiary)" : "var(--text-secondary)";
              const border = isToday && !resisted && !slipped ? `1px solid ${ACCENT}` : `1px solid ${resisted ? "rgba(34,197,94,0.5)" : slipped ? "rgba(239,68,68,0.5)" : "var(--border)"}`;

              return (
                <div key={day} style={{
                  aspectRatio: "1",
                  background: bg,
                  border,
                  borderRadius: 4,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: resisted || slipped ? 700 : 400,
                  color,
                  opacity: future ? 0.3 : 1,
                  boxShadow: resisted ? "0 0 6px rgba(34,197,94,0.5)" : slipped ? "0 0 6px rgba(239,68,68,0.4)" : "none",
                }}>
                  {resisted ? "✓" : slipped ? "✗" : day}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

function Stat({ label, value, color = "var(--text-primary)" }) {
  return (
    <div>
      <div style={{ fontSize: 8, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>{label}</span>
    </div>
  );
}

function NavBtn({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: "var(--surface-2)", border: "1px solid var(--border)",
      borderRadius: 4, width: 26, height: 26, cursor: disabled ? "default" : "pointer",
      color: disabled ? "var(--text-tertiary)" : "var(--text-secondary)",
      fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
      opacity: disabled ? 0.4 : 1,
    }}>{children}</button>
  );
}
