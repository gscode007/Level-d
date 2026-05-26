/**
 * POST /api/oauth/code
 *
 * Called by the React /oauth/authorize page after the user clicks "Allow".
 * Validates the user (via Firebase ID token), validates the OAuth params,
 * issues a short-lived authorization code, and returns the redirect target.
 *
 * Body shape:
 *   {
 *     idToken: string,            // Firebase ID token of the user authorizing
 *     clientId: string,
 *     redirectUri: string,
 *     codeChallenge: string,
 *     codeChallengeMethod: "S256",
 *     state?: string,
 *     scope?: string
 *   }
 *
 * Returns:
 *   { code, redirectUri, state }
 */

import crypto from "node:crypto";
import admin from "firebase-admin";

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes per OAuth 2.1 recommendation

function initAdmin() {
  if (admin.apps.length) return;
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey    = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase admin env vars not set (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)");
  }
  if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

async function uidFromIdToken(idToken) {
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch (e) {
    return { error: `Token verification failed: ${e.code || e.message || String(e)}` };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  try {
    initAdmin();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const { idToken, clientId, redirectUri, codeChallenge, codeChallengeMethod, state, scope } = req.body || {};

  if (!idToken)              return res.status(400).json({ error: "idToken is required" });
  if (!clientId)             return res.status(400).json({ error: "clientId is required" });
  if (!redirectUri)          return res.status(400).json({ error: "redirectUri is required" });
  if (!codeChallenge)        return res.status(400).json({ error: "codeChallenge is required (PKCE)" });
  if (codeChallengeMethod !== "S256") {
    return res.status(400).json({ error: "Only S256 code_challenge_method is supported" });
  }

  // 1. Validate user
  const { uid, error: authErr } = await uidFromIdToken(idToken);
  if (authErr) return res.status(401).json({ error: authErr });

  // 2. Validate client + redirect_uri match
  const clientSnap = await admin.firestore().doc(`oauthClients/${clientId}`).get();
  if (!clientSnap.exists) return res.status(400).json({ error: "Unknown client_id" });
  const client = clientSnap.data();
  if (!Array.isArray(client.redirectUris) || !client.redirectUris.includes(redirectUri)) {
    return res.status(400).json({ error: "redirect_uri does not match any registered URI for this client" });
  }

  // 3. Issue code
  const code = crypto.randomBytes(24).toString("base64url");
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + CODE_TTL_MS);

  await admin.firestore().doc(`oauthCodes/${code}`).set({
    uid,
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scope: scope || "mcp",
    expiresAt,
    used: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return res.status(200).json({ code, redirectUri, state: state || null });
}
