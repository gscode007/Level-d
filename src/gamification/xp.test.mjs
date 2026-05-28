import { test } from "node:test";
import assert from "node:assert/strict";

import { calcBaseXP } from "../utils.js";
import { DEFAULT_GAMIFICATION_CONFIG, getGamificationConfig } from "../gamification.config.js";
import { computeHabitXP, habitBaseXP, streakMultiplier, surgeMultiplier, toCompletionRecord } from "./xp.js";

const cfg = DEFAULT_GAMIFICATION_CONFIG;

// ── Baseline: no streak, no surge, no comeback must equal calcBaseXP ─────────
test("baseline XP is byte-for-byte calcBaseXP across templates/difficulties/categories", () => {
  const templates = ["Basic", "Standard", "Intensive", "Precision"];
  const difficulties = ["Easy", "Medium", "Hard"];
  const categories = ["Emotional", "Intellectual", "Physical", "Creational", "Self-Care"];
  for (const template of templates) {
    for (const difficulty of difficulties) {
      for (const category of categories) {
        const base = calcBaseXP(template, difficulty, category, "habitual");
        const r = computeHabitXP({ baseXP: base, streak: 0, isSurge: false, isComeback: false });
        assert.equal(r.total, base, `${template}/${difficulty}/${category}`);
        assert.equal(r.comebackBonus, 0);
        assert.equal(r.combinedMultiplier, 1);
      }
    }
  }
});

test("habitBaseXP falls back to weight when no template", () => {
  assert.equal(habitBaseXP({ weight: 17 }), 17);
  assert.equal(habitBaseXP({}), 10);
  assert.equal(
    habitBaseXP({ template: "Standard", difficulty: "Medium", category: "Physical" }),
    calcBaseXP("Standard", "Medium", "Physical", "habitual"),
  );
});

// ── Streak multiplier tiers ──────────────────────────────────────────────────
test("streak multiplier tiers (default 7→1.2, 21→1.5)", () => {
  assert.equal(streakMultiplier(0), 1.0);
  assert.equal(streakMultiplier(6), 1.0);
  assert.equal(streakMultiplier(7), 1.2);
  assert.equal(streakMultiplier(20), 1.2);
  assert.equal(streakMultiplier(21), 1.5);
  assert.equal(streakMultiplier(999), 1.5);
});

test("streak multiplier applied to base XP", () => {
  // base 100, 7d streak → 120
  assert.equal(computeHabitXP({ baseXP: 100, streak: 7 }).total, 120);
  // base 100, 21d streak → 150
  assert.equal(computeHabitXP({ baseXP: 100, streak: 21 }).total, 150);
});

// ── Surge multiplier ─────────────────────────────────────────────────────────
test("surge multiplier defaults to 1.2, honors per-habit override", () => {
  assert.equal(surgeMultiplier(false, null), 1.0);
  assert.equal(surgeMultiplier(true, null), 1.2);
  assert.equal(surgeMultiplier(true, { surge: { multiplier: 1.4 } }), 1.4);
});

test("surge stacks multiplicatively with streak", () => {
  // base 100, 7d streak (1.2) × surge (1.2) = 1.44 → 144
  assert.equal(computeHabitXP({ baseXP: 100, streak: 7, isSurge: true }).total, 144);
});

// ── Ceiling clamp on the COMBINED multiplier ─────────────────────────────────
test("combined multiplier is clamped to the ceiling (2.0)", () => {
  // 21d streak (1.5) × surge 1.4 = 2.1 → clamped to 2.0 → base 100 = 200
  const r = computeHabitXP({
    baseXP: 100,
    streak: 21,
    isSurge: true,
    goal: { surge: { multiplier: 1.4 } },
  });
  assert.equal(r.combinedMultiplier, 2.0);
  assert.equal(r.ceilingApplied, true);
  assert.equal(r.total, 200);
});

test("combined multiplier under the ceiling is not clamped", () => {
  const r = computeHabitXP({ baseXP: 100, streak: 7, isSurge: true }); // 1.44
  assert.equal(r.ceilingApplied, false);
  assert.equal(r.combinedMultiplier, 1.44);
});

// ── Comeback bonus: additive, outside the stack, ceiling-exempt ───────────────
test("comeback adds +25% of base, outside the multiplicative stack", () => {
  // base 100, no streak: 100 + round(0.25*100)=25 → 125
  assert.equal(computeHabitXP({ baseXP: 100, isComeback: true }).total, 125);
});

test("comeback is exempt from the ceiling (added after the clamp)", () => {
  // 21d × surge1.4 clamped to 2.0 → 200, + comeback 25 → 225 (exceeds 2.0×base)
  const r = computeHabitXP({
    baseXP: 100,
    streak: 21,
    isSurge: true,
    goal: { surge: { multiplier: 1.4 } },
    isComeback: true,
  });
  assert.equal(r.combinedMultiplier, 2.0);
  assert.equal(r.comebackBonus, 25);
  assert.equal(r.total, 225);
});

test("comeback disabled via config yields no bonus", () => {
  const disabled = getGamificationConfig({ gamificationConfig: { comeback: { enabled: false } } });
  assert.equal(computeHabitXP({ baseXP: 100, isComeback: true, config: disabled }).total, 100);
});

// ── Config override merge ────────────────────────────────────────────────────
test("getGamificationConfig merges overrides over defaults and keeps tiers sorted", () => {
  const merged = getGamificationConfig({
    gamificationConfig: {
      combinedMultiplierCeiling: 3.0,
      streak: { tiers: [{ days: 7, multiplier: 1.3 }, { days: 30, multiplier: 2.0 }] },
    },
  });
  assert.equal(merged.combinedMultiplierCeiling, 3.0);
  assert.equal(merged.streak.tiers[0].days, 30); // sorted desc
  assert.equal(merged.surge.defaultMultiplier, cfg.surge.defaultMultiplier); // untouched default
  assert.equal(merged.comeback.bonusPct, cfg.comeback.bonusPct);
});

// ── Write-time completion record (Layer 0.2) ─────────────────────────────────
test("toCompletionRecord persists every XP breakdown field at write time", () => {
  const r = computeHabitXP({ baseXP: 100, streak: 21, isSurge: true, goal: { surge: { multiplier: 1.3 } }, isComeback: true });
  const rec = toCompletionRecord(1234567890, r, { applied: 60, surge: true });
  assert.equal(rec.ts, 1234567890);
  assert.equal(rec.base, 100);
  assert.equal(rec.streakMultiplier, 1.5);
  assert.equal(rec.surgeMultiplier, 1.3);
  assert.equal(rec.comebackBonus, 25);
  assert.equal(rec.computed, r.total); // pre-cap
  assert.equal(rec.applied, 60);       // post daily-cap
  assert.equal(rec.surge, true);
});

test("getGamificationConfig ignores malformed override and returns defaults", () => {
  assert.equal(getGamificationConfig({}), cfg);
  assert.equal(getGamificationConfig(null), cfg);
  assert.equal(getGamificationConfig({ gamificationConfig: "nope" }), cfg);
});
