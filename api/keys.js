/**
 * Vercel serverless function — POST /api/keys
 *
 * Manages MCP API keys for the signed-in user. Authenticated via a Firebase
 * ID token (the client grabs one from auth.currentUser.getIdToken()).
 *
 * Body shape:
 *   { "action": "list" }
 *   { "action": "generate", "label": "Claude Desktop" }
 *   { "action": "revoke", "keyId": "..." }
 *
 * See TODO.md — this whole flow gets replaced with OAuth before scaling.
 */

import crypto from "node:crypto";
import admin from "firebase-admin";

// initAdmin must run before any admin.auth() / admin.firestore() call, or
// the SDK throws app/no-app. Previously this lived only inside db(), but
// authenticateUser uses admin.auth() and never touched db() — so on cold
// starts the SDK was uninitialized when the first verifyIdToken ran.
function initAdmin() {
  if (admin.apps.length) return;
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey    = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase admin env vars not set (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)");
  }
  if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function db() {
  initAdmin();
  return admin.firestore();
}

// Returns { uid } on success or { error } with the actual Firebase rejection
// reason on failure. Surfacing the real reason matters here because the most
// common cause (FIREBASE_PROJECT_ID server-side ≠ VITE_FIREBASE_PROJECT_ID
// client-side) is invisible otherwise.
async function authenticateUser(req) {
  const auth = req.headers["authorization"] || req.headers["Authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return { error: "Missing Authorization header" };
  const idToken = auth.slice(7).trim();
  if (!idToken) return { error: "Empty bearer token" };
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch (e) {
    return { error: `Token verification failed: ${e.code || e.message || String(e)}` };
  }
}

function sha256(s) { return crypto.createHash("sha256").update(s).digest("hex"); }

// Random key body: 32 url-safe chars. Prefix `lvld_` so the MCP server can
// recognize it cheaply before doing a Firestore lookup.
function newKey() {
  const buf = crypto.randomBytes(24);
  return "lvld_" + buf.toString("base64url");
}

async function listKeys(uid) {
  const snap = await db().collection(`users/${uid}/apiKeys`).orderBy("createdAt", "desc").get();
  return snap.docs.map(d => {
    const data = d.data();
    return {
      keyId: d.id,
      prefix: data.prefix,
      label: data.label || "",
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      lastUsed: data.lastUsed?.toDate?.()?.toISOString() || null,
    };
  });
}

async function generateKey(uid, label) {
  // Init the admin SDK once before initializing helpers depend on it
  db();

  const key = newKey();
  const hash = sha256(key);
  const keyId = hash.slice(0, 12);
  const prefix = key.slice(0, 12); // lvld_ + 7 chars — enough to identify, not enough to abuse
  const now = admin.firestore.FieldValue.serverTimestamp();

  // Two-doc write: one for fast MCP lookup by hash, one for the user's UI.
  // Batched so partial failures don't leave orphaned docs.
  const batch = db().batch();
  batch.set(db().doc(`apiKeys/${hash}`),                { uid, keyId, createdAt: now });
  batch.set(db().doc(`users/${uid}/apiKeys/${keyId}`),  { hash, prefix, label: label || "", createdAt: now });
  await batch.commit();

  return { key, keyId, prefix, label: label || "" };
}

async function revokeKey(uid, keyId) {
  if (!keyId) throw new Error("keyId is required");
  const userRef = db().doc(`users/${uid}/apiKeys/${keyId}`);
  const snap = await userRef.get();
  if (!snap.exists) throw new Error("Key not found");
  const { hash } = snap.data();

  const batch = db().batch();
  if (hash) batch.delete(db().doc(`apiKeys/${hash}`));
  batch.delete(userRef);
  await batch.commit();

  return { ok: true, keyId };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  let authResult;
  try {
    initAdmin();
    authResult = await authenticateUser(req);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
  if (authResult.error) return res.status(401).json({ error: authResult.error });
  const uid = authResult.uid;

  const { action, label, keyId } = req.body || {};

  try {
    if (action === "list")     return res.status(200).json({ keys: await listKeys(uid) });
    if (action === "generate") return res.status(200).json(await generateKey(uid, label));
    if (action === "revoke")   return res.status(200).json(await revokeKey(uid, keyId));
    return res.status(400).json({ error: `Unknown action: ${action}. Use list, generate, or revoke.` });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
