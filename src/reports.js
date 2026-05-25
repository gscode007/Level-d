import { getMonWeekStart } from "./utils";

// ── Date range helpers ───────────────────────────────────────────────────────

const DAY_MS = 86400000;

export function dayRange(offset = 0) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offset);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end, label: formatDayLabel(start, offset) };
}

export function weekRange(offset = 0) {
  const start = getMonWeekStart();
  start.setDate(start.getDate() + offset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end, label: formatWeekLabel(start, offset) };
}

export function monthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end, label: formatMonthLabel(start, offset) };
}

function formatDayLabel(d, offset) {
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatWeekLabel(start, offset) {
  if (offset === 0) return "This week";
  if (offset === -1) return "Last week";
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return sameMonth
    ? `${fmt(start)}–${end.getDate()}`
    : `${fmt(start)}–${fmt(end)}`;
}

function formatMonthLabel(d, offset) {
  if (offset === 0) return "This month";
  if (offset === -1) return "Last month";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Report aggregation ──────────────────────────────────────────────────────

export function aggregateRange(state, start, end) {
  const startMs = start.getTime();
  const endMs = end.getTime();

  // XP per category from dailyCatXP map
  const catXP = {};
  for (const [dateStr, cats] of Object.entries(state.dailyCatXP || {})) {
    const d = new Date(dateStr);
    if (d >= start && d < end) {
      for (const [cat, xp] of Object.entries(cats)) {
        catXP[cat] = (catXP[cat] || 0) + xp;
      }
    }
  }

  // Walk every goal across every level once
  let completions = 0;
  let resists = 0;
  let slips = 0;
  const activeDays = new Set();
  const perGoal = {}; // goalId → { goal, level, count }

  for (const lv of state.levels) {
    for (const g of lv.goals || []) {
      if (g.type === "habitual") {
        for (const ts of g.completions || []) {
          if (ts >= startMs && ts < endMs) {
            completions++;
            activeDays.add(new Date(ts).toDateString());
            const key = g.id;
            if (!perGoal[key]) perGoal[key] = { goal: g, level: lv, count: 0 };
            perGoal[key].count++;
          }
        }
      } else if (g.type === "quitHabit") {
        for (const dateStr of g.resistLog || []) {
          const d = new Date(dateStr);
          if (d >= start && d < end) {
            resists++;
            activeDays.add(dateStr);
            const key = g.id;
            if (!perGoal[key]) perGoal[key] = { goal: g, level: lv, count: 0 };
            perGoal[key].count++;
          }
        }
        for (const dateStr of g.succumbLog || []) {
          const d = new Date(dateStr);
          if (d >= start && d < end) slips++;
        }
      }
    }
  }

  const totalXP = Object.values(catXP).reduce((s, v) => s + v, 0);
  const topCat = Object.entries(catXP).sort((a, b) => b[1] - a[1])[0];
  const totalDays = Math.max(1, Math.round((endMs - startMs) / DAY_MS));

  return {
    totalXP,
    catXP,
    topCategory: topCat ? topCat[0] : null,
    completions,
    resists,
    slips,
    activeDays: activeDays.size,
    totalDays,
    perGoal: Object.values(perGoal).sort((a, b) => b.count - a.count),
  };
}

// ── Streak + activity scanning ──────────────────────────────────────────────

function getActiveDates(state) {
  const set = new Set();
  for (const lv of state.levels) {
    for (const g of lv.goals || []) {
      if (g.type === "habitual") {
        for (const ts of g.completions || []) set.add(new Date(ts).toDateString());
      } else if (g.type === "quitHabit") {
        for (const s of g.resistLog || []) set.add(s);
      }
    }
  }
  return set;
}

// Longest consecutive-day run of ANY activity, ever
function longestActiveRun(state) {
  const dates = [...getActiveDates(state)]
    .map(s => { const d = new Date(s); d.setHours(0, 0, 0, 0); return d.getTime(); })
    .sort((a, b) => a - b);
  if (!dates.length) return 0;
  let max = 1, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = Math.round((dates[i] - dates[i - 1]) / DAY_MS);
    if (diff === 1) cur++;
    else if (diff > 1) cur = 1;
    if (cur > max) max = cur;
  }
  return max;
}

// Current consecutive active-day run ending today or yesterday
export function currentActiveRun(state) {
  const set = getActiveDates(state);
  let count = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (!set.has(d.toDateString())) {
    d.setDate(d.getDate() - 1);
    if (!set.has(d.toDateString())) return 0;
  }
  while (set.has(d.toDateString())) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

// Longest single-habit streak ever (daily-frequency habits + quit habits)
function longestHabitStreak(state) {
  let max = 0;
  for (const lv of state.levels) {
    for (const g of lv.goals || []) {
      if (g.type === "habitual" && (g.frequency || 7) === 7) {
        const dayMs = [...new Set((g.completions || []).map(ts => new Date(ts).toDateString()))]
          .map(s => { const d = new Date(s); d.setHours(0, 0, 0, 0); return d.getTime(); })
          .sort((a, b) => a - b);
        if (!dayMs.length) continue;
        let cur = 1, best = 1;
        for (let i = 1; i < dayMs.length; i++) {
          const diff = Math.round((dayMs[i] - dayMs[i - 1]) / DAY_MS);
          if (diff === 1) cur++;
          else cur = 1;
          if (cur > best) best = cur;
        }
        if (best > max) max = best;
      } else if (g.type === "quitHabit") {
        if ((g.bestStreak || 0) > max) max = g.bestStreak;
      }
    }
  }
  return max;
}

// Count Mon–Sun weeks (past, not including current) where every daily habit
// in the current level was completed all 7 days. Habits only count for weeks
// after their first completion.
function countPerfectWeeks(state) {
  const lv = state.levels.find(l => l.id === state.currentLevelId);
  if (!lv) return 0;
  const dailyHabits = (lv.goals || []).filter(g => g.type === "habitual" && (g.frequency || 7) === 7);
  if (!dailyHabits.length) return 0;

  let earliest = Infinity;
  for (const g of dailyHabits) {
    const first = (g.completions || [])[0];
    if (first !== undefined && first < earliest) earliest = first;
  }
  if (earliest === Infinity) return 0;

  const startWeek = getMonWeekStart(new Date(earliest)).getTime();
  const todayWeek = getMonWeekStart(new Date()).getTime();

  let count = 0;
  for (let weekStart = startWeek; weekStart < todayWeek; weekStart += 7 * DAY_MS) {
    const weekEnd = weekStart + 7 * DAY_MS;
    const allHit = dailyHabits.every(g => {
      const first = (g.completions || [])[0];
      if (first === undefined) return false;
      // Habit must have existed by Tuesday of this week to count
      if (first > weekStart + DAY_MS) return false;
      const days = new Set();
      for (const ts of g.completions || []) {
        if (ts >= weekStart && ts < weekEnd) days.add(new Date(ts).toDateString());
      }
      return days.size >= 7;
    });
    if (allHit) count++;
  }
  return count;
}

// Count calendar months (past) where every Mon–Sun week ending in the month
// was a perfect week. Conservative: requires 4 perfect weeks minimum.
function countPerfectMonths(state) {
  const lv = state.levels.find(l => l.id === state.currentLevelId);
  if (!lv) return 0;
  const dailyHabits = (lv.goals || []).filter(g => g.type === "habitual" && (g.frequency || 7) === 7);
  if (!dailyHabits.length) return 0;

  let earliest = Infinity;
  for (const g of dailyHabits) {
    const first = (g.completions || [])[0];
    if (first !== undefined && first < earliest) earliest = first;
  }
  if (earliest === Infinity) return 0;

  const isWeekPerfect = (weekStart) => {
    const weekEnd = weekStart + 7 * DAY_MS;
    return dailyHabits.every(g => {
      const first = (g.completions || [])[0];
      if (first === undefined) return false;
      if (first > weekStart + DAY_MS) return false;
      const days = new Set();
      for (const ts of g.completions || []) {
        if (ts >= weekStart && ts < weekEnd) days.add(new Date(ts).toDateString());
      }
      return days.size >= 7;
    });
  };

  const firstDate = new Date(earliest);
  const now = new Date();
  let count = 0;
  for (let y = firstDate.getFullYear(), m = firstDate.getMonth(); ; m++) {
    if (m > 11) { m = 0; y++; }
    if (y > now.getFullYear() || (y === now.getFullYear() && m >= now.getMonth())) break;
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 1);
    // Collect weeks whose Sunday (last day) falls in this month
    const weeks = [];
    let w = getMonWeekStart(monthStart).getTime();
    while (true) {
      const wEnd = w + 7 * DAY_MS - 1;
      const sun = new Date(wEnd);
      if (sun >= monthEnd) break;
      if (sun >= monthStart) weeks.push(w);
      w += 7 * DAY_MS;
    }
    if (weeks.length >= 4 && weeks.every(isWeekPerfect)) count++;
  }
  return count;
}

// ── Badge definitions ──────────────────────────────────────────────────────

export const BADGES = [
  { id: "streak-3",   group: "Streak",  label: "Spark",       req: 3,   unit: "day streak",         icon: "△",  metric: "longestHabit" },
  { id: "streak-7",   group: "Streak",  label: "Week One",    req: 7,   unit: "day streak",         icon: "◇",  metric: "longestHabit" },
  { id: "streak-14",  group: "Streak",  label: "Forge",       req: 14,  unit: "day streak",         icon: "◈",  metric: "longestHabit" },
  { id: "streak-30",  group: "Streak",  label: "Iron",        req: 30,  unit: "day streak",         icon: "✦",  metric: "longestHabit" },
  { id: "streak-100", group: "Streak",  label: "Diamond",     req: 100, unit: "day streak",         icon: "✧",  metric: "longestHabit" },
  { id: "perfect-week",  group: "Perfect", label: "Perfect Week",  req: 1, unit: "perfect week",  icon: "◉", metric: "perfectWeeks" },
  { id: "perfect-month", group: "Perfect", label: "Perfect Month", req: 1, unit: "perfect month", icon: "◎", metric: "perfectMonths" },
  { id: "nomiss-7",   group: "No Miss", label: "Steady",      req: 7,   unit: "consecutive active days", icon: "○", metric: "longestActive" },
  { id: "nomiss-30",  group: "No Miss", label: "Locked In",   req: 30,  unit: "consecutive active days", icon: "●", metric: "longestActive" },
  { id: "nomiss-90",  group: "No Miss", label: "Unbreakable", req: 90,  unit: "consecutive active days", icon: "◐", metric: "longestActive" },
];

export function computeBadgeMetrics(state) {
  return {
    longestHabit:  longestHabitStreak(state),
    longestActive: longestActiveRun(state),
    perfectWeeks:  countPerfectWeeks(state),
    perfectMonths: countPerfectMonths(state),
  };
}

export function evaluateBadges(state) {
  const metrics = computeBadgeMetrics(state);
  return BADGES.map(b => {
    const value = metrics[b.metric] || 0;
    const earned = value >= b.req;
    const pct = Math.min(100, Math.round((value / b.req) * 100));
    return { ...b, value, earned, pct };
  });
}

// ── Completion-note themes ─────────────────────────────────────────────────

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","in","on","at","to","for","with","from",
  "is","was","were","be","been","being","am","are","i","im","me","my","you",
  "it","its","this","that","these","those","as","by","so","not","no","yes",
  "do","did","done","doing","just","very","too","more","most","much","than",
  "then","there","here","when","while","also","really","still","got","get",
  "had","has","have","up","down","out","off","one","two","felt","feel","feels",
  "was","because","cuz","like","into","day","today","tho","though","kind","sort",
  "okay","ok","fine","good","bad","day","days","didnt","wasnt","cant","dont",
]);

const NOTE_LOOKBACK_MS = 30 * 86400000;

// Returns [{ word, count, sampleNote }] sorted by count desc, limited to topN
export function noteThemes(state, topN = 8) {
  const cutoff = Date.now() - NOTE_LOOKBACK_MS;
  const counts = new Map(); // word → { count, sampleTs, sampleText }
  let totalNotes = 0;

  for (const lv of state.levels || []) {
    for (const g of lv.goals || []) {
      const notes = g.completionNotes || {};
      for (const [tsStr, text] of Object.entries(notes)) {
        const ts = Number(tsStr);
        if (ts < cutoff) continue;
        totalNotes++;
        const words = text.toLowerCase()
          .replace(/[^a-z\s'-]/g, " ")
          .split(/\s+/)
          .filter(w => w.length >= 4 && !STOPWORDS.has(w));
        const seen = new Set();
        for (const w of words) {
          if (seen.has(w)) continue;
          seen.add(w);
          const entry = counts.get(w) || { count: 0, sampleTs: ts, sampleText: text };
          entry.count++;
          if (ts > entry.sampleTs) { entry.sampleTs = ts; entry.sampleText = text; }
          counts.set(w, entry);
        }
      }
    }
  }

  const themes = [...counts.entries()]
    .filter(([_, e]) => e.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, topN)
    .map(([word, e]) => ({ word, count: e.count, sampleText: e.sampleText }));

  return { themes, totalNotes };
}
