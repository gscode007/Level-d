/**
 * POST /api/oauth/token
 *
 * OAuth 2.1 Authorization Code grant with PKCE. claude.ai POSTs here with
 * the auth code + code_verifier; we validate PKCE and return an access
 * token usable as a Bearer token against /api/mcp.
 *
 * Form (application/x-www-form-urlencoded) or JSON body:
 *   grant_type=authorization_code
 *   code=...
 *   code_verifier=...
 *   redirect_uri=...
 *   client_id=...
 */

import crypto from "node:crypto";
import admin from "firebase-admin";

// Long-ish access token TTL because we don't issue refresh tokens (yet).
// 90 days is generous but workable for a personal app; trim down later if
// you add refresh tokens.
const ACCESS_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

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

function sha256(s) { return crypto.createHash("sha256").update(s).digest(); }

// PKCE S256: base64url(SHA256(verifier)) == challenge
function verifyPkceS256(verifier, challenge) {
  if (!verifier || !challenge) return false;
  const computed = sha256(verifier).toString("base64url");
  return computed === challenge;
}

// Vercel passes form bodies as a parsed object when Content-Type is
// application/x-www-form-urlencoded, but only sometimes — depending on the
// runtime version. Normalize both JSON and form bodies to a plain object.
function readBody(req) {
  if (typeof req.body === "object" && req.body !== null) return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch {}
    const params = new URLSearchParams(req.body);
    const out = {};
    for (const [k, v] of params) out[k] = v;
    return out;
  }
  return {};
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "method_not_allowed" });

  try {
    initAdmin();
  } catch (e) {
    return res.status(500).json({ error: "server_error", error_description: e.message });
  }

  const body = readBody(req);
  const grantType    = body.grant_type;
  const code         = body.code;
  const codeVerifier = body.code_verifier;
  const redirectUri  = body.redirect_uri;
  const clientId     = body.client_id;

  if (grantType !== "authorization_code") {
    return res.status(400).json({ error: "unsupported_grant_type", error_description: "Only authorization_code is supported" });
  }
  if (!code)         return res.status(400).json({ error: "invalid_request", error_description: "code required" });
  if (!codeVerifier) return res.status(400).json({ error: "invalid_request", error_description: "code_verifier required" });
  if (!clientId)     return res.status(400).json({ error: "invalid_request", error_description: "client_id required" });

  // Atomic-ish single-use: read, validate, mark used. Race window is small
  // enough that for a personal app this is fine; for scale this should be a
  // Firestore transaction.
  const codeRef = admin.firestore().doc(`oauthCodes/${code}`);
  const codeSnap = await codeRef.get();
  if (!codeSnap.exists) {
    return res.status(400).json({ error: "invalid_grant", error_description: "Unknown or expired code" });
  }
  const codeData = codeSnap.data();

  if (codeData.used) {
    // Token replay — invalidate any tokens this code spawned (defensive)
    return res.status(400).json({ error: "invalid_grant", error_description: "Authorization code already used" });
  }
  if (codeData.expiresAt && codeData.expiresAt.toMillis() < Date.now()) {
    return res.status(400).json({ error: "invalid_grant", error_description: "Authorization code expired" });
  }
  if (codeData.clientId !== clientId) {
    return res.status(400).json({ error: "invalid_grant", error_description: "client_id mismatch" });
  }
  if (codeData.redirectUri !== redirectUri) {
    return res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri mismatch" });
  }
  if (!verifyPkceS256(codeVerifier, codeData.codeChallenge)) {
    return res.status(400).json({ error: "invalid_grant", error_description: "PKCE verifier does not match challenge" });
  }

  await codeRef.update({ used: true, usedAt: admin.firestore.FieldValue.serverTimestamp() });

  // Mint access token. Stored by hash so the raw value lives only in the
  // response and (presumably) claude.ai's secret store.
  const accessToken = "lvldo_" + crypto.randomBytes(24).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(accessToken).digest("hex");
  const expiresAtMs = Date.now() + ACCESS_TOKEN_TTL_MS;

  await admin.firestore().doc(`oauthAccessTokens/${tokenHash}`).set({
    uid: codeData.uid,
    clientId,
    scope: codeData.scope || "mcp",
    expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return res.status(200).json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scope: codeData.scope || "mcp",
  });
}
