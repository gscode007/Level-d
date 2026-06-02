/**
 * Pure rank-progression logic. No React / Firebase / DOM.
 *
 * The progression layer is ADDITIVE and only engages when an arc is active
 * (state.arc?.status === 'active'). Modules in this file know nothing about
 * Firestore — they take plain state objects and return plain results, so the
 * same code runs in the client (src/App.jsx) and the serverless MCP server
 * (api/mcp.js) with identical behavior.
 *
 * Rules (mirror gamification.config.js comment block + the spec):
 *   - Rank ladder: E → D → C → B → A → S. S is the ceiling.
 *   - Rank NEVER drops. A non-qualifying level is a no-op on the counter.
 *   - Every level that ADVANCES is by definition qualifying (both gates met).
 *   - At S, qualifyingToAdvance is Infinity → no auto-promotion. Arc
 *     completion is user-declared via a separate path (complete_arc) once
 *     `consecutiveSRankLevels` qualifying S-rank levels have been cleared.
 */

import { DEFAULT_GAMIFICATION_CONFIG } from "../gamification.config.js";

export const RANK_ORDER = ["E", "D", "C", "B", "A", "S"];

// Returns the per-rank requirements object from config. Falls back to E if an
// unknown rank string is passed, so a corrupted state can never make the user
// unadvanceable — it just behaves as if they're at the start.
export function rankRequirements(rank, config = DEFAULT_GAMIFICATION_CONFIG) {
  const ranks = config.progression?.ranks || DEFAULT_GAMIFICATION_CONFIG.progression.ranks;
  return ranks[rank] || ranks.E;
}

// Returns the next rank, or null at S (ceiling).
export function nextRank(rank) {
  const i = RANK_ORDER.indexOf(rank);
  if (i < 0 || i >= RANK_ORDER.length - 1) return null;
  return RANK_ORDER[i + 1];
}

// Pure rank-counter update on a qualifying level. Input is the current rank
// state { current, qualifyingLevelsAtRank }; output is the post-advance rank
// state plus a `promoted` flag.
//
// Promotion semantics:
//   - Increment qualifyingLevelsAtRank by 1.
//   - If the new count >= qualifyingToAdvance for this rank AND a next rank
//     exists, promote: current = next, qualifyingLevelsAtRank = 0.
//   - At S, qualifyingToAdvance is Infinity → never promotes. The counter
//     keeps climbing so callers can read it for arc-completion gating.
//
// This function NEVER returns a rank earlier in the ladder than the input.
export function applyQualifyingLevel(rankState, config = DEFAULT_GAMIFICATION_CONFIG) {
  const current = rankState?.current && RANK_ORDER.includes(rankState.current)
    ? rankState.current
    : "E";
  const prev = typeof rankState?.qualifyingLevelsAtRank === "number"
    && rankState.qualifyingLevelsAtRank >= 0
    ? rankState.qualifyingLevelsAtRank
    : 0;
  const req = rankRequirements(current, config);
  const incremented = prev + 1;

  const nxt = nextRank(current);
  if (nxt && incremented >= req.qualifyingToAdvance) {
    return {
      current: nxt,
      qualifyingLevelsAtRank: 0,
      promoted: true,
      promotedFrom: current,
    };
  }
  return {
    current,
    qualifyingLevelsAtRank: incremented,
    promoted: false,
  };
}

// How many qualifying levels remain before the next promotion, or null at S.
export function levelsToNextRank(rankState, config = DEFAULT_GAMIFICATION_CONFIG) {
  const current = rankState?.current && RANK_ORDER.includes(rankState.current) ? rankState.current : "E";
  if (!nextRank(current)) return null;
  const req = rankRequirements(current, config);
  const prev = typeof rankState?.qualifyingLevelsAtRank === "number" ? rankState.qualifyingLevelsAtRank : 0;
  return Math.max(0, req.qualifyingToAdvance - prev);
}
