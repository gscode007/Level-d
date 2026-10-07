import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCheckinCommand } from './remoteControl.js';
import { readSchedule } from './schedule.js';
import { prepareDashboardWrite } from './dashboardSync.js';
const now = new Date(2026, 8, 27, 12).getTime();
const schedule = readSchedule(null, now);
test('website settings apply once and survive restart', () => {
  const command = { id: 'one', type: 'settings', settings: { ...schedule.settings, intervalMinutes: 30 } };
  const next = applyCheckinCommand(schedule, command, now);
  assert.equal(next.settings.intervalMinutes, 30);
  assert.equal(next.nextAt, now + 30 * 60000);
  const restored = readSchedule(JSON.stringify(next), now);
  assert.equal(applyCheckinCommand(restored, command, now + 5000), restored);
});
test('website cannot disable or reschedule an active check-in through settings', () => {
  const next = applyCheckinCommand({ ...schedule, active: true }, { id: 'two', type: 'settings', settings: { enabled: false } }, now);
  assert.equal(next.active, true);
  assert.equal(next.settings.enabled, true);
  assert.ok(next.commandError);
});
test('explicit later time resolves active check-in and enables reminders', () => {
  const next = applyCheckinCommand({ ...schedule, active: true }, { id: 'three', type: 'later', until: now + 3600000 }, now);
  assert.equal(next.active, false);
  assert.equal(next.explicit, true);
  assert.equal(next.nextAt, now + 3600000);
});
test('expired queued times cannot dismiss a check-in', () => {
  const next = applyCheckinCommand({ ...schedule, active: true }, { id: 'four', type: 'later', until: now - 1 }, now);
  assert.equal(next.active, true);
  assert.ok(next.commandError);
});
test('dashboard saves preserve latest remote commands and widget status', () => {
  const remote = { checkinControl: { id: 'new' }, checkinStatus: { active: true } };
  const saved = prepareDashboardWrite(remote, { checkinControl: { id: 'old' }, checkinStatus: { active: false }, xp: 5 }, 0);
  assert.deepEqual(saved.checkinControl, remote.checkinControl);
  assert.deepEqual(saved.checkinStatus, remote.checkinStatus);
  assert.equal(saved.xp, 5);
});
