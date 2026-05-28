/**
 * Boss challenge evaluation — pure, no React / Firebase.
 *
 * A boss challenge is an OPT-IN per-chapter gate on advancement. A chapter with
 * no `level.boss` (or boss.enabled === false) is never gated: evaluateBoss
 * returns { enabled: false, met: true }, so advancement behaves exactly as it
 * did before this feature existed.
 *
 * When enabled, the default composite criteria are:
 *   1. Habit completion rate ≥ threshold (default 85%) in EACH of the trailing
 *      N completed weeks (default 3). The current in-progress week is excluded
 *      so the gate measures sustained past performance, not a partial week.
 *   2. ≥ `signatureQuestsRequired` (default 1) signature quests completed for
 *      this chapter.
 *
 * Per-week rate = average over the chapter's habits of
 *   min(completions that week, weeklyTarget) / weeklyTarget
 * where weeklyTarget = the habit's frequency (daily = 7).
 */

import { getMonWeekStart } from "../utils.js";
import { DEFAULT_GAMIFICATION_CONFIG } from "../gamification.config.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function weekCompletionRate(habits, weekStart) {
  if (!habits.length) return 0;
  const weekEndMs = weekStart.getTime() + WEEK_MS;
  let sum = 0;
  for (const h of habits) {
    const target = h.frequency || 7;
    const count = (h.completions || []).filter((ts) => {
      const d = new Date(ts).getTime();
      return d >= weekStart.getTime() && d < weekEndMs;
    }).length;
    sum += Math.min(count, target) / target;
  }
  return sum / habits.length;
}

export function evaluateBoss(state, level, config = DEFAULT_GAMIFICATION_CONFIG) {
  const boss = level?.boss;
  if (!boss || boss.enabled === false) {
    return { enabled: false, met: true };
  }

  const num = (v, fb) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
  const rateThreshold = num(boss.habitCompletionRate, config.boss.habitCompletionRate);
  const weeksRequired = num(boss.trailingWeeks, config.boss.trailingWeeks);
  const sigRequired   = num(boss.signatureQuestsRequired, config.boss.signatureQuestsRequired);

  const habits = (level.goals || []).filter((g) => g.type === "habitual");

  const thisWeekStart = getMonWeekStart();
  const weekRates = [];
  let weeksAtTarget = 0;
  for (let i = 1; i <= weeksRequired; i++) {
    const ws = new Date(thisWeekStart.getTime() - i * WEEK_MS);
    const rate = weekCompletionRate(habits, ws);
    weekRates.push(rate);
    if (rate >= rateThreshold) weeksAtTarget++;
  }

  const sigDone = (state?.quests || []).filter(
    (q) => q.signature && q.status === "completed" && q.chapterId === level.id,
  ).length;

  const habitMet = weeksAtTarget >= weeksRequired;
  const sigMet = sigDone >= sigRequired;

  return {
    enabled: true,
    met: habitMet && sigMet,
    rateThreshold,
    weeksRequired,
    weeksAtTarget,
    weekRates,
    sigRequired,
    sigDone,
    habitMet,
    sigMet,
  };
}
