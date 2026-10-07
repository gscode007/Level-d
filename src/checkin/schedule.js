import { resolveTimeZone, tzDayKeyISO, tzToday } from "../gamification/time.js";

export const DEFAULT_CHECKIN = { enabled: true, intervalMinutes: 120, startHour: 9, endHour: 22 };

export function normalizeSettings(value = {}) {
  const intervalMinutes = [30, 60, 120, 180, 240].includes(value.intervalMinutes) ? value.intervalMinutes : 120;
  const startHour = Number.isInteger(value.startHour) && value.startHour >= 0 && value.startHour <= 22 ? value.startHour : 9;
  const endHour = Number.isInteger(value.endHour) && value.endHour > startHour && value.endHour <= 24 ? value.endHour : Math.max(22, startHour + 1);
  return { enabled: value.enabled !== false, intervalMinutes, startHour, endHour };
}

// Reminder windows follow the device clock; habit days follow the account timezone.
// Construct wall-clock boundaries instead of adding 24 hours across DST changes.
export function nextCheckin(now, settings) {
  const config = normalizeSettings(settings);
  return nextReminderWindow(Number(now) + config.intervalMinutes * 60_000, config);
}

export function nextReminderWindow(now, settings) {
  const config = normalizeSettings(settings);
  const next = new Date(Number(now));
  if (next.getHours() < config.startHour) next.setHours(config.startHour, 0, 0, 0);
  else if (next.getHours() >= config.endHour) {
    next.setDate(next.getDate() + 1);
    next.setHours(config.startHour, 0, 0, 0);
  }
  return next.getTime();
}

export function inReminderWindow(now, settings) {
  const hour = new Date(now).getHours();
  return hour >= settings.startHour && hour < settings.endHour;
}

export function validSnooze(value, now) {
  return Number.isFinite(value) && value >= now + 60_000 && value <= now + 24 * 60 * 60_000;
}

export function pendingHabits(state, now = Date.now()) {
  const level = state?.levels?.find(item => item.id === state.currentLevelId);
  if (!level) return [];
  const timezone = resolveTimeZone(state);
  const today = tzToday(timezone, new Date(now));
  const dayKey = tzDayKeyISO(now, timezone);
  const monday = new Date(`${dayKey}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const weekKey = monday.toISOString().slice(0, 10);
  return (level.goals || []).filter(goal => {
    if (goal.type !== "habitual" || state.lastCompletions?.[goal.id] === today) return false;
    const frequency = goal.frequency || 7;
    if (frequency >= 7) return true;
    const completedDays = new Set((goal.completions || []).map(ts => tzDayKeyISO(ts, timezone))
      .filter(day => day >= weekKey && day <= dayKey));
    return completedDays.size < frequency;
  });
}

export function readSchedule(raw, now = Date.now()) {
  let saved;
  try { saved = JSON.parse(raw || "null"); } catch { /* recover invalid local state */ }
  const settings = normalizeSettings(saved?.settings);
  return {
    settings,
    commandId: typeof saved?.commandId === 'string' ? saved.commandId : '',
    commandError: typeof saved?.commandError === 'string' ? saved.commandError : '',
    nextAt: Number.isFinite(saved?.nextAt) && saved.nextAt > 0 && saved.nextAt <= now + 86_400_000
      ? saved.nextAt : nextCheckin(now, settings),
    active: saved?.active === true && settings.enabled,
    // An explicitly selected time can be outside the periodic reminder window.
    explicit: saved?.explicit === true,
    snoozes: Number.isInteger(saved?.snoozes) && saved.snoozes > 0 ? saved.snoozes : 0,
  };
}
