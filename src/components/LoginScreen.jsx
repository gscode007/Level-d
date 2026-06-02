import styles from "../styles.module.css";

export default function LoginScreen({ onSignIn, error }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Geist', -apple-system, sans-serif",
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)",
        padding: "48px 44px 40px",
        width: "100%",
        maxWidth: 400,
        boxShadow: "var(--shadow-md), 0 0 40px rgba(59,130,246,0.06)",
        animation: "scaleIn 0.4s var(--easing-spring)",
        textAlign: "center",
      }}>
        {/* Logo mark */}
        <div style={{
          width: 44, height: 44, borderRadius: 8,
          background: "var(--accent-dim)",
          border: "1px solid var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 26px",
          fontSize: 18,
          boxShadow: "0 0 20px var(--accent-glow)",
        }}>
          ◈
        </div>

        <p className={styles.eyebrow} style={{ textAlign: "center", marginBottom: 10 }}>
          Leveld
        </p>

        <h1 style={{
          fontSize: 26, fontWeight: 300,
          color: "var(--text-primary)",
          fontFamily: "'Instrument Serif', serif",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          marginBottom: 12,
        }}>
          Track your progress.<br />Level up your life.
        </h1>

        <p style={{
          fontSize: 13, color: "var(--text-secondary)",
          lineHeight: 1.6, marginBottom: 32,
        }}>
          Your data syncs across devices and is tied to your account.
        </p>

        <button
          onClick={onSignIn}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 20px",
            fontSize: 13, fontWeight: 500,
            color: "var(--text-primary)",
            cursor: "pointer",
            transition: "border-color 0.15s, background 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accent-dim)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface-2)"; }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {error && (
          <p style={{
            marginTop: 14, fontSize: 12,
            color: "var(--red)",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 6, padding: "8px 12px",
            fontFamily: "var(--font-mono)",
          }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
