import { useState } from "react";
import styles from "../styles.module.css";
import { useIsMobile } from "../hooks/useIsMobile";
import ApiKeysModal from "./ApiKeysModal";

/**
 * Settings view — collects everything that used to be jammed into the
 * sidebar footer into a real page (Phase 7). Reachable on both shells:
 *   - Desktop: profile chip in sidebar → setView("settings")
 *   - Mobile : bottom-nav "Settings" tab
 *
 * No mechanic change — just relocations. AI Agent + BG Motion + Connector
 * + Reset + Sign out all live here now.
 */
export default function SettingsView({
  user,
  aiAgentEnabled,
  onToggleAgent,
  reduceBackgroundMotion,
  onToggleReduceMotion,
  onReset,
  onSignOut,
}) {
  const isMobile = useIsMobile();
  const [keysOpen, setKeysOpen] = useState(false);

  return (
    <div className={styles.page} style={{ maxWidth: "none", ...(isMobile ? { padding: "20px 14px 24px" } : {}) }}>
      <header style={{ marginBottom: 24 }}>
        <p className={styles.eyebrow}>Account</p>
        <h1 className={styles.pageH1}>Settings</h1>
      </header>

      {/* ── Profile chip ────────────────────────────────────────────────── */}
      <Section title="Profile">
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}>
          {user.photoURL ? (
            <img src={user.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: 6, border: "1px solid var(--border)" }} />
          ) : (
            <div style={{
              width: 40, height: 40, borderRadius: 6,
              background: "var(--accent-dim)", border: "1px solid var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "var(--accent)", fontWeight: 700,
            }}>
              {(user.displayName || user.email || "?")[0].toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.displayName || "User"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Appearance ──────────────────────────────────────────────────── */}
      <Section title="Appearance">
        <Row
          label="Background motion"
          hint="Reduce or restore the live background animations."
        >
          <button
            onClick={onToggleReduceMotion}
            className={styles.ghostBtn}
            style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", minWidth: 100 }}
            title={
              reduceBackgroundMotion === true  ? "Reduced. Click for ON."
            : reduceBackgroundMotion === false ? "Motion on. Click for AUTO."
            :                                    "Following OS pref. Click to set explicitly."
            }
          >
            {reduceBackgroundMotion === true ? "REDUCED"
            : reduceBackgroundMotion === false ? "ON"
            : "AUTO"}
          </button>
        </Row>
      </Section>

      {/* ── Integrations ────────────────────────────────────────────────── */}
      <Section title="Integrations">
        <Row
          label="AI Agent"
          hint="Optional Pro feature. The dev toggle here flips it on/off; in production this would be billing-gated."
        >
          <button
            onClick={onToggleAgent}
            className={styles.ghostBtn}
            style={{
              fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
              minWidth: 100,
              ...(aiAgentEnabled ? { color: "var(--accent)", borderColor: "var(--accent)", background: "var(--accent-dim)" } : {}),
            }}
          >
            {aiAgentEnabled ? "ON" : "PRO"}
          </button>
        </Row>
        <Row
          label="Claude Connector"
          hint="MCP API keys + OAuth tokens for the claude.ai connector."
        >
          <button
            onClick={() => setKeysOpen(true)}
            className={styles.ghostBtn}
            style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}
          >
            Manage →
          </button>
        </Row>
      </Section>

      {/* ── Account ─────────────────────────────────────────────────────── */}
      <Section title="Danger zone">
        <Row label="Reset all progress" hint="Wipes habits, completions, levels, arc, and rank. Cannot be undone.">
          <button
            onClick={() => { if (window.confirm("Reset ALL progress? This cannot be undone.")) onReset(); }}
            className={styles.ghostBtn}
            style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", color: "var(--red)", borderColor: "rgba(239, 68, 68, 0.4)" }}
          >
            Reset
          </button>
        </Row>
        <Row label="Sign out" hint="Returns to the login screen. Your data stays in your account.">
          <button
            onClick={onSignOut}
            className={styles.ghostBtn}
            style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}
          >
            Sign out
          </button>
        </Row>
      </Section>

      {keysOpen && <ApiKeysModal onClose={() => setKeysOpen(false)} />}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{
        fontSize: 16, fontWeight: 300,
        fontFamily: "'Instrument Serif', Georgia, serif",
        color: "var(--text-primary)",
        letterSpacing: "-0.01em",
        marginBottom: 10,
      }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 14,
      padding: "12px 14px",
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 3 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.45 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}
