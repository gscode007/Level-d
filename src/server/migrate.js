/**
 * Migration logic for A.2 — moving stray root `goal.completionLog[]` entries
 * into the `users/{uid}/xpAudit` subcollection. Extracted from the CLI so the
 * transactional, idempotent behavior is unit-testable with an injected db.
 *
 * `db` is injected (firebase-admin Firestore in the CLI, an in-memory fake in
 * tests). Pure helpers + one transactional function. No process/credential
 * concerns live here.
 */

export const MAX_TX_ENTRIES = 450; // stay under Firestore's per-transaction write ceiling

// [{ goalId, entry }] for every completionLog entry across all levels.
export function collectCompletionLog(data) {
  const out = [];
  for (const level of data?.levels || []) {
    for (const goal of level.goals || []) {
      if (Array.isArray(goal.completionLog)) {
        for (const entry of goal.completionLog) out.push({ goalId: goal.id, entry });
      }
    }
  }
  return out;
}

// Copy of levels with every goal.completionLog removed.
export function stripCompletionLog(levels) {
  return (levels || []).map((l) => ({
    ...l,
    goals: (l.goals || []).map((g) => {
      if (!("completionLog" in g)) return g;
      const { completionLog, ...rest } = g;
      return rest;
    }),
  }));
}

// Deterministic id so a re-run targets the same audit doc → idempotent.
export function migratedAuditId(goalId, ts) {
  return `mig_${goalId}_${ts}`;
}

export function toAuditRow(goalId, entry) {
  return {
    kind: "habit_completion",
    source: "migrated",
    goalId,
    ts: entry.ts ?? null,
    xp: entry.applied ?? null,
    breakdown: {
      base: entry.base ?? null,
      streakMultiplier: entry.streakMultiplier ?? null,
      surgeMultiplier: entry.surgeMultiplier ?? null,
      comebackBonus: entry.comebackBonus ?? null,
    },
    migratedAt: Date.now(),
  };
}

/**
 * Idempotently move one user's completionLog entries into xpAudit, then clear
 * the root arrays — all inside one transaction. Re-running is a no-op (entries
 * already in the subcollection are detected and skipped; root already cleared).
 * Returns { moved, alreadyPresent }.
 */
export async function migrateUserDoc(db, uid) {
  const docRef = db.doc(`users/${uid}`);
  return db.runTransaction(async (tx) => {
    // All reads first (Firestore requires reads before writes).
    const fresh = await tx.get(docRef);
    if (!fresh.exists) return { moved: 0, alreadyPresent: 0 };
    const data = fresh.data();
    const entries = collectCompletionLog(data);
    if (entries.length === 0) return { moved: 0, alreadyPresent: 0 };

    const planned = [];
    for (const { goalId, entry } of entries) {
      const auditRef = db.doc(`users/${uid}/xpAudit/${migratedAuditId(goalId, entry.ts)}`);
      const existing = await tx.get(auditRef);
      planned.push({ auditRef, goalId, entry, exists: existing.exists });
    }

    // Writes.
    let moved = 0;
    let alreadyPresent = 0;
    for (const p of planned) {
      if (p.exists) { alreadyPresent += 1; continue; }
      tx.set(p.auditRef, toAuditRow(p.goalId, p.entry));
      moved += 1;
    }
    tx.set(docRef, { ...data, levels: stripCompletionLog(data.levels) });
    return { moved, alreadyPresent };
  });
}
