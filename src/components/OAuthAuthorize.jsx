import { useEffect, useState } from "react";
import { auth } from "../firebase";
import styles from "../styles.module.css";
import LoginScreen from "./LoginScreen";

/* ──────────────────────────────────────────────────────────────────────────
   OAuthAuthorize — the user-facing "Allow Claude to access Level-d?" page.
   Mounted at /oauth/authorize?... (Vercel SPA-fallbacks unknown paths to
   index.html, so this route is purely client-side).

   Flow:
     1. Parse OAuth params from URL.
     2. If user not signed in, show LoginScreen.
     3. Otherwise show approval UI.
     4. On Allow: POST to /api/oauth/code with Firebase ID token + params,
        receive auth code, redirect browser to redirect_uri?code=...&state=...
     5. On Deny: redirect to redirect_uri?error=access_denied&state=...
   ────────────────────────────────────────────────────────────────────────── */

export default function OAuthAuthorize({ user, onSignIn, signInError }) {
  const params = readOAuthParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  // If the URL is missing required params, that's a client integration bug —
  // show a flat error rather than a half-functional form.
  const paramError = validateParams(params);

  useEffect(() => {
    document.title = "Authorize · Level-d";
  }, []);

  if (paramError) return <FailScreen heading="Invalid authorization request" message={paramError} />;

  if (!user) {
    return (
      <div style={{ position: "relative" }}>
        <div style={{
          position: "fixed", top: 24, left: 0, right: 0,
          textAlign: "center", zIndex: 10,
          fontSize: 12, color: "var(--text-tertiary)",
          fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
        }}>
          Sign in to authorize <strong style={{ color: "var(--accent)" }}>Claude</strong> for your Level-d account
        </div>
        <LoginScreen onSignIn={onSignIn} error={signInError} />
      </div>
    );
  }

  function deny() {
    const u = new URL(params.redirectUri);
    u.searchParams.set("error", "access_denied");
    if (params.state) u.searchParams.set("state", params.state);
    window.location.href = u.toString();
  }

  async function allow() {
    setSubmitting(true);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No active session — please sign in again.");
      const r = await fetch("/api/oauth/code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idToken,
          clientId: params.clientId,
          redirectUri: params.redirectUri,
          codeChallenge: params.codeChallenge,
          codeChallengeMethod: params.codeChallengeMethod,
          state: params.state,
          scope: params.scope,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `Authorization failed (${r.status})`);

      const u = new URL(data.redirectUri);
      u.searchParams.set("code", data.code);
      if (data.state) u.searchParams.set("state", data.state);
      window.location.href = u.toString();
    } catch (e) {
      setError(e.message || String(e));
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.setupWrap}>
      <div className={styles.setupCard} style={{ maxWidth: 460, padding: "36px 36px 32px" }}>
        <p className={styles.eyebrow}>OAuth Authorize</p>
        <h1 className={styles.setupH} style={{ marginBottom: 12 }}>
          Allow <span style={{ color: "var(--accent)" }}>Claude</span> to read &amp; write your Level-d data?
        </h1>
        <p className={styles.setupDesc} style={{ marginBottom: 18 }}>
          Granting access lets Claude see your habits, identities, weekly votes, and create or complete goals on your behalf.
        </p>

        <div style={{
          padding: "12px 14px", marginBottom: 18,
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderLeft: "2px solid var(--accent)",
          borderRadius: 6,
        }}>
          <p style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 4 }}>
            SIGNED IN AS
          </p>
          <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.4 }}>
            {user.displayName || user.email}
          </p>
        </div>

        <ul style={{
          listStyle: "none", padding: 0, margin: "0 0 22px",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <Permission text="Read your chapter, identities, habits, and weekly summary" />
          <Permission text="Create habits, milestones, and quit-habits" />
          <Permission text="Mark habits complete for today" />
        </ul>

        {error && (
          <div style={{
            padding: "10px 14px", marginBottom: 16,
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 6,
            fontSize: 11, color: "var(--red)",
            fontFamily: "var(--font-mono)", letterSpacing: "0.02em",
          }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={deny}
            disabled={submitting}
            className={styles.backBtn}
            style={{ flex: 1, opacity: submitting ? 0.5 : 1 }}
          >
            Deny
          </button>
          <button
            onClick={allow}
            disabled={submitting}
            className={styles.nextBtn}
            style={{ marginTop: 0, flex: 1.6, opacity: submitting ? 0.5 : 1 }}
          >
            {submitting ? "Authorizing…" : "Allow"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Permission({ text }) {
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 }}>
      <span style={{ color: "var(--accent)", fontSize: 12, marginTop: 1 }}>◆</span>
      <span>{text}</span>
    </li>
  );
}

function FailScreen({ heading, message }) {
  return (
    <div className={styles.setupWrap}>
      <div className={styles.setupCard} style={{ maxWidth: 460 }}>
        <p className={styles.eyebrow}>OAuth</p>
        <h1 className={styles.setupH} style={{ marginBottom: 12 }}>{heading}</h1>
        <p className={styles.setupDesc}>{message}</p>
      </div>
    </div>
  );
}

function readOAuthParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    clientId:            q.get("client_id"),
    redirectUri:         q.get("redirect_uri"),
    codeChallenge:       q.get("code_challenge"),
    codeChallengeMethod: q.get("code_challenge_method"),
    state:               q.get("state"),
    scope:               q.get("scope"),
    responseType:        q.get("response_type"),
  };
}

function validateParams(p) {
  if (p.responseType && p.responseType !== "code") return `Unsupported response_type=${p.responseType} (only "code" is supported).`;
  if (!p.clientId)             return "Missing client_id parameter.";
  if (!p.redirectUri)          return "Missing redirect_uri parameter.";
  if (!p.codeChallenge)        return "Missing code_challenge parameter (PKCE required).";
  if (p.codeChallengeMethod && p.codeChallengeMethod !== "S256") {
    return `Unsupported code_challenge_method=${p.codeChallengeMethod} (only S256 is supported).`;
  }
  try { new URL(p.redirectUri); } catch { return "redirect_uri is not a valid URL."; }
  return null;
}
