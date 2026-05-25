import { S } from "../styles";

export default function EmptyHint({ text, onAdd }) {
  return (
    <div style={{ padding: "48px 0", textAlign: "center" }}>
      <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 16 }}>{text}</p>
      <button style={S.ghostBtn} onClick={onAdd}>+ Add goal</button>
    </div>
  );
}
