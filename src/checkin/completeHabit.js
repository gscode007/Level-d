import { getGamificationConfig } from '../gamification.config.js';
import { computeHabitXP, habitBaseXP, toCompletionRecord } from '../gamification/xp.js';
import { resolveTimeZone, tzToday, tzYesterday } from '../gamification/time.js';
import { DAILY_XP_CAP } from '../constants.js';
import { getDailyCatXP, getRank, getThisWeekCount, getPrevWeekCount } from '../utils.js';

// Shared by the dashboard and independent widget. No network or UI side effects.
export function completeHabit(state, goalId, options = {}, now = Date.now()) {
  const level = state.levels?.find(item => item.id === state.currentLevelId);
  const goal = level?.goals?.find(item => item.id === goalId);
  if (!goal || goal.type !== 'habitual') throw new Error('This habit is no longer available.');
  const timezone = resolveTimeZone(state);
  const day = tzToday(timezone, new Date(now));
  if (state.lastCompletions?.[goalId] === day) return { duplicate: true };
  const yesterday = tzYesterday(timezone, new Date(now));
  const frequency = goal.frequency || 7;
  const weekly = frequency < 7;
  const completingTarget = weekly && getThisWeekCount(goal.completions || []) + 1 >= frequency;
  const streak = weekly
    ? completingTarget ? (getPrevWeekCount(goal.completions || []) >= frequency ? (state.streaks?.[goalId] || 0) + 1 : 1) : (state.streaks?.[goalId] || 0)
    : state.lastCompletions?.[goalId] === yesterday ? (state.streaks?.[goalId] || 0) + 1 : 1;
  const surge = options.surge === true && !!goal.surge;
  const comeback = !weekly && !!state.lastCompletions?.[goalId] && state.lastCompletions[goalId] !== yesterday;
  const xp = computeHabitXP({ baseXP: habitBaseXP(goal), streak: weekly && !completingTarget ? 0 : streak,
    isSurge: surge, goal, isComeback: comeback, config: getGamificationConfig(state) });
  const categoryToday = getDailyCatXP(state.dailyCatXP, goal.category, day);
  const resilienceToday = getDailyCatXP(state.dailyCatXP, 'Resilience', day);
  const points = Math.max(0, Math.min(xp.total, DAILY_XP_CAP - categoryToday));
  const resilience = Math.max(0, Math.min(5, DAILY_XP_CAP - resilienceToday));
  const scores = { ...state.catScores, [goal.category]: (state.catScores?.[goal.category] || 0) + points,
    Resilience: (state.catScores?.Resilience || 0) + resilience };
  const record = toCompletionRecord(now, xp, { applied: points, surge });
  return {
    duplicate: false, points, resilience, surge, comeback: comeback && xp.comebackBonus > 0, category: goal.category, ts: now,
    patch: {
      levels: state.levels.map(item => item.id !== level.id ? item : { ...item, goals: item.goals.map(habit => habit.id !== goalId ? habit : {
        ...habit, completions: [...(habit.completions || []), now],
      }) }),
      catScores: scores,
      catRanks: { ...state.catRanks, [goal.category]: getRank(scores[goal.category]), Resilience: getRank(scores.Resilience) },
      streaks: { ...state.streaks, [goalId]: streak },
      lastCompletions: { ...state.lastCompletions, [goalId]: day },
      lastHabitDate: day, consecutiveMissed: 0, decayAppliedOn: day,
      dailyCatXP: { ...state.dailyCatXP, [day]: { ...(state.dailyCatXP?.[day] || {}), [goal.category]: categoryToday + points, Resilience: resilienceToday + resilience } },
    },
    audit: { kind: 'habit_completion', goalId, day, streak, xp: points, ts: now,
      breakdown: { base: record.base, streakMultiplier: record.streakMultiplier, surgeMultiplier: record.surgeMultiplier, comebackBonus: record.comebackBonus } },
  };
}
