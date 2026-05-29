/**
 * Firebase Admin init for the maintenance scripts (audit / migration).
 *
 * Credential resolution, in order:
 *   1. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *      (the same trio the Vercel MCP function uses)
 *   2. GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON
 *      (the standard Google env var)
 *
 * No secret filename is hardcoded here, so this file is safe to commit.
 */
import admin from "firebase-admin";

export function initAdmin() {
  if (!admin.apps.length) {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
      let privateKey = FIREBASE_PRIVATE_KEY;
      if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
      admin.initializeApp({ credential: admin.credential.cert({ projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey }) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
      throw new Error(
        "No Firebase credentials. Set FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY, " +
        "or GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json",
      );
    }
  }
  return admin.firestore();
}

export { admin };
