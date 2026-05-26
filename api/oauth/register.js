/**
 * OAuth 2.0 Dynamic Client Registration (RFC 7591).
 *
 * claude.ai POSTs its client metadata here when a user first adds the
 * connector. We mint a public client_id (no secret — PKCE handles security
 * for public clients per OAuth 2.1) and store it for later validation.
 */

import crypto from "node:crypto";
import admin from "firebase-admin";

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  try {
    initAdmin();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const body = req.body || {};
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter(u => typeof u === "string") : [];
  if (redirectUris.length === 0) {
    return res.status(400).json({ error: "invalid_redirect_uri", error_description: "redirect_uris is required" });
  }

  const clientId = "lvldc_" + crypto.randomBytes(16).toString("base64url");
  const now = admin.firestore.FieldValue.serverTimestamp();
  const clientName = (typeof body.client_name === "string" && body.client_name.trim()) || "unnamed client";

  await admin.firestore().doc(`oauthClients/${clientId}`).set({
    redirectUris,
    clientName,
    grantTypes: ["authorization_code"],
    responseTypes: ["code"],
    tokenEndpointAuthMethod: "none",
    createdAt: now,
  });

  // Per RFC 7591 the response echoes back the client metadata + the new client_id
  return res.status(201).json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: redirectUris,
    client_name: clientName,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
}
