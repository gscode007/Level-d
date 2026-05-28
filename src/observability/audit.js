/**
 * Client-side append to the user's append-only XP audit log
 * (Firestore subcollection users/{uid}/xpAudit). Best-effort and
 * fire-and-forget: it must never block or break a completion. The MCP server
 * writes its audit rows transactionally; this captures in-app completions.
 */
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase.js";

export function appendXpAudit(uid, entry) {
  if (!uid || !entry) return;
  try {
    addDoc(collection(db, "users", uid, "xpAudit"), { ...entry, ts: entry.ts || Date.now() }).catch(() => {});
  } catch { /* ignore */ }
}
