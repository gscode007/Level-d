import { test } from "node:test";
import assert from "node:assert/strict";

import {
  RANK_ORDER,
  rankRequirements,
  nextRank,
  applyQualifyingLevel,
  levelsToNextRank,
} from "./rank.js";
import { DEFAULT_GAMIFICATION_CONFIG as CFG } from "../gamification.config.js";

test("RANK_ORDER is E→D→C→B→A→S", () => {
  assert.deepEqual(RANK_ORDER, ["E", "D", "C", "B", "A", "S"]);
});

test("rankRequirements falls back to E for unknown rank (never makes user stuck)", () => {
  assert.deepEqual(rankRequirements("ZZ", CFG), CFG.progression.ranks.E);
});

test("nextRank: E→D, A→S, S→null", () => {
  assert.equal(nextRank("E"), "D");
  assert.equal(nextRank("A"), "S");
  assert.equal(nextRank("S"), null);
});

test("applyQualifyingLevel: increments under threshold, no promotion", () => {
  const r = applyQualifyingLevel({ current: "E", qualifyingLevelsAtRank: 0 }, CFG);
  assert.equal(r.current, "E");
  assert.equal(r.qualifyingLevelsAtRank, 1);
  assert.equal(r.promoted, false);
});

test("applyQualifyingLevel: promotes when reaching qualifyingToAdvance", () => {
  // E requires 3 qualifying to advance
  let s = { current: "E", qualifyingLevelsAtRank: 2 };
  const r = applyQualifyingLevel(s, CFG);
  assert.equal(r.current, "D");
  assert.equal(r.qualifyingLevelsAtRank, 0);
  assert.equal(r.promoted, true);
  assert.equal(r.promotedFrom, "E");
});

test("applyQualifyingLevel: rank never drops on repeated calls (no demotion path exists)", () => {
  let s = { current: "C", qualifyingLevelsAtRank: 0 };
  for (let i = 0; i < 20; i++) s = applyQualifyingLevel(s, CFG);
  assert.equal(RANK_ORDER.indexOf(s.current) >= RANK_ORDER.indexOf("C"), true);
});

test("applyQualifyingLevel: S is the ceiling — never promotes past S", () => {
  let s = { current: "S", qualifyingLevelsAtRank: 0 };
  for (let i = 0; i < 50; i++) s = applyQualifyingLevel(s, CFG);
  assert.equal(s.current, "S");
  assert.equal(s.qualifyingLevelsAtRank, 50);
});

test("applyQualifyingLevel: full E→S walk uses the right counts", () => {
  let s = { current: "E", qualifyingLevelsAtRank: 0 };
  // E: 3, D: 3, C: 3, B: 4, A: 5 → 18 qualifying levels to reach S
  for (let i = 0; i < 3; i++) s = applyQualifyingLevel(s, CFG); assert.equal(s.current, "D");
  for (let i = 0; i < 3; i++) s = applyQualifyingLevel(s, CFG); assert.equal(s.current, "C");
  for (let i = 0; i < 3; i++) s = applyQualifyingLevel(s, CFG); assert.equal(s.current, "B");
  for (let i = 0; i < 4; i++) s = applyQualifyingLevel(s, CFG); assert.equal(s.current, "A");
  for (let i = 0; i < 5; i++) s = applyQualifyingLevel(s, CFG); assert.equal(s.current, "S");
});

test("levelsToNextRank: returns remaining count, null at S", () => {
  assert.equal(levelsToNextRank({ current: "E", qualifyingLevelsAtRank: 0 }, CFG), 3);
  assert.equal(levelsToNextRank({ current: "E", qualifyingLevelsAtRank: 2 }, CFG), 1);
  assert.equal(levelsToNextRank({ current: "S", qualifyingLevelsAtRank: 0 }, CFG), null);
});

test("applyQualifyingLevel: handles corrupted rank state by defaulting to E", () => {
  const r = applyQualifyingLevel({ current: "Q", qualifyingLevelsAtRank: -3 }, CFG);
  assert.equal(r.current, "E");
  assert.equal(r.qualifyingLevelsAtRank, 1);
});
