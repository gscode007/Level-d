/**
 * SINGLE SOURCE OF TRUTH for every tunable gamification number.
 *
 * Imported by BOTH the client (src/*) and the serverless MCP server
 * (api/mcp.js). Keep it pure — no React / Firebase / DOM imports — so both
 * runtimes can load it.
 *
 * Per-user overrides live in `state.gamificationConfig` and are merged over
 * these defaults by getGamificationConfig(state). Anything not overridden
 * falls back here, so a brand-new user (or a malformed override) always gets
 * sane numbers. No magic numbers live inside the XP / quest / boss logic.
 *
 * ── Tunables & defaults ──────────────────────────────────────────────────
 *  combinedMultiplierCeiling   2.0   clamp on (streakMult * surgeMult)
 *  streak.tiers                7d→1.2, 21d→1.5   streak XP multiplier tiers
 *  streak.baseMultiplier       1.0   below the lowest tier
 *  comeback.enabled            true  never-miss-twice bonus on/off
 *  comeback.bonusPct           0.25  +25% of base XP, additive, ceiling-exempt
 *  surge.defaultMultiplier     1.2   modest kicker (< max streak multiplier)
 *  quests.bands                small 20 / medium 50 / large 120  quest XP
 *  quests.defaultBand          medium
 *  boss.habitCompletionRate    0.85  ≥85% completion over trailing weeks
 *  boss.trailingWeeks          3
 *  boss.signatureQuestsRequired 1    signature quests completed in the chapter
 */

export const DEFAULT_GAMIFICATION_CONFIG = {
  // ── XP stacking ceiling ──────────────────────────────────────────────
  // final_xp = round(baseXP * streakMultiplier * surgeMultiplier), where the
  // COMBINED (streak * surge) multiplier is clamped to this ceiling. The
  // comeback bonus is added AFTER this and is NOT subject to the ceiling.
  combinedMultiplierCeiling: 2.0,

  // ── Streak multiplier (replaces the legacy additive streak bonus) ─────
  // tiers MUST be sorted descending by `days`; the first tier a streak meets
  // wins. Streak is the dominant lever by design — tiers go higher than the
  // surge kicker below.
  streak: {
    tiers: [
      { days: 21, multiplier: 1.5 },
      { days: 7,  multiplier: 1.2 },
    ],
    baseMultiplier: 1.0,
  },

  // ── Never-miss-twice comeback bonus ──────────────────────────────────
  // First completion right after a missed day earns a flat additive award
  // worth this fraction of the habit's base XP. Outside the multiplicative
  // stack, not subject to the ceiling. The return is celebrated.
  comeback: {
    enabled: true,
    bonusPct: 0.25,
  },

  // ── Surge mode ───────────────────────────────────────────────────────
  // A modest kicker, intentionally lower than the max streak multiplier.
  // Per-habit surge variants may override this multiplier.
  surge: {
    defaultMultiplier: 1.2,
  },

  // ── Quest XP bands ───────────────────────────────────────────────────
  // One-off quests award a flat XP from one of these bands. Sized relative to
  // habit XP (~5–36 per completion) and milestone XP (~30–240 total).
  quests: {
    bands: { small: 20, medium: 50, large: 120 },
    defaultBand: "medium",
  },

  // ── Boss challenge defaults ──────────────────────────────────────────
  // OPT-IN per chapter. A chapter with no `boss` field advances exactly as
  // today. When a chapter sets boss criteria, these are the defaults.
  boss: {
    habitCompletionRate: 0.85,
    trailingWeeks: 3,
    signatureQuestsRequired: 1,
  },
};

function num(v, fallback) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

// Deep-merges per-user overrides (state.gamificationConfig) over the defaults.
// Only known keys are read; unknown/invalid keys fall back so a malformed
// override can never break the math.
export function getGamificationConfig(state) {
  const o = state?.gamificationConfig;
  const d = DEFAULT_GAMIFICATION_CONFIG;
  if (!o || typeof o !== "object") return d;
  return {
    combinedMultiplierCeiling: num(o.combinedMultiplierCeiling, d.combinedMultiplierCeiling),
    streak: {
      tiers: Array.isArray(o.streak?.tiers) && o.streak.tiers.length
        ? [...o.streak.tiers].sort((a, b) => b.days - a.days)
        : d.streak.tiers,
      baseMultiplier: num(o.streak?.baseMultiplier, d.streak.baseMultiplier),
    },
    comeback: {
      enabled: typeof o.comeback?.enabled === "boolean" ? o.comeback.enabled : d.comeback.enabled,
      bonusPct: num(o.comeback?.bonusPct, d.comeback.bonusPct),
    },
    surge: {
      defaultMultiplier: num(o.surge?.defaultMultiplier, d.surge.defaultMultiplier),
    },
    quests: {
      bands: { ...d.quests.bands, ...(o.quests?.bands && typeof o.quests.bands === "object" ? o.quests.bands : {}) },
      defaultBand: typeof o.quests?.defaultBand === "string" ? o.quests.defaultBand : d.quests.defaultBand,
    },
    boss: {
      habitCompletionRate: num(o.boss?.habitCompletionRate, d.boss.habitCompletionRate),
      trailingWeeks: num(o.boss?.trailingWeeks, d.boss.trailingWeeks),
      signatureQuestsRequired: num(o.boss?.signatureQuestsRequired, d.boss.signatureQuestsRequired),
    },
  };
}
