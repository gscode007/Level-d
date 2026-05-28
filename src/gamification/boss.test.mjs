import { test } from "node:test";
import assert from "node:assert/strict";

import { getMonWeekStart } from "../utils.js";
import { evaluateBoss } from "./boss.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Build N completions inside the i-th completed week back (i = 1 is last week).
function completionsForWeek(i, n) {
  const ws = new Date(getMonWeekStart().getTime() - i * WEEK_MS);
  const out = [];
  for (let d = 0; d < n; d++) out.push(ws.getTime() + d * DAY_MS + 12 * 60 * 60 * 1000);
  return out;
}

const LEVEL_ID = "lvl1";

function levelWith(boss, habitCompletions) {
  return {
    id: LEVEL_ID,
    boss,
    goals: [{ id: "h1", type: "habitual", frequency: 7, completions: habitCompletions }],
  };
}

test("no boss criteria → not gated (enabled false, met true)", () => {
  const r = evaluateBoss({ quests: [] }, { id: LEVEL_ID, goals: [] });
  assert.equal(r.enabled, false);
  assert.equal(r.met, true);
});

test("boss.enabled === false → not gated", () => {
  const r = evaluateBoss({ quests: [] }, { id: LEVEL_ID, boss: { enabled: false }, goals: [] });
  assert.equal(r.enabled, false);
  assert.equal(r.met, true);
});

test("default boss: 3 weeks at >=85% + 1 signature quest → met", () => {
  // 6/7 = 0.857 >= 0.85 in each of the last 3 weeks
  const completions = [...completionsForWeek(1, 6), ...completionsForWeek(2, 6), ...completionsForWeek(3, 6)];
  const level = levelWith({ enabled: true }, completions);
  const state = {
    quests: [{ id: "q1", signature: true, status: "completed", chapterId: LEVEL_ID, dimension: "Physical", xp: 50 }],
  };
  const r = evaluateBoss(state, level);
  assert.equal(r.enabled, true);
  assert.equal(r.weeksAtTarget, 3);
  assert.equal(r.habitMet, true);
  assert.equal(r.sigDone, 1);
  assert.equal(r.sigMet, true);
  assert.equal(r.met, true);
});

test("habit weeks met but no signature quest → not met", () => {
  const completions = [...completionsForWeek(1, 6), ...completionsForWeek(2, 6), ...completionsForWeek(3, 6)];
  const level = levelWith({ enabled: true }, completions);
  const r = evaluateBoss({ quests: [] }, level);
  assert.equal(r.habitMet, true);
  assert.equal(r.sigMet, false);
  assert.equal(r.met, false);
});

test("signature quest present but a week below target → not met", () => {
  // Week 2 only has 3/7 = 0.43 < 0.85
  const completions = [...completionsForWeek(1, 6), ...completionsForWeek(2, 3), ...completionsForWeek(3, 6)];
  const level = levelWith({ enabled: true }, completions);
  const state = {
    quests: [{ id: "q1", signature: true, status: "completed", chapterId: LEVEL_ID, dimension: "Physical", xp: 50 }],
  };
  const r = evaluateBoss(state, level);
  assert.equal(r.weeksAtTarget, 2);
  assert.equal(r.habitMet, false);
  assert.equal(r.met, false);
});

test("signature quest for a DIFFERENT chapter does not count", () => {
  const completions = [...completionsForWeek(1, 6), ...completionsForWeek(2, 6), ...completionsForWeek(3, 6)];
  const level = levelWith({ enabled: true }, completions);
  const state = {
    quests: [{ id: "q1", signature: true, status: "completed", chapterId: "other", dimension: "Physical", xp: 50 }],
  };
  const r = evaluateBoss(state, level);
  assert.equal(r.sigDone, 0);
  assert.equal(r.met, false);
});

test("per-chapter overrides on level.boss take precedence over config defaults", () => {
  // Require only 1 week and 0 signature quests
  const completions = completionsForWeek(1, 7);
  const level = levelWith({ enabled: true, trailingWeeks: 1, signatureQuestsRequired: 0 }, completions);
  const r = evaluateBoss({ quests: [] }, level);
  assert.equal(r.weeksRequired, 1);
  assert.equal(r.sigRequired, 0);
  assert.equal(r.met, true);
});
