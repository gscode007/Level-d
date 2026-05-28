import { CATEGORIES, USER_CATEGORIES, RANKS, RANK_THRESHOLDS, HABIT_TEMPLATES, MILESTONE_TEMPLATES, DIFFICULTY_MULTIPLIER, CATEGORY_MODIFIER, INITIAL_EDIT_WINDOW_MS } from "./constants.js";
import { resolveTimeZone, tzToday } from "./gamification/time.js";

export const WEEKLY_CHECKIN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

// Initial-setup goals stay editable for the first 3 days of a level.
// User-added goals (locked === false) are always editable.
export const canEditGoal = (goal, level) => {
  if (!goal || !level) return false;
  if (!goal.locked) return true;
  return Date.now() - (level.startedAt || 0) < INITIAL_EDIT_WINDOW_MS;
};

// Hours remaining in the initial edit window — 0 if expired or non-initial
export const editWindowHoursLeft = (level) => {
  if (!level?.startedAt) return 0;
  const elapsed = Date.now() - level.startedAt;
  return Math.max(0, Math.ceil((INITIAL_EDIT_WINDOW_MS - elapsed) / 3600000));
};

export const getRank = (s) => {
  let r = "E";
  for (const [k, t] of Object.entries(RANK_THRESHOLDS)) if (s >= t) r = k;
  return r;
};

export const getNextThresh = (r) => {
  const i = RANKS.indexOf(r);
  return i >= RANKS.length - 1 ? null : RANK_THRESHOLDS[RANKS[i + 1]];
};

export const getRankPct = (s, r) => {
  const c = RANK_THRESHOLDS[r], n = getNextThresh(r);
  if (!n) return 100;
  return Math.min(100, Math.round(((s - c) / (n - c)) * 100));
};

export const genId = () => Math.random().toString(36).slice(2, 10);

export const todayStr = () => new Date().toDateString();

// Resolves a goal's full identity list. Legacy goals (no identities field) fall
// back to [category]. Primary category always owns XP; extras are visual votes.
export const getGoalIdentities = (goal) =>
  goal?.identities && goal.identities.length > 0 ? goal.identities : [goal?.category].filter(Boolean);

export const getOverallScore = (scores, weights) => {
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  if (!total) return 0;
  // Resilience weight is 0, so it's excluded from the weighted average
  return CATEGORIES.reduce((sum, c) => sum + (scores[c] || 0) * (weights[c] || 0) / total, 0);
};

export const mkLevel = (n = 1) => ({
  id: genId(),
  num: n,
  title: "",
  categoryGoals: Object.fromEntries(CATEGORIES.map((c) => [c, ""])),
  weights: {
    ...Object.fromEntries(USER_CATEGORIES.map((c) => [c, Math.floor(100 / USER_CATEGORIES.length)])),
    Resilience: 0,
  },
  requiredRank: "A",
  goals: [],
  startedAt: Date.now(),
});

export const mkDefault = () => {
  const lv = mkLevel(1);
  return {
    levels: [lv],
    currentLevelId: lv.id,
    catScores: Object.fromEntries(CATEGORIES.map((c) => [c, 0])),
    catRanks: Object.fromEntries(CATEGORIES.map((c) => [c, "E"])),
    streaks: {},
    lastCompletions: {},
    setupDone: false,
    lastHabitDate: null,
    decayAppliedOn: null,
    consecutiveMissed: 0,
    dailyCatXP: {},
    aiAgentEnabled: false,
    lastWeeklyCheckin: null,
    quests: [],
  };
};

// One-off quests award XP when completed. The in-app completion path awards
// immediately; quests completed via the MCP server are marked completed but
// pending (xpAwarded !== true). This pass — run on load — awards that pending
// XP idempotently. It only credits quests for the CURRENT chapter (or unlinked
// quests) so a quest finished in a past chapter is never misattributed; such
// quests are left pending and simply never auto-awarded. Purely additive.
export const reconcileQuestXP = (state) => {
  const quests = state?.quests;
  if (!Array.isArray(quests) || quests.length === 0) return null;
  const currentLevelId = state.currentLevelId;
  const catScores = { ...state.catScores };
  let changed = false;
  const newQuests = quests.map((q) => {
    if (
      q.status === "completed" && !q.xpAwarded &&
      (!q.chapterId || q.chapterId === currentLevelId) &&
      USER_CATEGORIES.includes(q.dimension) && q.xp > 0
    ) {
      catScores[q.dimension] = (catScores[q.dimension] || 0) + q.xp;
      changed = true;
      return { ...q, xpAwarded: true };
    }
    return q;
  });
  if (!changed) return null;
  const catRanks = { ...state.catRanks };
  for (const c of USER_CATEGORIES) catRanks[c] = getRank(catScores[c] || 0);
  return { quests: newQuests, catScores, catRanks };
};

// ── XP Template Engine ────────────────────────────────────────────────────────

export const calcBaseXP = (template, difficulty, category, goalType) => {
  const templates = goalType === "milestone" ? MILESTONE_TEMPLATES : HABIT_TEMPLATES;
  const base = templates[template] ?? (goalType === "milestone" ? 30 : 10);
  const mult = DIFFICULTY_MULTIPLIER[difficulty] ?? 1;
  const mod  = CATEGORY_MODIFIER[category] ?? 1;
  return Math.round(base * mult * mod);
};

export const getDailyCatXP = (dailyCatXP, category, dateStr) =>
  dailyCatXP?.[dateStr]?.[category] || 0;

// ── Weekly frequency helpers ──────────────────────────────────────────────────

// Returns the Date object for Monday 00:00 of the week containing `date`
export const getMonWeekStart = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
};

// Count completions in the current Mon–Sun week
export const getThisWeekCount = (completions) => {
  const weekStart = getMonWeekStart();
  return (completions || []).filter(ts => new Date(ts) >= weekStart).length;
};

// Count completions in the previous Mon–Sun week
export const getPrevWeekCount = (completions) => {
  const thisStart = getMonWeekStart();
  const prevStart = new Date(thisStart);
  prevStart.setDate(prevStart.getDate() - 7);
  return (completions || []).filter(ts => {
    const d = new Date(ts);
    return d >= prevStart && d < thisStart;
  }).length;
};

// ── Weekly check-in ───────────────────────────────────────────────────────────

// Counts habit completions in the last 7 days, distributed across each
// identity the habit votes for (multi-identity habits count for each).
export const getWeeklyVotes = (level) => {
  const cutoff = Date.now() - WEEKLY_CHECKIN_INTERVAL_MS;
  const votes = Object.fromEntries(USER_CATEGORIES.map((c) => [c, 0]));
  for (const g of level?.goals || []) {
    if (g.type !== "habitual") continue;
    const recent = (g.completions || []).filter((ts) => ts >= cutoff).length;
    if (recent === 0) continue;
    const identities = getGoalIdentities(g);
    for (const id of identities) {
      if (votes[id] !== undefined) votes[id] += recent;
    }
  }
  return votes;
};

// True once the user has had a level for 7+ days and either has never done a
// check-in, or it's been ≥7 days since the last one. Skipped during the first
// week of a level so brand-new users aren't asked to reflect on nothing.
export const isCheckinDue = (state, level) => {
  if (!state || !level) return false;
  const last = state.lastWeeklyCheckin ? new Date(state.lastWeeklyCheckin).getTime() : null;
  const started = level.startedAt || Date.now();
  const reference = last || started;
  return Date.now() - reference >= WEEKLY_CHECKIN_INTERVAL_MS;
};

// Applies Resilience decay for any missed days since last habit or last decay check.
// Returns a patch object to merge into state, or null if nothing to apply.
export const applyResilienceDecay = (state) => {
  // Resolve "today" in the user's timezone so it stays coherent with the
  // tz-aware lastHabitDate written on completion.
  const today = tzToday(resolveTimeZone(state));
  const todayDate = new Date(today);
  todayDate.setHours(0, 0, 0, 0);

  if (state.decayAppliedOn === today) return null;

  // Latest known reference point (habit completion or last decay run)
  const candidates = [state.lastHabitDate, state.decayAppliedOn].filter(Boolean);
  if (candidates.length === 0) {
    return { decayAppliedOn: today };
  }
  const lastEvent = candidates.reduce((a, b) => (new Date(a) >= new Date(b) ? a : b));

  const lastEventDate = new Date(lastEvent);
  lastEventDate.setHours(0, 0, 0, 0);
  const daysSince = Math.round((todayDate - lastEventDate) / 86400000);

  if (daysSince <= 1) {
    // Was active or checked yesterday — reset streak if we just completed a habit
    const resetStreak = state.lastHabitDate === lastEvent && daysSince <= 1;
    return { decayAppliedOn: today, consecutiveMissed: resetStreak ? 0 : (state.consecutiveMissed || 0) };
  }

  // daysSince >= 2 → at least one full missed day between lastEvent and today
  const newMissedDays = daysSince - 1;

  // How many of those were already processed
  const alreadyProcessed = (state.consecutiveMissed || 0);
  // If lastEvent was a habit completion, previous consecutive count resets
  const baseConsecutive = state.lastHabitDate === lastEvent ? 0 : alreadyProcessed;
  // Days already decayed since lastEvent
  const daysAlreadyDecayed = state.lastHabitDate === lastEvent ? 0 : alreadyProcessed;
  const newDays = newMissedDays - daysAlreadyDecayed;

  if (newDays <= 0) return { decayAppliedOn: today };

  let totalDecay = 0;
  let consecutive = baseConsecutive + daysAlreadyDecayed;
  for (let i = 0; i < newDays; i++) {
    totalDecay += 2 + consecutive;
    consecutive++;
  }

  const newResScore = Math.max(0, (state.catScores?.Resilience || 0) - totalDecay);

  return {
    catScores: { ...state.catScores, Resilience: newResScore },
    catRanks: { ...state.catRanks, Resilience: getRank(newResScore) },
    consecutiveMissed: consecutive,
    decayAppliedOn: today,
  };
};
