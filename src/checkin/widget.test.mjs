import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeHabit } from './completeHabit.js';
import { completeWidgetTransaction } from './widgetTransaction.js';
import { prepareDashboardWrite } from './dashboardSync.js';
import { tzToday } from '../gamification/time.js';

function fixture() {
  return { timezone: 'Asia/Kolkata', currentLevelId: 'level', levels: [{ id: 'level', goals: [
    { id: 'read', type: 'habitual', category: 'Intellectual', weight: 10, frequency: 7, completions: [] },
    { id: 'walk', type: 'habitual', category: 'Physical', weight: 10, frequency: 7, completions: [] },
  ] }], catScores: {}, catRanks: {}, streaks: {}, lastCompletions: {}, dailyCatXP: {}, widgetRevision: 0 };
}
test('widget awards habit and Resilience XP, records a timestamp, and preserves other habits', () => {
  const state = fixture();
  const original = structuredClone(state);
  const result = completeHabit(state, 'read');
  assert.equal(result.points, 10);
  assert.equal(result.resilience, 5);
  assert.equal(result.patch.catScores.Intellectual, 10);
  assert.equal(result.patch.catScores.Resilience, 5);
  assert.equal(result.patch.streaks.read, 1);
  assert.equal(result.patch.levels[0].goals[0].completions.length, 1);
  assert.deepEqual(result.patch.levels[0].goals[1], original.levels[0].goals[1]);
  assert.deepEqual(state, original);
});
test('widget retry cannot award the same habit twice in a day', () => {
  const state = fixture();
  const first = completeHabit(state, 'read');
  assert.equal(completeHabit({ ...state, ...first.patch }, 'read').duplicate, true);
});
test('widget respects the existing per-category and Resilience XP caps', () => {
  const state = fixture();
  const day = tzToday(state.timezone);
  state.dailyCatXP[day] = { Intellectual: 58, Resilience: 60 };
  const result = completeHabit(state, 'read');
  assert.equal(result.points, 2);
  assert.equal(result.resilience, 0);
});
test('widget transaction reads current progress and increments its revision exactly once', async () => {
  let state = fixture();
  state.catScores.Physical = 25;
  let writes = 0;
  const transaction = {
    get: async () => ({ exists: () => true, data: () => structuredClone(state) }),
    update: (_reference, patch) => { state = { ...state, ...patch }; writes++; },
  };
  await completeWidgetTransaction(transaction, 'user', 'read', Date.now());
  await completeWidgetTransaction(transaction, 'user', 'read', Date.now());
  assert.equal(writes, 1);
  assert.equal(state.widgetRevision, 1);
  assert.equal(state.catScores.Physical, 25);
  assert.equal(state.catScores.Intellectual, 10);
});
test('stale dashboard saves cannot overwrite progress recorded in the widget', () => {
  assert.throws(() => prepareDashboardWrite({ widgetRevision: 2 }, { catScores: {} }, 1), /widget-sync-conflict/);
  assert.equal(prepareDashboardWrite({ widgetRevision: 2 }, { title: 'New title' }, 2).widgetRevision, 2);
  assert.equal(prepareDashboardWrite(undefined, fixture(), 0).widgetRevision, 0);
});
