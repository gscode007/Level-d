import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRules, dayResult, weekResult, dayAt, weekOf, nextMonday, weeklyStarts, versionAt, completionInput, authorizeProposal, addDays } from './domain.js';
const challenge = { owner: 'a', members: ['a', 'b'], timezone: 'UTC' };
export const quest = (id, overrides = {}) => ({ id, requirement: id, frequency: 'daily', days: [], target: 0, extra: 0, assignment: 'both', surge: 'Double effort', proof: 'none', ...overrides });
export const rules = quests => validateRules({ quests, missedPunishment: 'Chore', shortfallPunishment: 'Extra chore', rewardBasis: 'days', rewardTarget: 1, reward: 'Movie' });
const version = quests => ({ id: 'v1', effective: '2026-10-05', rules: rules(quests) });
const record = (questId, date, surge = false, uid = 'a') => ({ questId, date, surge, uid, versionId: 'v1' });
test('two daily misses remain visible but count as exactly one missed day', () => {
  const day = dayResult(challenge, [version([quest('x'), quest('y')])], '2026-10-06', []);
  assert.equal(day.participants[0].misses.length, 2); assert.equal(day.participants[0].missedDay, true);
});
test('weekly four with two distinct dates yields two shortfalls and zero missed days', () => {
  const versions = [version([quest('w', { frequency: 'weekly', target: 4, extra: 6 })])];
  const records = [record('w', '2026-10-05'), record('w', '2026-10-06')];
  const day = dayResult(challenge, versions, '2026-10-06', records); assert.equal(day.participants[0].missedDay, false);
  const week = weekResult(challenge, versions, '2026-10-05', records, [day]); assert.equal(week.participants[0].shortfalls, 2);
});
test('multiple extra-effort completions yield one surge day only', () => {
  const day = dayResult(challenge, [version([quest('x'), quest('y')])], '2026-10-06', [record('x', '2026-10-06', true), record('y', '2026-10-06', true)]);
  assert.equal(day.participants.filter(p => p.uid === 'a' && p.surgeDay).length, 1);
});
test('another due quest incomplete prevents a surge day', () => {
  const day = dayResult(challenge, [version([quest('x'), quest('y')])], '2026-10-06', [record('x', '2026-10-06', true)]);
  assert.equal(day.participants[0].surgeDay, false);
});
test('six distinct dates produce one weekly quest surge; duplicates cannot inflate it', () => {
  const versions = [version([quest('w', { frequency: 'weekly', target: 4, extra: 6 })])];
  const records = Array.from({ length: 6 }, (_, i) => record('w', addDays('2026-10-05', i)));
  assert.equal(weekResult(challenge, versions, '2026-10-05', records, []).participants[0].weeklySurges, 1);
  assert.equal(weekResult(challenge, versions, '2026-10-05', Array(6).fill(records[0]), []).participants[0].weeklySurges, 0);
});
test('owner-only assignments impose no obligations on partner', () => {
  const versions = [version([quest('d', { assignment: 'owner' }), quest('w', { frequency: 'weekly', target: 4, assignment: 'owner' })])];
  assert.equal(dayResult(challenge, versions, '2026-10-06', []).participants[1].missedDay, false);
  assert.equal(weekResult(challenge, versions, '2026-10-05', [], []).participants[1].shortfalls, 0);
  assert.throws(() => completionInput(challenge, versions, 'b', { questId: 'd' }, Date.parse('2026-10-06T12:00Z')), /not assigned/);
});
test('immutable versions preserve old results and respect Monday effective dates', () => {
  const old = version([quest('x')]); const newer = { id: 'v2', effective: '2026-10-12', rules: rules([quest('y')]) };
  assert.equal(versionAt([old, newer], '2026-10-11').id, 'v1'); assert.equal(versionAt([old, newer], '2026-10-12').id, 'v2');
  assert.equal(dayResult(challenge, [old, newer], '2026-10-11', []).participants[0].misses[0].questId, 'x');
  assert.equal(nextMonday('2026-10-12'), '2026-10-19');
});
test('IANA calendar, DST, and Monday-Sunday boundaries', () => {
  assert.equal(dayAt(Date.parse('2026-10-11T18:29:59Z'), 'Asia/Kolkata'), '2026-10-11');
  assert.equal(dayAt(Date.parse('2026-10-11T18:30:00Z'), 'Asia/Kolkata'), '2026-10-12');
  assert.equal(weekOf('2026-10-11'), '2026-10-05'); assert.equal(weekOf('2026-10-12'), '2026-10-12');
  assert.equal(dayAt(Date.parse('2026-11-01T05:30:00Z'), 'America/New_York'), '2026-11-01');
  assert.equal(dayAt(Date.parse('2026-11-01T06:30:00Z'), 'America/New_York'), '2026-11-01');
});
test('midweek activation skips quota and does not penalize days before activation', () => {
  const v = { ...version([quest('w', { frequency: 'weekly', target: 4 })]), effective: '2026-10-07' };
  assert.equal(weeklyStarts(v), '2026-10-12'); assert.equal(dayResult(challenge, [v], '2026-10-06', []), null);
  assert.equal(weekResult(challenge, [v], '2026-10-05', [], []).participants[0].shortfalls, 0);
});
test('due weekdays and timer/checkin proof are enforced; dates cannot be backdated', () => {
  const versions = [version([quest('x', { frequency: 'weekdays', days: [1], proof: 'checkin' })])];
  assert.throws(() => completionInput(challenge, versions, 'a', { questId: 'x' }, Date.parse('2026-10-06T12:00Z')), /not due/);
  assert.throws(() => completionInput(challenge, versions, 'a', { questId: 'x', date: '2026-10-04' }, Date.parse('2026-10-05T12:00Z')), /backdated/);
  assert.throws(() => completionInput(challenge, versions, 'a', { questId: 'x' }, Date.parse('2026-10-05T12:00Z')), /proof/);
});
test('nonparticipants and proposers cannot approve', () => {
  assert.throws(() => authorizeProposal(challenge, { status: 'pending', proposer: 'a' }, 'c'), /participants/);
  assert.throws(() => authorizeProposal(challenge, { status: 'pending', proposer: 'a' }, 'a'), /already counts/);
  assert.throws(() => completionInput(challenge, [version([quest('x')])], 'c', { questId: 'x' }, Date.now()), /participants/);
});
