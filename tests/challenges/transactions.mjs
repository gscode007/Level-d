import assert from 'node:assert/strict';
import { ChallengeService } from '../../src/challenges/service.js';
export async function verifyTransactions(db) {
  let now = Date.parse('2026-10-04T12:00:00Z');
  const service = new ChallengeService(db, () => now);
  const a = { uid: 'transaction-a', email: 'transaction-a@example.com', email_verified: true };
  const b = { uid: 'transaction-b', email: 'transaction-b@example.com', email_verified: true };
  const { id, token } = await service.create(a, { title: 'Transaction probe', email: b.email, timezone: 'UTC', requestId: 'probe' });
  await Promise.all([service.invitation(b, { token, accept: true }), service.invitation(b, { token, accept: true })]);
  await service.propose(a, { id, requestId: 'rules', rules: {
    quests: [{ id: 'weekly', requirement: 'Practice', frequency: 'weekly', target: 4, extra: 6, days: [], assignment: 'owner', surge: 'Double effort', proof: 'none' }],
    missedPunishment: 'Chore', shortfallPunishment: 'Extra chore', rewardBasis: 'days', rewardTarget: 1, reward: 'Movie',
  } });
  await service.review(b, { id, proposalId: 'rules', accept: true });
  for (const day of [5, 6]) {
    now = Date.parse(`2026-10-0${day}T12:00:00Z`);
    const results = await Promise.all(Array.from({ length: 8 }, () => service.complete(a, { id, questId: 'weekly', surge: true })));
    assert.equal(new Set(results.map(r => r.record.id)).size, 1);
  }
  now = Date.parse('2026-10-12T00:00:00Z');
  await Promise.all([service.reconcile(id), service.reconcile(id)]);
  let result = await service.get(a, { id });
  assert.equal(result.weeks[0].participants[0].shortfalls, 2);
  assert.equal(result.obligations.filter(o => o.kind === 'weekly-shortfall').length, 2);
  assert.equal(result.obligations.filter(o => o.kind === 'reward').length, 1);
  assert.equal(result.obligations.filter(o => o.kind === 'missed-day').length, 0);
  const reward = result.obligations.find(o => o.kind === 'reward');
  await service.settle(a, { id, recordId: reward.id }); await service.reconcile(id);
  result = await service.get(a, { id }); assert.ok(result.obligations.find(o => o.id === reward.id).settledAt);
  assert.equal(result.obligations.length, 3);
  const history = await service.history(a, { id, kind: 'completions' }); assert.equal(history.records.length, 2);
  console.log('PASS: Real Firestore concurrent joins/completions/finalization are idempotent; weekly shortfalls, rewards and settled history persist.');
}
