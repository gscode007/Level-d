/**
 * Server-side transactional completion writes for the MCP server.
 *
 * Why: the previous MCP completion path did a non-atomic read-check-write on the
 * single user document, so two concurrent calls could both pass the
 * "already done today?" check and both append a completion (duplicate), and the
 * full-document overwrite could drop a concurrent update (lost update).
 *
 * Firestore is NoSQL, so there is no SQL UNIQUE constraint. The equivalent
 * DB-level guarantee is a deterministic "completion key" ledger document whose
 * id encodes (habit, day) or (quest). Creating it with tx.create inside a
 * transaction enforces exactly-once: if a concurrent writer already created it,
 * tx.create fails, Firestore retries the transaction, and on the retry the
 * ledger read sees it exists → we return a clean 409-style duplicate result.
 * Never a 500.
 *
 * `db` is injected (firebase-admin Firestore in prod, an in-memory fake in
 * tests) so the exactly-once behavior is verifiable without live infra.
 */

import { resolveTimeZone, tzToday, tzYesterday, tzDayKeyISO } from "../gamification/time.js";

export const habitLedgerId = (habitId, dayKeyISO) => `habit_${habitId}_${dayKeyISO}`;
export const questLedgerId = (questId) => `quest_${questId}`;

// Pure: apply a habit completion to user state (no XP — matching existing MCP
// behavior, where XP/Resilience land when the app next opens). Mirrors the
// prior daily streak logic, now timezone-aware.
export function applyHabitCompletion(state, goalId, today, yStr) {
  const lv = (state.levels || []).find((l) => l.id === state.currentLevelId) || state.levels?.[0];
  const newStreak = state.lastCompletions?.[goalId] === yStr ? (state.streaks?.[goalId] || 0) + 1 : 1;
  const ts = Date.now();
  const newLevels = state.levels.map((l) =>
    l.id === lv.id
      ? { ...l, goals: l.goals.map((g) => (g.id === goalId ? { ...g, completions: [...(g.completions || []), ts] } : g)) }
      : l,
  );
  const newState = {
    ...state,
    levels: newLevels,
    lastCompletions: { ...(state.lastCompletions || {}), [goalId]: today },
    streaks: { ...(state.streaks || {}), [goalId]: newStreak },
    lastHabitDate: today,
    consecutiveMissed: 0,
  };
  return { state: newState, result: { ok: true, streak: newStreak, completedAt: ts } };
}

// Transactional habit completion. Returns a status-tagged result; callers map
// it to the MCP tool's existing return shape. Never throws on a duplicate.
export async function completeHabitTransactional(db, uid, goalId, now = new Date()) {
  const userRef = db.doc(`users/${uid}`);
  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new Error("User has no Level-d data yet — sign in to the app once first.");
    const state = userSnap.data();

    const lv = (state.levels || []).find((l) => l.id === state.currentLevelId) || state.levels?.[0];
    const goal = (lv?.goals || []).find((g) => g.id === goalId);
    if (!goal) return { ok: false, status: 404, error: `No goal with id ${goalId}` };
    if (goal.type !== "habitual") return { ok: false, status: 400, error: "complete_habit only works on habitual goals — use a different tool for milestones/quit-habits." };

    const tz = resolveTimeZone(state);
    const dayKey = tzDayKeyISO(now, tz);
    const ledgerRef = db.doc(`users/${uid}/completionKeys/${habitLedgerId(goalId, dayKey)}`);
    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists) {
      return { ok: false, status: 409, alreadyDoneToday: true, streak: state.streaks?.[goalId] || 0 };
    }

    const { state: newState, result } = applyHabitCompletion(state, goalId, tzToday(tz, now), tzYesterday(tz, now));
    tx.set(userRef, newState);
    tx.create(ledgerRef, { type: "habit", habitId: goalId, day: dayKey, createdAt: Date.now() });
    return { ...result, status: 200 };
  });
}

// Transactional quest completion. Idempotency key is (uid, questId) — a quest is
// completable once. Marks completed + leaves XP pending (client reconciles on
// load), matching the existing behavior.
export async function completeQuestTransactional(db, uid, questId, now = new Date()) {
  const userRef = db.doc(`users/${uid}`);
  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new Error("User has no Level-d data yet — sign in to the app once first.");
    const state = userSnap.data();

    const quest = (state.quests || []).find((q) => q.id === questId);
    if (!quest) return { ok: false, status: 404, error: `No quest with id ${questId}` };

    const ledgerRef = db.doc(`users/${uid}/completionKeys/${questLedgerId(questId)}`);
    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists || quest.status === "completed") {
      return { ok: false, status: 409, alreadyCompleted: true, quest };
    }

    const completed = { ...quest, status: "completed", completedAt: now.getTime(), xpAwarded: false };
    const newQuests = (state.quests || []).map((q) => (q.id === questId ? completed : q));
    tx.set(userRef, { ...state, quests: newQuests });
    tx.create(ledgerRef, { type: "quest", questId, createdAt: Date.now() });
    return { ok: true, status: 200, quest: completed };
  });
}
