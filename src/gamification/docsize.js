/**
 * Firestore stores the whole user state in a single document, hard-capped at
 * 1,048,576 bytes. Once a doc hits that, writes fail and the user's state
 * becomes unwritable — a hard scaling cliff. This module estimates the
 * serialized size so we can warn well before the ceiling, and is the basis for
 * the Layer 2 before/after measurement.
 *
 * Pure, dependency-free. The estimate is the UTF-8 byte length of the JSON
 * encoding — close enough to Firestore's accounting for an early-warning guard.
 */

export const FIRESTORE_DOC_LIMIT_BYTES = 1048576;

export function estimateDocBytes(state) {
  try {
    const json = JSON.stringify(state) || "";
    // Prefer exact UTF-8 length when Buffer/TextEncoder is available.
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(json).length;
    return json.length;
  } catch {
    return 0;
  }
}

export function isOverDocWarnThreshold(state, warnBytes) {
  return estimateDocBytes(state) >= warnBytes;
}
