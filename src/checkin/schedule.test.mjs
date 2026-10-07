import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CHECKIN, inReminderWindow, nextCheckin, nextReminderWindow, normalizeSettings, pendingHabits, readSchedule, validSnooze } from './schedule.js';

test('periodic reminders move into tomorrow’s window at closing time', () => {
  const now = new Date(2026, 8, 27, 21, 0).getTime();
  assert.equal(nextCheckin(now, DEFAULT_CHECKIN), new Date(2026, 8, 28, 9, 0).getTime());
  assert.equal(inReminderWindow(new Date(2026, 8, 27, 22).getTime(), DEFAULT_CHECKIN), false);
  assert.equal(inReminderWindow(new Date(2026, 8, 27, 9).getTime(), DEFAULT_CHECKIN), true);
});

test('early morning reminders wait for the opening hour', () => {
  assert.equal(nextCheckin(new Date(2026, 8, 27, 5).getTime(), DEFAULT_CHECKIN), new Date(2026, 8, 27, 9).getTime());
});

test('overdue reminders after waking before opening time wait only until opening', () => {
  assert.equal(nextReminderWindow(new Date(2026, 8, 27, 8).getTime(), DEFAULT_CHECKIN), new Date(2026, 8, 27, 9).getTime());
});

test('future check-ins require at least a minute and cannot drift beyond a day', () => {
  const now = Date.now();
  assert.equal(validSnooze(now, now), false);
  assert.equal(validSnooze(NaN, now), false);
  assert.equal(validSnooze(now + 60_000, now), true);
  assert.equal(validSnooze(now + 86_400_000, now), true);
  assert.equal(validSnooze(now + 86_400_001, now), false);
});

test('reload preserves an active check-in and an explicit snooze', () => {
  const now = Date.now();
  const saved = { settings: DEFAULT_CHECKIN, nextAt: now - 10_000, active: true, explicit: true, snoozes: 3 };
  assert.deepEqual(readSchedule(JSON.stringify(saved), now), { ...saved, commandId: '', commandError: '' });
  assert.equal(readSchedule('{broken', now).nextAt, nextCheckin(now, DEFAULT_CHECKIN));
  assert.equal(readSchedule(JSON.stringify({ nextAt: now + 172_800_000 }), now).nextAt, nextCheckin(now, DEFAULT_CHECKIN));
});

test('invalid settings recover to a nonempty reminder window', () => {
  assert.deepEqual(normalizeSettings({ intervalMinutes: -1, startHour: -5, endHour: 40 }), DEFAULT_CHECKIN);
  assert.equal(normalizeSettings({ startHour: 22, endHour: 10 }).endHour, 23);
});

function state(goals, lastCompletions = {}) {
  return { timezone: 'Asia/Kolkata', currentLevelId: 'level', levels: [{ id: 'level', goals }], lastCompletions };
}
const now = Date.parse('2026-09-27T12:00:00Z');
test('completed habits, met weekly targets, milestones and quit-habits are excluded', () => {
  const data = state([
    { id: 'done', type: 'habitual', frequency: 7 },
    { id: 'daily', type: 'habitual', frequency: 7 },
    { id: 'weekly', type: 'habitual', frequency: 2, completions: [Date.parse('2026-09-22T12:00Z'), Date.parse('2026-09-24T12:00Z')] },
    { id: 'weekly-pending', type: 'habitual', frequency: 3, completions: [Date.parse('2026-09-22T12:00Z')] },
    { id: 'milestone', type: 'milestone' },
    { id: 'quit', type: 'quitHabit' },
  ], { done: 'Sun Sep 27 2026' });
  assert.deepEqual(pendingHabits(data, now).map(g => g.id), ['daily', 'weekly-pending']);
});

test('weekly targets reset at Monday in the account timezone, not UTC', () => {
  const data = state([{ id: 'weekly', type: 'habitual', frequency: 2, completions: [Date.parse('2026-09-22T12:00Z'), Date.parse('2026-09-24T12:00Z')] }]);
  assert.equal(pendingHabits(data, Date.parse('2026-09-27T18:29:00Z')).length, 0);
  assert.equal(pendingHabits(data, Date.parse('2026-09-27T18:31:00Z')).length, 1);
});

test('daily habits become due after account midnight without reloading', () => {
  const data = state([{ id: 'daily', type: 'habitual' }], { daily: 'Sun Sep 27 2026' });
  assert.equal(pendingHabits(data, Date.parse('2026-09-27T18:29:00Z')).length, 0);
  assert.equal(pendingHabits(data, Date.parse('2026-09-27T18:31:00Z')).length, 1);
});

test('duplicate completion timestamps cannot satisfy a multi-day target', () => {
  const timestamp = Date.parse('2026-09-22T12:00Z');
  assert.equal(pendingHabits(state([{ id: 'weekly', type: 'habitual', frequency: 2, completions: [timestamp, timestamp] }]), now).length, 1);
});
