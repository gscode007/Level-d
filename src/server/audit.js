/**
 * Append-only XP / completion audit log.
 *
 * Lives in a Firestore subcollection `users/{uid}/xpAudit` rather than a SQL
 * table (no SQL here). Every completion writes exactly one immutable audit row;
 * on the server it is written inside the same transaction as the completion, so
 * the audit row and the completion commit atomically — there is no completion
 * without an audit row and no audit row without a completion.
 *
 * Pure builders so the row shape is unit-testable; callers attach the doc.
 */

export function auditCollectionPath(uid) {
  return `users/${uid}/xpAudit`;
}

// Short random id for an audit doc (the doc is immutable; collisions are
// astronomically unlikely and would only drop one duplicate row).
export function auditId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function habitAuditEntry({ source, goalId, day, streak, xp = null, breakdown = null, now = Date.now() }) {
  return {
    kind: "habit_completion",
    source,            // "app" | "mcp"
    goalId,
    day,               // civil day string in the user's tz
    streak,
    xp,                // applied XP (null when XP is deferred, e.g. MCP path)
    breakdown,         // { base, streakMultiplier, surgeMultiplier, comebackBonus } or null
    ts: now,
  };
}

export function questAuditEntry({ source, questId, dimension, xp = null, now = Date.now() }) {
  return {
    kind: "quest_completion",
    source,
    questId,
    dimension,
    xp,                // null on the MCP path (XP reconciles on app load)
    ts: now,
  };
}
