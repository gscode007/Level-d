import { useState } from "react";
import { CAT_META } from "../constants";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS  = ["S","M","T","W","T","F","S"];

function computeStreaks(completions) {
  if (!completions || completions.length === 0) return { current: 0, best: 0 };
  const days = [...new Set(completions.map(ts => {
    const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime();
  }))].sort((a,b) => a - b);

  let best = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    if ((days[i] - days[i-1]) / 86400000 === 1) { run++; if (run > best) best = run; }
    else run = 1;
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const daysSince = (today.getTime() - days[days.length - 1]) / 86400000;
  let current = 0;
  if (daysSince <= 1) {
    current = 1;
    for (let i = days.length - 2; i >= 0; i--) {
      if ((days[i+1] - days[i]) / 86400000 === 1) current++;
      else break;
    }
  }
  return { current, best: Math.max(best, current) };
}

export default function HabitCalendar({ goal, onClose }) {
  const today    = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const accent  = CAT_META[goal.category]?.accent || "var(--accent)";
  const year    = viewDate.getFullYear();
  const month   = viewDate.getMonth();

  const completionSet = new Set(
    (goal.completions || []).map(ts => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthDone    = (goal.completions || []).filter(ts => { const d = new Date(ts); return d.getFullYear() === year && d.getMonth() === month; }).length;
  const { current, best } = computeStreaks(goal.completions || []);
  const totalDone    = (goal.completions || []).length;
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
        borderRadius: "var(--radius-xl)",
        width: "100%", maxWidth: 380,
        maxHeight: "88vh", overflowY: "auto",
        boxShadow: "var(--shadow-lg)",
        animation: "scaleIn 0.25s var(--easing-spring)",
      }}>

        {/* Header */}
        <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid var(--border)", background: `${accent}0d` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ color: accent, fontSize: 12 }}>{CAT_META[goal.category]?.symbol}</span>
                <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: accent, letterSpacing: "0.08em", fontWeight: 700 }}>
                  HABIT CALENDAR
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 10 }}>{goal.name}</div>
              <div style={{ display: "flex", gap: 18 }}>
                <Stat label="TOTAL" value={totalDone} />
                <Stat label="STREAK" value={`${current}D`} color={current >= 3 ? "var(--yellow)" : "var(--text-primary)"} />
                <Stat label="BEST" value={`${best}D`} color={accent} />
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "var(--surface-2)", border: "1px solid var(--border)",
              width: 26, height: 26, borderRadius: 4, fontSize: 13, color: "var(--text-secondary)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>×</button>
          </div>
        </div>

        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 6px" }}>
          <NavBtn onClick={() => setViewDate(new Date(year, month - 1, 1))}>‹</NavBtn>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
              {MONTH_NAMES[month]} {year}
            </div>
            <div style={{ fontSize: 9, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 1 }}>
              {monthDone} completion{monthDone !== 1 ? "s" : ""} this month
            </div>
          </div>
          <NavBtn onClick={() => canGoNext && setViewDate(new Date(year, month + 1, 1))} disabled={!canGoNext}>›</NavBtn>
        </div>

        {/* Grid */}
        <div style={{ padding: "0 14px 18px" }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
            {DAY_LABELS.map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 8, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.04em", padding: "2px 0" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />;
              const key = `${year}-${month}-${day}`;
              const done    = completionSet.has(key);
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
              const future  = new Date(year, month, day) > today;

              return (
                <div key={day} style={{
                  aspectRatio: "1",
                  background: done ? accent : "var(--surface-2)",
                  border: `1px solid ${isToday ? accent : done ? `${accent}55` : "var(--border)"}`,
                  borderRadius: 4,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: done ? 700 : 400,
                  color: done ? "#fff" : isToday ? accent : future ? "var(--text-tertiary)" : "var(--text-secondary)",
                  opacity: future ? 0.3 : 1,
                  boxShadow: done ? `0 0 6px ${accent}55` : "none",
                }}>
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        <AnchorBlock goal={goal} accent={accent} />
        <CompletionNotes goal={goal} />
      </div>
    </div>
  );
}

function AnchorBlock({ goal, accent }) {
  const a = goal.anchor;
  const hasAnchor = a && (a.cue || a.location || a.action || a.prep);
  const hasNotes = !!goal.notes;
  const hasFallback = !!goal.ifThenFallback;
  if (!hasAnchor && !hasNotes && !hasFallback) return null;

  return (
    <div style={{
      padding: "12px 16px 14px",
      borderTop: "1px solid var(--border)",
      background: "var(--surface-2)",
    }}>
      <div style={{
        fontSize: 9, fontFamily: "var(--font-mono)", color: accent,
        letterSpacing: "0.1em", fontWeight: 700, marginBottom: 8,
      }}>
        ◆ ANCHOR
      </div>
      {hasAnchor && (
        <div style={{ marginBottom: hasNotes || hasFallback ? 10 : 0 }}>
          {a.cue      && <AnchorRow label="When"  text={a.cue} />}
          {a.location && <AnchorRow label="Where" text={a.location} />}
          {a.action   && <AnchorRow label="Do"    text={a.action} />}
          {a.prep     && <AnchorRow label="Prep"  text={a.prep} muted />}
        </div>
      )}
      {hasFallback && (
        <div style={{ marginBottom: hasNotes ? 10 : 0 }}>
          <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 3 }}>
            IF / THEN
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
            {goal.ifThenFallback}
          </div>
        </div>
      )}
      {hasNotes && (
        <div>
          <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 3 }}>
            NOTES
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {goal.notes}
          </div>
        </div>
      )}
    </div>
  );
}

function AnchorRow({ label, text, muted }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "baseline" }}>
      <span style={{
        fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)",
        letterSpacing: "0.06em", width: 38, flexShrink: 0,
      }}>{label.toUpperCase()}</span>
      <span style={{
        fontSize: 12, color: muted ? "var(--text-tertiary)" : "var(--text-primary)",
        lineHeight: 1.4, fontStyle: muted ? "italic" : "normal",
      }}>{text}</span>
    </div>
  );
}

function CompletionNotes({ goal }) {
  const notes = goal.completionNotes || {};
  const entries = Object.entries(notes)
    .map(([ts, text]) => ({ ts: Number(ts), text }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 14);
  if (entries.length === 0) return null;

  return (
    <div style={{
      padding: "12px 16px 16px",
      borderTop: "1px solid var(--border)",
    }}>
      <div style={{
        fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)",
        letterSpacing: "0.1em", fontWeight: 700, marginBottom: 8,
      }}>
        RECENT NOTES · {entries.length}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map(({ ts, text }) => {
          const d = new Date(ts);
          return (
            <div key={ts} style={{
              padding: "8px 10px",
              background: "var(--surface-2)",
              border: "1px solid var(--border-light)",
              borderRadius: 5,
            }}>
              <div style={{
                fontSize: 9, color: "var(--text-tertiary)",
                fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                marginBottom: 3,
              }}>
                {d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.4 }}>
                {text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, color = "var(--text-primary)" }) {
  return (
    <div>
      <div style={{ fontSize: 8, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color, letterSpacing: "-0.01em" }}>{value}</div>
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
