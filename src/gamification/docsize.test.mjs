import { test } from "node:test";
import assert from "node:assert/strict";

import { estimateDocBytes, FIRESTORE_DOC_LIMIT_BYTES } from "./docsize.js";
import { DEFAULT_GAMIFICATION_CONFIG } from "../gamification.config.js";

// Synthetic "10x volume" user: 20 habits, ~2 years of daily completions each.
function syntheticUser({ withInDocLog }) {
  const goals = [];
  for (let h = 0; h < 20; h++) {
    const completions = [];
    const completionLog = [];
    const base = 1_700_000_000_000;
    for (let i = 0; i < 730; i++) {
      const ts = base + i * 86_400_000 + h;
      completions.push(ts);
      if (withInDocLog) {
        // The old in-doc breakdown record (Layer 0.2 placement).
        completionLog.push({ ts, base: 18, streakMultiplier: 1.2, surgeMultiplier: 1, comebackBonus: 0, computed: 22, applied: 22, surge: false });
      }
    }
    const goal = { id: `h${h}`, name: `Habit ${h}`, type: "habitual", category: "Physical", template: "Intensive", difficulty: "Hard", frequency: 7, completions };
    if (withInDocLog) goal.completionLog = completionLog;
    goals.push(goal);
  }
  return {
    currentLevelId: "L1",
    levels: [{ id: "L1", num: 1, title: "Heavy user", categoryGoals: {}, weights: {}, requiredRank: "A", startedAt: 1_700_000_000_000, goals }],
    catScores: { Physical: 9000 },
    catRanks: { Physical: "S" },
    streaks: {},
    lastCompletions: {},
    quests: [],
  };
}

test("Layer 2 before/after: dropping in-doc completionLog cuts doc size well under the 1MB ceiling", () => {
  const before = estimateDocBytes(syntheticUser({ withInDocLog: true }));
  const after = estimateDocBytes(syntheticUser({ withInDocLog: false }));

  // Evidence values (printed for the HARDENING.md before/after table).
  console.log(`[docsize] 10x-volume user — before (in-doc completionLog): ${before} bytes`);
  console.log(`[docsize] 10x-volume user — after  (xpAudit subcollection): ${after} bytes`);
  console.log(`[docsize] reduction: ${before - after} bytes (${Math.round((1 - after / before) * 100)}%)`);

  assert.ok(after < before, "removing the in-doc log reduces doc size");
  assert.ok(after < FIRESTORE_DOC_LIMIT_BYTES, "after: comfortably under the 1MB ceiling");
  // The breakdown history is unbounded but now lives outside the doc, so the doc
  // grows only with the slim completions[] — the cliff is pushed far out.
  assert.ok(after < 0.5 * FIRESTORE_DOC_LIMIT_BYTES, "after: under half the ceiling at 10x volume");
});

test("estimateDocBytes is a sane UTF-8 byte estimate", () => {
  assert.equal(estimateDocBytes({}), 2); // "{}"
  assert.ok(estimateDocBytes({ a: "x".repeat(1000) }) >= 1000);
});

test("warn threshold sits safely below the hard ceiling", () => {
  assert.ok(DEFAULT_GAMIFICATION_CONFIG.limits.docSizeWarnBytes < FIRESTORE_DOC_LIMIT_BYTES);
});
