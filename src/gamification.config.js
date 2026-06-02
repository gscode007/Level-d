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
 *
 *  ── Arc / Rank / Level progression (additive layer) ─────────────────────
 *  progression.baseThreshold   1800  XP a strong performer earns in ~3 weeks
 *                                    (see ranks[R].xpMult for per-rank scaling)
 *  progression.ranks           per-rank dual-gate requirements (XP mult,
 *                              completion rate, trailing window, signature
 *                              requirement, qualifying levels to advance)
 *  progression.arcCompletion   how many consecutive S-rank qualifying levels
 *                              must be cleared before the user may declare
 *                              the arc complete
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

  // ── Infrastructure limits (Layer 2 / Layer 3) ────────────────────────
  limits: {
    // Firestore hard-caps a document at 1,048,576 bytes. Warn well before that
    // so we can act before the user's single state doc becomes unwritable.
    docSizeWarnBytes: 800000,
    // Layer 3: per-user completion rate limit (sliding window).
    rateLimit: { completionsPerMinute: 30 },
  },

  // ── Arc / Rank / Level progression ───────────────────────────────────
  // Additive layer ON TOP of the existing chapter system. Inactive by default;
  // engaged when the user calls `start_arc`. While inactive, advance_level
  // behaves exactly as before (the legacy single-gate path).
  //
  // baseThreshold is the XP a "strong performer" can earn in ~3 weeks at rank
  // E (5 daily Standard×Medium habits ≈ 17 XP/completion × 105 completions ≈
  // 1785 raw, ~1900 with streak ramp). Per-rank XP gate = baseThreshold × xpMult.
  //
  // Each rank object defines:
  //   xpMult       — multiplier on baseThreshold for the level XP gate
  //   completion   — min trailing per-week habit completion rate
  //   windowWeeks  — number of trailing FULL weeks evaluated (natural floor on
  //                  how short a level can be at this rank)
  //   signature    — extra signature requirement spec; { kind: "none" } means
  //                  Gate-2 skips the signature sub-check
  //   qualifyingToAdvance — qualifying levels at this rank required to promote
  //                          to the next rank. S has no auto-advance (Infinity).
  //
  // Signature spec kinds (extensible):
  //   { kind: "none" }
  //   { kind: "signatureQuests", count: N, band: "any"|"small"|"medium"|"large" }
  //   { kind: "composite", requirements: [...subspecs] }
  //   { kind: "milestonesCompleted", count: N }
  //   { kind: "streakAchieved", days: 21 }
  //   { kind: "surgePct", min: 0.40 } — share of in-level habit completions that
  //                                     were surge completions
  //
  // Rank rules enforced in code (src/gamification/rank.js):
  //   - Rank NEVER drops. Non-qualifying level => no change to rank/counter.
  //   - Every level that ADVANCES is by definition qualifying (both gates met).
  //   - S is the ceiling. arcCompletion.consecutiveSRankLevels gates user-
  //     declared arc completion; no auto-promotion past S.
  progression: {
    baseThreshold: 1800,
    ranks: {
      E: {
        xpMult: 1.0,  completion: 0.80, windowWeeks: 3,
        signature: { kind: "none" },
        qualifyingToAdvance: 3,
      },
      D: {
        xpMult: 1.1,  completion: 0.83, windowWeeks: 3,
        signature: { kind: "signatureQuests", count: 1, band: "any" },
        qualifyingToAdvance: 3,
      },
      C: {
        xpMult: 1.2,  completion: 0.85, windowWeeks: 3,
        signature: { kind: "signatureQuests", count: 1, band: "large" },
        qualifyingToAdvance: 3,
      },
      B: {
        xpMult: 1.3,  completion: 0.88, windowWeeks: 4,
        signature: { kind: "composite", requirements: [
          { kind: "signatureQuests", count: 1, band: "large" },
          { kind: "milestonesCompleted", count: 1 },
        ]},
        qualifyingToAdvance: 4,
      },
      A: {
        xpMult: 1.5,  completion: 0.90, windowWeeks: 4,
        signature: { kind: "composite", requirements: [
          { kind: "signatureQuests", count: 1, band: "large" },
          { kind: "milestonesCompleted", count: 1 },
          { kind: "streakAchieved", days: 21 },
        ]},
        qualifyingToAdvance: 5,
      },
      S: {
        xpMult: 1.75, completion: 0.92, windowWeeks: 4,
        signature: { kind: "composite", requirements: [
          { kind: "signatureQuests", count: 1, band: "large" },
          { kind: "milestonesCompleted", count: 1 },
          { kind: "streakAchieved", days: 21 },
          { kind: "surgePct", min: 0.40 },
        ]},
        // Infinity → never auto-advance. Arc completion is user-declared.
        qualifyingToAdvance: Infinity,
      },
    },
    arcCompletion: {
      consecutiveSRankLevels: 3,
    },
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
    limits: {
      docSizeWarnBytes: num(o.limits?.docSizeWarnBytes, d.limits.docSizeWarnBytes),
      rateLimit: {
        completionsPerMinute: num(o.limits?.rateLimit?.completionsPerMinute, d.limits.rateLimit.completionsPerMinute),
      },
    },
    // Progression overrides are merged shallowly per-rank. Unknown rank keys
    // fall back to defaults so a malformed override cannot break gate math or
    // make the user unadvanceable.
    progression: {
      baseThreshold: num(o.progression?.baseThreshold, d.progression.baseThreshold),
      ranks: Object.fromEntries(
        Object.entries(d.progression.ranks).map(([rk, def]) => {
          const ov = o.progression?.ranks?.[rk] || {};
          return [rk, {
            xpMult:      num(ov.xpMult,      def.xpMult),
            completion:  num(ov.completion,  def.completion),
            windowWeeks: num(ov.windowWeeks, def.windowWeeks),
            // Signature spec is taken whole or not at all — partial merges
            // would silently weaken the gate. Validate shape minimally.
            signature: (ov.signature && typeof ov.signature === "object" && typeof ov.signature.kind === "string")
              ? ov.signature
              : def.signature,
            qualifyingToAdvance: typeof ov.qualifyingToAdvance === "number" && ov.qualifyingToAdvance > 0
              ? ov.qualifyingToAdvance
              : def.qualifyingToAdvance,
          }];
        })
      ),
      arcCompletion: {
        consecutiveSRankLevels: num(
          o.progression?.arcCompletion?.consecutiveSRankLevels,
          d.progression.arcCompletion.consecutiveSRankLevels,
        ),
      },
    },
  };
}
