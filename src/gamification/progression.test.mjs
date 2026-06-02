import { test } from "node:test";
import assert from "node:assert/strict";

import { getMonWeekStart } from "../utils.js";
import {
  accumulatedLevelXP,
  xpThresholdFor,
  evaluateGates,
  progressionSummary,
} from "./progression.js";
import { DEFAULT_GAMIFICATION_CONFIG as CFG } from "../gamification.config.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS  = 24 * 60 * 60 * 1000;

// Build N completions inside the i-th completed week back (i = 1 is last week)
function completionsForWeek(i, n) {
  const ws = new Date(getMonWeekStart().getTime() - i * WEEK_MS);
  const out = [];
  for (let d = 0; d < n; d++) out.push(ws.getTime() + d * DAY_MS + 12 * 60 * 60 * 1000);
  return out;
}

const LEVEL_ID = "lv1";

function strongHabitWeeks(weeks, perWeek) {
  const out = [];
  for (let i = 1; i <= weeks; i++) out.push(...completionsForWeek(i, perWeek));
  return out;
}

function levelWithHabit(completions, extras = {}) {
  return {
    id: LEVEL_ID,
    startedAt: Date.now() - 30 * DAY_MS, // 30 days ago
    goals: [{ id: "h1", type: "habitual", frequency: 7, completions, ...extras }],
  };
}

test("accumulatedLevelXP sums catScores for USER_CATEGORIES (excluding Resilience)", () => {
  const state = { catScores: {
    Emotional: 100, Intellectual: 200, Physical: 300, Creational: 400, "Self-Care": 500,
    Resilience: 999, // must be excluded
  }};
  assert.equal(accumulatedLevelXP(state), 1500);
});

test("xpThresholdFor: baseThreshold × rank.xpMult, rounded", () => {
  assert.equal(xpThresholdFor("E", CFG), 1800);
  assert.equal(xpThresholdFor("D", CFG), 1980);
  assert.equal(xpThresholdFor("S", CFG), 3150);
});

test("evaluateGates at E: both gates pass → canAdvance true", () => {
  const state = {
    catScores: { Emotional: 400, Intellectual: 400, Physical: 400, Creational: 400, "Self-Care": 400 }, // 2000 ≥ 1800
    quests: [],
    streaks: {},
  };
  const level = levelWithHabit(strongHabitWeeks(3, 7)); // 7/7 each week → 100%
  const g = evaluateGates(state, level, "E", CFG);
  assert.equal(g.rank, "E");
  assert.equal(g.xp.met, true);
  assert.equal(g.boss.signatureMet, true, "E has signature=none → met");
  assert.equal(g.boss.met, true);
  assert.equal(g.canAdvance, true);
});

test("evaluateGates at E: XP short → no advance, but never throws", () => {
  const state = {
    catScores: { Emotional: 100, Intellectual: 100, Physical: 100, Creational: 100, "Self-Care": 100 }, // 500
    quests: [],
    streaks: {},
  };
  const level = levelWithHabit(strongHabitWeeks(3, 7));
  const g = evaluateGates(state, level, "E", CFG);
  assert.equal(g.xp.met, false);
  assert.equal(g.boss.met, true);
  assert.equal(g.canAdvance, false);
});

test("evaluateGates at E: weak habit weeks → boss fail, never throws", () => {
  const state = {
    catScores: { Emotional: 400, Intellectual: 400, Physical: 400, Creational: 400, "Self-Care": 400 },
    quests: [],
    streaks: {},
  };
  // 4/7 ≈ 57% < 80% → fails Gate 2
  const level = levelWithHabit(strongHabitWeeks(3, 4));
  const g = evaluateGates(state, level, "E", CFG);
  assert.equal(g.xp.met, true);
  assert.equal(g.boss.habitMet, false);
  assert.equal(g.canAdvance, false);
});

test("evaluateGates at D: requires 1 signature quest (any band)", () => {
  // 6/7 ≈ 85.7% ≥ 83% → habit pass
  const habitCompletions = strongHabitWeeks(3, 6);
  const level = levelWithHabit(habitCompletions);
  const baseState = {
    // 2000 ≥ 1980 (D = 1800×1.1)
    catScores: { Emotional: 400, Intellectual: 400, Physical: 400, Creational: 400, "Self-Care": 400 },
    streaks: {},
  };

  // no signature quest → fail
  const fail = evaluateGates({ ...baseState, quests: [] }, level, "D", CFG);
  assert.equal(fail.boss.habitMet, true);
  assert.equal(fail.boss.signatureMet, false);
  assert.equal(fail.canAdvance, false);

  // signature quest of any band → pass
  const pass = evaluateGates({
    ...baseState,
    quests: [{
      id: "q1", signature: true, status: "completed", band: "small",
      chapterId: LEVEL_ID, completedAt: Date.now(),
    }],
  }, level, "D", CFG);
  assert.equal(pass.boss.signatureMet, true);
  assert.equal(pass.canAdvance, true);
});

test("evaluateGates at C: signature quest must be LARGE band specifically", () => {
  const level = levelWithHabit(strongHabitWeeks(3, 7));
  const baseState = {
    catScores: { Emotional: 500, Intellectual: 500, Physical: 500, Creational: 500, "Self-Care": 500 }, // 2500 ≥ 2160
    streaks: {},
  };
  const small = evaluateGates({ ...baseState, quests: [{
    id: "q1", signature: true, status: "completed", band: "small", chapterId: LEVEL_ID, completedAt: Date.now(),
  }]}, level, "C", CFG);
  assert.equal(small.boss.signatureMet, false, "small band doesn't satisfy C");

  const large = evaluateGates({ ...baseState, quests: [{
    id: "q1", signature: true, status: "completed", band: "large", chapterId: LEVEL_ID, completedAt: Date.now(),
  }]}, level, "C", CFG);
  assert.equal(large.boss.signatureMet, true);
});

test("evaluateGates at A: composite (large sig + milestone + 21d streak)", () => {
  const level = {
    id: LEVEL_ID,
    startedAt: Date.now() - 30 * DAY_MS,
    goals: [
      { id: "h1", type: "habitual",  frequency: 7, completions: strongHabitWeeks(4, 7) },
      { id: "m1", type: "milestone", completed: true },
    ],
  };
  const state = {
    // A threshold = 1800×1.5 = 2700
    catScores: { Emotional: 700, Intellectual: 700, Physical: 700, Creational: 700, "Self-Care": 700 }, // 3500
    streaks: { h1: 25 },
    quests: [{ id: "q1", signature: true, status: "completed", band: "large", chapterId: LEVEL_ID, completedAt: Date.now() }],
  };
  const g = evaluateGates(state, level, "A", CFG);
  assert.equal(g.xp.met, true);
  assert.equal(g.boss.habitMet, true);
  assert.equal(g.boss.signatureMet, true);
  assert.equal(g.canAdvance, true);

  // Drop streak below 21 → fails the streakAchieved sub-check
  const noStreak = evaluateGates({ ...state, streaks: { h1: 10 } }, level, "A", CFG);
  assert.equal(noStreak.boss.signatureMet, false);
  assert.equal(noStreak.canAdvance, false);
});

test("evaluateGates at S: surgePct sub-check requires extras.surgeStats", () => {
  const level = {
    id: LEVEL_ID,
    startedAt: Date.now() - 30 * DAY_MS,
    goals: [
      { id: "h1", type: "habitual", frequency: 7, completions: strongHabitWeeks(4, 7) },
      { id: "m1", type: "milestone", completed: true },
    ],
  };
  const baseState = {
    // S threshold = 1800×1.75 = 3150
    catScores: { Emotional: 800, Intellectual: 800, Physical: 800, Creational: 800, "Self-Care": 800 }, // 4000
    streaks: { h1: 25 },
    quests: [{ id: "q1", signature: true, status: "completed", band: "large", chapterId: LEVEL_ID, completedAt: Date.now() }],
  };

  // No surge stats → fail-closed
  const noStats = evaluateGates(baseState, level, "S", CFG);
  assert.equal(noStats.boss.signatureMet, false, "missing surge stats fails closed");

  // Surge below 40% → fail
  const low = evaluateGates(baseState, level, "S", CFG, { surgeStats: { totalCompletions: 100, surgeCompletions: 30 } });
  assert.equal(low.boss.signatureMet, false);

  // Surge at 40% → pass
  const ok = evaluateGates(baseState, level, "S", CFG, { surgeStats: { totalCompletions: 100, surgeCompletions: 40 } });
  assert.equal(ok.boss.signatureMet, true);
  assert.equal(ok.canAdvance, true);
});

test("progressionSummary returns spec shape with arc/rank/level/gates", () => {
  const state = {
    arc: { goal: "Become a strong runner", status: "active", startDate: 123 },
    rank: { current: "E", qualifyingLevelsAtRank: 1 },
    catScores: { Emotional: 400, Intellectual: 400, Physical: 400, Creational: 400, "Self-Care": 400 },
    quests: [],
    streaks: {},
  };
  const level = {
    ...levelWithHabit(strongHabitWeeks(3, 7)),
    displayName: "Level 2",
    rank: "E",
    sequenceInRank: 2,
    sequenceInArc: 2,
  };
  const s = progressionSummary(state, level, CFG);
  assert.equal(s.arc.goal, "Become a strong runner");
  assert.equal(s.rank.current, "E");
  assert.equal(s.rank.qualifyingLevelsAtRank, 1);
  assert.equal(s.rank.levelsToNextRank, 2);
  assert.equal(s.level.displayName, "Level 2");
  assert.equal(s.gates.canAdvance, true);
});
