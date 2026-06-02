/**
 * Compact, content-driven empty state for a Goals section. Renders a single
 * quiet italic line directly under the section header — no duplicate "+ Add"
 * because the section header already exposes one.
 */
export default function EmptyHint({ text }) {
  return (
    <p style={{
      fontSize: 12,
      fontStyle: "italic",
      fontFamily: "'Instrument Serif', Georgia, serif",
      color: "var(--text-tertiary)",
      lineHeight: 1.4,
      margin: 0,
      padding: "8px 0 4px",
    }}>{text}</p>
  );
}
