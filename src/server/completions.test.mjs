import { test } from "node:test";
import assert from "node:assert/strict";

import { completeHabitTransactional, completeQuestTransactional, habitLedgerId } from "./completions.js";

/**
 * In-memory Firestore that models the two guarantees the production code relies
 * on: (1) optimistic concurrency — a transaction that read a doc whose version
 * later changed aborts and retries; (2) create-uniqueness — tx.create fails if
 * the target already exists. Under ANY interleaving this yields exactly-once,
 * because the completion write only commits in the same transaction as the
 * successful ledger create, and only one create can win.
 */
class FakeFirestore {
  constructor(initial = {}) {
    this.store = new Map();
    for (const [k, v] of Object.entries(initial)) this.store.set(k, { data: v, version: 1 });
    this._commitLock = Promise.resolve();
  }
  doc(path) { return { path }; }
  _snap(path) {
    const e = this.store.get(path);
    return { exists: !!e, data: () => (e ? structuredClone(e.data) : undefined), _version: e ? e.version : 0 };
  }
  async runTransaction(fn, hooks = {}) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const reads = new Map();
      const writes = [];
      const creates = [];
      const tx = {
        get: async (ref) => { const s = this._snap(ref.path); reads.set(ref.path, s._version); return s; },
        set: (ref, data) => writes.push([ref.path, structuredClone(data)]),
        create: (ref, data) => creates.push([ref.path, structuredClone(data)]),
      };
      const result = await fn(tx);
      if (hooks.beforeCommit && attempt === 0) await hooks.beforeCommit();
      let committed = false;
      await (this._commitLock = this._commitLock.then(async () => {
        for (const [p, v] of reads) {
          if ((this.store.get(p)?.version || 0) !== v) return; // stale read → abort
        }
        if (creates.some(([p]) => this.store.has(p))) return;   // create conflict → abort
        for (const [p, d] of writes) this.store.set(p, { data: d, version: (this.store.get(p)?.version || 0) + 1 });
        for (const [p, d] of creates) this.store.set(p, { data: d, version: 1 });
        committed = true;
      }));
      if (committed) return result;
    }
    throw new Error("transaction retry exhausted");
  }
  ledgerKeys(uid) {
    return [...this.store.keys()].filter((k) => k.startsWith(`users/${uid}/completionKeys/`));
  }
  auditKeys(uid) {
    return [...this.store.keys()].filter((k) => k.startsWith(`users/${uid}/xpAudit/`));
  }
  user(uid) { return this.store.get(`users/${uid}`).data; }
}

function userWithHabit() {
  return {
    currentLevelId: "L1",
    levels: [{ id: "L1", goals: [{ id: "H1", type: "habitual", frequency: 7, completions: [] }] }],
    streaks: {},
    lastCompletions: {},
    timezone: "Asia/Kolkata",
  };
}

// ── Gate: 50× concurrent completions succeed, zero duplicates ────────────────
test("50 concurrent habit completions → exactly one completion, one ledger, zero 500s", async () => {
  const db = new FakeFirestore({ "users/U1": userWithHabit() });
  const results = await Promise.all(
    Array.from({ length: 50 }, () => completeHabitTransactional(db, "U1", "H1")),
  );

  const ok = results.filter((r) => r.status === 200);
  const dup = results.filter((r) => r.status === 409 && r.alreadyDoneToday);
  assert.equal(ok.length, 1, "exactly one completion should win");
  assert.equal(dup.length, 49, "the rest are clean 409 duplicates");
  assert.equal(results.filter((r) => r === undefined).length, 0, "no call threw / 500'd");

  const goal = db.user("U1").levels[0].goals[0];
  assert.equal(goal.completions.length, 1, "zero duplicate completions in the doc");
  assert.equal(db.ledgerKeys("U1").length, 1, "exactly one ledger key");
  assert.equal(db.auditKeys("U1").length, 1, "exactly one audit row, atomic with the completion");
  assert.equal(db.user("U1").streaks.H1, 1);
});

// ── DB-level beats application-level: a stale app-check can't double-write ────
test("true race: second writer's stale app-check is caught by the ledger create", async () => {
  const db = new FakeFirestore({ "users/U1": userWithHabit() });
  // Writer A reads (sees not-done), and BEFORE it commits, writer B completes
  // fully. A's commit then aborts (stale userRef + ledger now exists) and
  // retries, where it sees the ledger → clean 409. Net: one completion.
  const a = completeHabitTransactional(db, "U1", "H1", new Date());
  let bDone = false;
  const aWithRace = db.runTransaction; // (kept for clarity; A uses default path)
  // Drive B inside A's beforeCommit hook by re-invoking the transactional fn.
  const aResult = await db.runTransaction(async (tx) => {
    const userRef = db.doc("users/U1");
    const snap = await tx.get(userRef);
    const state = snap.data();
    const ledgerRef = db.doc(`users/U1/completionKeys/${habitLedgerId("H1", isoToday(state.timezone))}`);
    const lSnap = await tx.get(ledgerRef);
    if (lSnap.exists) return { ok: false, status: 409, alreadyDoneToday: true };
    tx.set(userRef, { ...state, lastCompletions: { ...state.lastCompletions, H1: "x" }, levels: state.levels.map(l => ({ ...l, goals: l.goals.map(g => g.id === "H1" ? { ...g, completions: [...g.completions, 1] } : g) })) });
    tx.create(ledgerRef, { type: "habit" });
    return { ok: true, status: 200 };
  }, {
    beforeCommit: async () => {
      if (!bDone) { bDone = true; await completeHabitTransactional(db, "U1", "H1", new Date()); }
    },
  });
  await a.catch(() => {});

  assert.equal(db.user("U1").levels[0].goals[0].completions.length, 1, "still exactly one completion after the race");
  assert.equal(db.ledgerKeys("U1").length, 1);
  // A lost the race and came back as a duplicate
  assert.equal(aResult.status, 409);
});

// ── Quest idempotency on (uid, questId) ──────────────────────────────────────
test("concurrent quest completions → exactly one completed, rest 409", async () => {
  const db = new FakeFirestore({
    "users/U2": {
      currentLevelId: "L1",
      levels: [{ id: "L1", goals: [] }],
      quests: [{ id: "Q1", title: "x", dimension: "Physical", xp: 50, status: "active", chapterId: "L1" }],
    },
  });
  const results = await Promise.all(
    Array.from({ length: 10 }, () => completeQuestTransactional(db, "U2", "Q1")),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 409 && r.alreadyCompleted).length, 9);
  assert.equal(db.user("U2").quests[0].status, "completed");
  assert.equal(db.user("U2").quests[0].xpAwarded, false, "XP left pending for client reconcile");
  assert.equal(db.ledgerKeys("U2").length, 1);
  assert.equal(db.auditKeys("U2").length, 1, "one audit row for the quest completion");
});

// helper mirroring tzDayKeyISO for the hand-rolled race transaction above
function isoToday(tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
