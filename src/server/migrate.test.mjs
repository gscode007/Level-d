import { test } from "node:test";
import assert from "node:assert/strict";

import { migrateUserDoc, collectCompletionLog, stripCompletionLog, migratedAuditId } from "./migrate.js";

// Minimal in-memory Firestore: reads-then-writes within a transaction, commit
// on success. Enough to exercise migrateUserDoc's idempotent move.
class FakeDb {
  constructor(initial = {}) { this.store = new Map(Object.entries(initial)); }
  doc(path) { return { path }; }
  async runTransaction(fn) {
    const writes = [];
    const tx = {
      get: async (ref) => {
        const has = this.store.has(ref.path);
        const v = has ? structuredClone(this.store.get(ref.path)) : undefined;
        return { exists: has, data: () => v };
      },
      set: (ref, data) => writes.push([ref.path, structuredClone(data)]),
    };
    const r = await fn(tx);
    for (const [p, d] of writes) this.store.set(p, d);
    return r;
  }
  keys(prefix) { return [...this.store.keys()].filter((k) => k.startsWith(prefix)); }
  user(uid) { return this.store.get(`users/${uid}`); }
  get(path) { return this.store.get(path); }
}

function userWithLog() {
  return {
    currentLevelId: "L1",
    levels: [{
      id: "L1",
      goals: [{
        id: "h1", type: "habitual", frequency: 7,
        completions: [1000, 2000, 3000],
        completionLog: [
          { ts: 1000, base: 18, streakMultiplier: 1, surgeMultiplier: 1, comebackBonus: 0, applied: 18 },
          { ts: 2000, base: 18, streakMultiplier: 1.2, surgeMultiplier: 1, comebackBonus: 0, applied: 22 },
          { ts: 3000, base: 18, streakMultiplier: 1.2, surgeMultiplier: 1.2, comebackBonus: 4, applied: 30 },
        ],
      }],
    }],
  };
}

test("migrateUserDoc moves completionLog → xpAudit, clears root, leaves completions[]", async () => {
  const db = new FakeDb({ "users/U1": userWithLog() });
  const r = await migrateUserDoc(db, "U1");

  assert.equal(r.moved, 3);
  assert.equal(r.alreadyPresent, 0);

  const audit = db.keys("users/U1/xpAudit/");
  assert.equal(audit.length, 3);
  assert.ok(audit.includes(`users/U1/xpAudit/${migratedAuditId("h1", 2000)}`));

  const goal = db.user("U1").levels[0].goals[0];
  assert.equal("completionLog" in goal, false, "root completionLog cleared");
  assert.deepEqual(goal.completions, [1000, 2000, 3000], "completions untouched");

  // a moved row preserves the breakdown
  const row = db.get(`users/U1/xpAudit/${migratedAuditId("h1", 3000)}`);
  assert.equal(row.source, "migrated");
  assert.equal(row.xp, 30);
  assert.equal(row.breakdown.comebackBonus, 4);
});

test("idempotent: a second run is a no-op (no duplicates, identical state)", async () => {
  const db = new FakeDb({ "users/U1": userWithLog() });
  await migrateUserDoc(db, "U1");
  const afterFirst = structuredClone(db.user("U1"));
  const auditAfterFirst = db.keys("users/U1/xpAudit/").sort();

  const r2 = await migrateUserDoc(db, "U1");
  assert.equal(r2.moved, 0, "second run moves nothing");
  assert.deepEqual(db.user("U1"), afterFirst, "user doc unchanged on re-run");
  assert.deepEqual(db.keys("users/U1/xpAudit/").sort(), auditAfterFirst, "no duplicate audit rows");
});

test("partial prior migration: existing audit rows are detected and skipped", async () => {
  const db = new FakeDb({
    "users/U1": userWithLog(),
    // one entry already migrated by a prior partial run
    [`users/U1/xpAudit/${migratedAuditId("h1", 2000)}`]: { kind: "habit_completion", source: "migrated", goalId: "h1", ts: 2000 },
  });
  const r = await migrateUserDoc(db, "U1");
  assert.equal(r.moved, 2, "only the two not-yet-present entries move");
  assert.equal(r.alreadyPresent, 1);
  assert.equal(db.keys("users/U1/xpAudit/").length, 3, "exactly three rows, no duplicate of the pre-existing one");
  assert.equal("completionLog" in db.user("U1").levels[0].goals[0], false, "root still cleared");
});

test("no completionLog → move nothing (idempotent no-op)", async () => {
  const db = new FakeDb({ "users/U2": { currentLevelId: "L1", levels: [{ id: "L1", goals: [{ id: "h1", type: "habitual", completions: [1] }] }] } });
  const r = await migrateUserDoc(db, "U2");
  assert.deepEqual(r, { moved: 0, alreadyPresent: 0 });
  assert.equal(db.keys("users/U2/xpAudit/").length, 0);
});

test("pure helpers", () => {
  const data = userWithLog();
  assert.equal(collectCompletionLog(data).length, 3);
  const stripped = stripCompletionLog(data.levels);
  assert.equal("completionLog" in stripped[0].goals[0], false);
});
