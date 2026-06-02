/**
 * Pure progression-gate evaluator. No React / Firebase / DOM.
 *
 * Gate 1 (XP):    accumulated level XP >= baseThreshold × rank.xpMult
 * Gate 2 (Boss):  trailing per-week habit completion rate >= rank.completion
 *                 AND the rank's signature requirement is met
 *                 (skipped sub-check when signature.kind === "none")
 *
 * "Accumulated level XP" = sum of catScores for the user-facing categories.
 * These reset on advance_level today and already include quest XP via
 * reconcileQuestXP, so the per-level accumulator already exists — we just
 * read it. Resilience is excluded because it's auto-managed (decay + comeback)
 * and not part of the progression XP signal.
 */

import { USER_CATEGORIES } from "../constants.js";
import { DEFAULT_GAMIFICATION_CONFIG } from "../gamification.config.js";
import { rankRequirements, levelsToNextRank } from "./rank.js";
import { evaluateBoss } from "./boss.js";

// Per-level XP accumulator. Pure read off state.catScores.
export function accumulatedLevelXP(state) {
  let sum = 0;
  for (const c of USER_CATEGORIES) sum += state?.catScores?.[c] || 0;
  return sum;
}

// XP required to clear Gate 1 at a given rank.
export function xpThresholdFor(rank, config = DEFAULT_GAMIFICATION_CONFIG) {
  const base = config.progression?.baseThreshold ?? DEFAULT_GAMIFICATION_CONFIG.progression.baseThreshold;
  const req  = rankRequirements(rank, config);
  return Math.round(base * req.xpMult);
}

// Evaluate the full dual gate for the user at `rank` in `level`.
//
// Inputs:
//   state — the user state (catScores, streaks, quests, etc.)
//   level — the current level object (goals, startedAt, …)
//   rank  — the rank whose requirements we evaluate against (string E…S)
//   config — gamification config (already merged via getGamificationConfig)
//   extras — optional extras the pure evaluator can't derive on its own,
//            e.g. { surgeStats: { totalCompletions, surgeCompletions } } for
//            the S-rank surgePct signature sub-check. When omitted, any
//            requirement that needs it reports `met: false`.
//
// Returns the spec's progression.gates shape, additionally exposing the
// per-sub-check booleans so the UI can render exactly what's missing.
export function evaluateGates(state, level, rank, config = DEFAULT_GAMIFICATION_CONFIG, extras = {}) {
  const req = rankRequirements(rank, config);

  // ── Gate 1: XP accumulation ──────────────────────────────────────────
  const xpRequired = xpThresholdFor(rank, config);
  const xpCurrent = accumulatedLevelXP(state);
  const xpMet = xpCurrent >= xpRequired;

  // ── Gate 2a: trailing habit completion rate ──────────────────────────
  // Reuse the existing boss evaluator, BUT with a synthetic level whose
  // boss criteria are the rank's. This keeps the trailing-week math in one
  // place (boss.js) and lets per-rank windows/rates flow through unchanged.
  const syntheticLevel = {
    ...level,
    boss: {
      enabled: true,
      habitCompletionRate: req.completion,
      trailingWeeks: req.windowWeeks,
      // We score the signature requirement separately below, so disable the
      // built-in signature sub-check inside evaluateBoss.
      signatureQuestsRequired: 0,
    },
  };
  const boss = evaluateBoss(state, syntheticLevel, config);

  // ── Gate 2b: rank-specific signature requirement ─────────────────────
  const sig = evaluateSignature(state, level, req.signature, extras);

  const bossMet = boss.habitMet && sig.met;

  return {
    rank,
    xp: {
      current: xpCurrent,
      required: xpRequired,
      met: xpMet,
    },
    boss: {
      completionRate: boss.weekRates,        // per-week rates (descending: most recent first)
      requiredRate: req.completion,
      trailingWeeks: req.windowWeeks,
      weeksAtTarget: boss.weeksAtTarget,
      habitMet: boss.habitMet,
      signatureRequirement: sig.requirement,
      signatureProgress: sig.progress,
      signatureMet: sig.met,
      met: bossMet,
    },
    canAdvance: xpMet && bossMet,
  };
}

// ── Signature requirement evaluation ───────────────────────────────────
// Each signature spec is { kind: string, …params }. Unknown kinds report
// not-met (fail-closed) so a config-corruption can't accidentally weaken
// the gate.
function evaluateSignature(state, level, spec, extras) {
  if (!spec || spec.kind === "none") {
    return { requirement: { kind: "none" }, progress: {}, met: true };
  }
  switch (spec.kind) {
    case "signatureQuests":  return evalSignatureQuests(state, level, spec);
    case "milestonesCompleted": return evalMilestonesCompleted(state, level, spec);
    case "streakAchieved":   return evalStreakAchieved(state, level, spec);
    case "surgePct":         return evalSurgePct(state, level, spec, extras);
    case "composite": {
      const parts = (spec.requirements || []).map(s => evaluateSignature(state, level, s, extras));
      return {
        requirement: spec,
        progress: { parts: parts.map(p => ({ requirement: p.requirement, progress: p.progress, met: p.met })) },
        met: parts.length > 0 && parts.every(p => p.met),
      };
    }
    default:
      return { requirement: spec, progress: { error: `unknown signature kind: ${spec.kind}` }, met: false };
  }
}

// ≥ count signature quests, optionally filtered by band, completed since
// level.startedAt and linked to this level.
function evalSignatureQuests(state, level, spec) {
  const count = typeof spec.count === "number" ? spec.count : 1;
  const band  = typeof spec.band  === "string" ? spec.band  : "any";
  const startedAt = level?.startedAt || 0;
  const sigDone = (state?.quests || []).filter(q => {
    if (!q.signature) return false;
    if (q.status !== "completed") return false;
    if (q.chapterId && q.chapterId !== level?.id) return false;
    if ((q.completedAt || 0) < startedAt) return false;
    if (band !== "any" && q.band !== band) return false;
    return true;
  }).length;
  return {
    requirement: spec,
    progress: { done: sigDone, required: count, band },
    met: sigDone >= count,
  };
}

// ≥ count milestone goals in the current level marked completed.
function evalMilestonesCompleted(state, level, spec) {
  const count = typeof spec.count === "number" ? spec.count : 1;
  const done = (level?.goals || []).filter(g => g.type === "milestone" && g.completed === true).length;
  return {
    requirement: spec,
    progress: { done, required: count },
    met: done >= count,
  };
}

// Any current habit streak meets the day threshold.
function evalStreakAchieved(state, level, spec) {
  const days = typeof spec.days === "number" ? spec.days : 21;
  const streaks = state?.streaks || {};
  // Only count streaks for habits that exist in the current level — a stale
  // streak counter from a removed habit shouldn't satisfy the gate.
  const habitIds = new Set((level?.goals || []).filter(g => g.type === "habitual").map(g => g.id));
  let best = 0;
  for (const [id, s] of Object.entries(streaks)) {
    if (!habitIds.has(id)) continue;
    if (typeof s === "number" && s > best) best = s;
  }
  return {
    requirement: spec,
    progress: { best, required: days },
    met: best >= days,
  };
}

// share of in-level habit completions that were surge completions ≥ min.
// Requires extras.surgeStats — without it, report not-met (fail-closed).
function evalSurgePct(state, level, spec, extras) {
  const min = typeof spec.min === "number" ? spec.min : 0.40;
  const stats = extras?.surgeStats;
  if (!stats || typeof stats.totalCompletions !== "number" || stats.totalCompletions <= 0) {
    return {
      requirement: spec,
      progress: { available: false, min },
      met: false,
    };
  }
  const pct = (stats.surgeCompletions || 0) / stats.totalCompletions;
  return {
    requirement: spec,
    progress: { available: true, surgeCompletions: stats.surgeCompletions, totalCompletions: stats.totalCompletions, pct, min },
    met: pct >= min,
  };
}

// Summary helper for the progression surface (identity portrait).
export function progressionSummary(state, level, config = DEFAULT_GAMIFICATION_CONFIG, extras = {}) {
  const arc = state?.arc || null;
  const rankState = state?.rank || { current: "E", qualifyingLevelsAtRank: 0 };
  const gates = evaluateGates(state, level, rankState.current, config, extras);
  return {
    arc: arc ? { goal: arc.goal, status: arc.status, startDate: arc.startDate || null } : null,
    rank: {
      current: rankState.current,
      qualifyingLevelsAtRank: rankState.qualifyingLevelsAtRank,
      levelsToNextRank: levelsToNextRank(rankState, config),
    },
    level: {
      displayName: level?.displayName || null,
      rank: level?.rank || null,
      sequenceInRank: level?.sequenceInRank || null,
      sequenceInArc: level?.sequenceInArc || null,
    },
    gates,
  };
}
