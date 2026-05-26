import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { S } from "../styles";

/* ──────────────────────────────────────────────────────────────────────────
   ApiKeysModal — manages MCP API keys for the Claude connector.
   Talks to /api/keys (authenticated via Firebase ID token).
   Shows: existing keys, generate-new flow with one-time reveal, revoke.
   ────────────────────────────────────────────────────────────────────────── */

async function call(action, payload = {}) {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("Not signed in");
  const r = await fetch("/api/keys", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);
  return data;
}

export default function ApiKeysModal({ onClose }) {
  const [keys, setKeys]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [label, setLabel]             = useState("");
  const [generating, setGenerating]   = useState(false);
  const [revealed, setRevealed]       = useState(null); // { key, keyId, prefix, label }
  const [copied, setCopied]           = useState(false);

  async function refresh() {
    setLoading(true); setError(null);
    try { const { keys } = await call("list"); setKeys(keys || []); }
    catch (e) { setError(e.message || String(e)); }
    finally  { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function handleGenerate() {
    setGenerating(true); setError(null);
    try {
      const result = await call("generate", { label: label.trim() });
      setRevealed(result);
      setLabel("");
      refresh();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(keyId) {
    if (!window.confirm("Revoke this key? Any Claude connector using it will stop working immediately.")) return;
    try { await call("revoke", { keyId }); refresh(); }
    catch (e) { setError(e.message || String(e)); }
  }

  function handleCopy() {
    if (!revealed?.key) return;
    navigator.clipboard.writeText(revealed.key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div style={{
        background: "var(--surface)",
        borderRadius: "12px 12px 0 0",
        borderTop: "1px solid var(--border)",
        borderLeft: "1px solid var(--border)",
        borderRight: "1px solid var(--border)",
        padding: "22px 26px 32px",
        width: "100%", maxWidth: 580,
        animation: "slideUp 0.3s var(--easing-spring)",
        maxHeight: "88vh", overflowY: "auto",
      }}>
        <div style={{ width: 28, height: 3, background: "var(--border)", borderRadius: 2, margin: "0 auto 22px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.02em" }}>
            ◇ Claude Connector — API Keys
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "var(--surface-2)", border: "1px solid var(--border)",
              width: 26, height: 26, borderRadius: 4,
              fontSize: 13, color: "var(--text-secondary)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >×</button>
        </div>

        <p style={{
          fontSize: 12, color: "var(--text-secondary)",
          lineHeight: 1.55, marginBottom: 18,
        }}>
          Connect Level-d to Claude as a custom MCP connector. Generate a key here, then paste it
          into claude.ai → Settings → Connectors → Custom (Bearer auth).
          The MCP endpoint is <code style={{ fontSize: 11 }}>{typeof window !== "undefined" ? window.location.origin : ""}/api/mcp</code>.
        </p>

        {error && (
          <div style={{
            padding: "10px 14px", marginBottom: 14,
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 6,
            fontSize: 11, color: "var(--red)",
            fontFamily: "var(--font-mono)", letterSpacing: "0.02em",
          }}>{error}</div>
        )}

        {/* One-time reveal of a freshly generated key */}
        {revealed && (
          <div style={{
            padding: "14px 16px", marginBottom: 18,
            background: "rgba(34,197,94,0.05)",
            border: "1px solid rgba(34,197,94,0.25)",
            borderLeft: "2px solid var(--green)",
            borderRadius: 8,
          }}>
            <p style={{
              fontSize: 10, fontWeight: 700, color: "var(--green)",
              fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 8,
            }}>
              ✓ NEW KEY · COPY IT NOW
            </p>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.4 }}>
              This is the only time you'll see the full key. If you lose it, generate a new one.
            </p>
            <div style={{
              display: "flex", gap: 6, alignItems: "center",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 4, padding: "8px 10px",
            }}>
              <code style={{
                flex: 1, minWidth: 0,
                fontSize: 12, color: "var(--text-primary)",
                fontFamily: "var(--font-mono)", letterSpacing: "0.02em",
                overflow: "auto", whiteSpace: "nowrap",
              }}>
                {revealed.key}
              </code>
              <button
                onClick={handleCopy}
                style={{
                  ...S.ghostBtn, fontSize: 10, padding: "5px 10px",
                  letterSpacing: "0.06em", fontFamily: "var(--font-mono)",
                  flexShrink: 0,
                  color: copied ? "var(--green)" : "var(--text-secondary)",
                  borderColor: copied ? "var(--green)" : "var(--border)",
                }}
              >{copied ? "COPIED" : "COPY"}</button>
            </div>
            <button
              onClick={() => setRevealed(null)}
              style={{ ...S.ghostBtn, marginTop: 10, fontSize: 11, padding: "6px 12px" }}
            >Done</button>
          </div>
        )}

        {/* Generate */}
        {!revealed && (
          <div style={{ marginBottom: 18 }}>
            <label style={S.fLbl}>Generate new key</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label (e.g., Claude Desktop) — optional"
                style={{ ...S.fInput, flex: 1 }}
                onKeyDown={(e) => e.key === "Enter" && !generating && handleGenerate()}
              />
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  ...S.addBtn, padding: "9px 16px",
                  opacity: generating ? 0.5 : 1, flexShrink: 0,
                }}
              >{generating ? "…" : "+ Generate"}</button>
            </div>
          </div>
        )}

        {/* List */}
        <div>
          <p style={{ ...S.panelLbl, marginBottom: 10 }}>Existing keys ({keys.length})</p>
          {loading && (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", padding: "16px 0" }}>
              Loading…
            </p>
          )}
          {!loading && keys.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", padding: "16px 0" }}>
              No keys yet — generate one above.
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {keys.map((k) => (
              <div key={k.keyId} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderLeft: "2px solid var(--accent)",
                borderRadius: 6,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                    <code style={{
                      fontSize: 12, fontFamily: "var(--font-mono)",
                      color: "var(--text-primary)", letterSpacing: "0.02em",
                    }}>{k.prefix}…</code>
                    {k.label && (
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{k.label}</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 9, color: "var(--text-tertiary)",
                    fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                  }}>
                    {k.createdAt ? `CREATED ${fmtDate(k.createdAt)}` : ""}
                    {k.lastUsed  ? ` · LAST USED ${fmtDate(k.lastUsed)}` : " · NEVER USED"}
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(k.keyId)}
                  title="Revoke this key"
                  style={{
                    fontSize: 10, fontWeight: 700,
                    fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
                    background: "rgba(239,68,68,0.08)",
                    color: "var(--red)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 4, padding: "4px 10px", cursor: "pointer",
                    flexShrink: 0,
                  }}
                >REVOKE</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return ""; }
}
