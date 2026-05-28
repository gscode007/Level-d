/**
 * The ONE place habit-completion XP is calculated.
 *
 * Stacking rule (decided):
 *   final = round( baseXP * clamp(streakMult * surgeMult, ceiling) ) + comebackBonus
 *
 * - streakMult and surgeMult are multiplicative; their COMBINED product is
 *   clamped to config.combinedMultiplierCeiling.
 * - comebackBonus is additive, applied OUTSIDE and AFTER the multiplicative
 *   stack, and is NOT subject to the ceiling.
 *
 * Pure module: no React / Firebase / DOM. `calcBaseXP` (the template ×
 * difficulty × category formula) is reused unchanged so baseline XP for a
 * habit with no streak / no surge / no comeback is byte-for-byte identical to
 * the original behavior.
 */

import { calcBaseXP } from "../utils.js";
import { DEFAULT_GAMIFICATION_CONFIG } from "../gamification.config.js";

// Base XP for a single habit completion (no streak, no surge, no comeback).
// Mirrors the legacy resolution exactly: template+difficulty → calcBaseXP,
// otherwise the goal's manual weight (default 10).
export function habitBaseXP(goal) {
  if (goal?.template && goal?.difficulty) {
    return calcBaseXP(goal.template, goal.difficulty, goal.category, "habitual");
  }
  return goal?.weight || 10;
}

// Streak → multiplier, from config tiers (sorted descending by `days`).
export function streakMultiplier(streak, config = DEFAULT_GAMIFICATION_CONFIG) {
  const s = streak || 0;
  for (const tier of config.streak.tiers) {
    if (s >= tier.days) return tier.multiplier;
  }
  return config.streak.baseMultiplier;
}

// Surge multiplier: 1.0 for a normal completion; otherwise the habit's own
// surge multiplier (goal.surge.multiplier) or the config default.
export function surgeMultiplier(isSurge, goal, config = DEFAULT_GAMIFICATION_CONFIG) {
  if (!isSurge) return 1.0;
  const m = goal?.surge?.multiplier;
  return typeof m === "number" && m > 0 ? m : config.surge.defaultMultiplier;
}

/**
 * THE central XP calculation. Returns a full breakdown so the UI can explain
 * the number; `total` is the XP to actually award (before the existing daily
 * per-category cap, which the caller still applies).
 */
export function computeHabitXP({
  baseXP,
  streak = 0,
  isSurge = false,
  goal = null,
  isComeback = false,
  config = DEFAULT_GAMIFICATION_CONFIG,
}) {
  const sMult = streakMultiplier(streak, config);
  const surgeMult = surgeMultiplier(isSurge, goal, config);
  const rawCombined = sMult * surgeMult;
  const combined = Math.min(rawCombined, config.combinedMultiplierCeiling);
  const multiplied = Math.round(baseXP * combined);

  const comebackBonus = (isComeback && config.comeback.enabled)
    ? Math.round(baseXP * config.comeback.bonusPct)
    : 0;

  return {
    base: baseXP,
    streakMultiplier: sMult,
    surgeMultiplier: surgeMult,
    combinedMultiplier: combined,
    ceilingApplied: rawCombined > combined,
    comebackBonus,
    total: multiplied + comebackBonus,
  };
}

// Build the persisted per-completion record from a computeHabitXP breakdown.
// These are the write-time "columns" stored on each completion so XP history is
// auditable, while a user's TOTAL XP is always read from the stored catScores
// running totals — never re-aggregated from this log.
export function toCompletionRecord(ts, xpResult, { applied, surge = false }) {
  return {
    ts,
    base: xpResult.base,
    streakMultiplier: xpResult.streakMultiplier,
    surgeMultiplier: xpResult.surgeMultiplier,
    comebackBonus: xpResult.comebackBonus,
    computed: xpResult.total, // pre daily-cap
    applied,                  // actually added to catScores after the daily cap
    surge: !!surge,
  };
}
