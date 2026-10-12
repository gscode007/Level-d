import test from 'node:test';
import assert from 'node:assert/strict';
import { ChallengeService, validatePhoto } from './service.js';
import { MemoryStore } from '../../tests/challenges/memoryStore.js';
import { versionAt } from './domain.js';
const a = { uid: 'alice', email: 'alice@example.com', email_verified: true, name: 'Alice' };
const b = { uid: 'bob', email: 'bob@example.com', email_verified: true, name: 'Bob' };
const outsider = { uid: 'eve', email: 'eve@example.com', email_verified: true };
const q = (id, more = {}) => ({ id, requirement: id, frequency: 'daily', days: [], assignment: 'both', surge: 'Double effort', proof: 'none', ...more });
const rules = quests => ({ quests, missedPunishment: 'Chore', shortfallPunishment: 'Extra chore', rewardBasis: 'days', rewardTarget: 1, reward: 'Movie' });
async function setup(quests = [q('x')], initial = '2026-10-04T12:00:00Z') {
  let now = Date.parse(initial); const db = new MemoryStore(); const service = new ChallengeService(db, () => now);
  const created = await service.create(a, { title: 'Together', email: b.email, timezone: 'UTC', requestId: 'create1' });
  await service.invitation(b, { token: created.token, accept: true });
  await service.propose(a, { id: created.id, requestId: 'initial', rules: rules(quests) });
  await service.review(b, { id: created.id, proposalId: 'initial', accept: true });
  return { db, service, id: created.id, token: created.token, setTime: date => { now = Date.parse(date); } };
}
test('two-account workflow, email-bound private invitations, third-person access denied', async () => {
  const db = new MemoryStore(); const service = new ChallengeService(db, () => Date.parse('2026-10-04T12:00Z'));
  const input = { title: 'Secret quest', email: b.email, timezone: 'UTC', requestId: 'create1' };
  const [one, retry] = await Promise.all([service.create(a, input), service.create(a, input)]);
  assert.deepEqual(one, retry);
  assert.equal((await service.list(outsider)).challenges.length, 0);
  const invites = (await service.list(b)).invites; assert.equal(invites.length, 1); assert.equal(invites[0].title, undefined);
  const invite = await service.invitation(b, { token: one.token }); assert.equal(invite.rules, undefined); assert.equal(invite.title, undefined);
  await assert.rejects(service.invitation(outsider, { token: one.token, accept: true }), /another email/);
  await assert.rejects(service.invitation({ ...b, email_verified: false }, { token: one.token, accept: true }), /verified/);
  await assert.rejects(service.get(b, { id: one.id }), /participants/);
  await Promise.all([service.invitation(b, { token: one.token, accept: true }), service.invitation(b, { token: one.token, accept: true })]);
  assert.deepEqual((await service.get(a, { id: one.id })).challenge.members, [a.uid, b.uid]);
  const sameEmailThird = { ...b, uid: 'third' };
  await assert.rejects(service.invitation(sameEmailThird, { token: one.token, accept: true }), /already redeemed/);
  for (const action of ['get', 'proof', 'complete', 'propose', 'settle', 'history']) await assert.rejects(service[action](outsider, { id: one.id, rules: rules([q('x')]), requestId: 'outsider', recordId: 'record', kind: 'days' }), /participants/);
});
test('expired and declined invitations cannot be redeemed', async () => {
  const db = new MemoryStore(); let now = Date.parse('2026-10-01T00:00Z'); const service = new ChallengeService(db, () => now);
  const expired = await service.create(a, { title: 'X', email: b.email, timezone: 'UTC', requestId: 'x' });
  now += 7 * 86400000;
  await assert.rejects(service.invitation(b, { token: expired.token, accept: true }), /expired/);
  const declined = await service.create(a, { title: 'Y', email: b.email, timezone: 'UTC', requestId: 'y' });
  await service.invitation(b, { token: declined.token, accept: false });
  await assert.rejects(service.invitation(b, { token: declined.token, accept: true }), /declined/);
});
test('proposer approval, rejection, pending isolation and immutable Monday activation', async () => {
  const { service, id, setTime } = await setup();
  setTime('2026-10-06T12:00Z');
  await service.propose(a, { id, requestId: 'change1', rules: rules([q('y')]) });
  assert.equal(versionAt((await service.get(b, { id })).versions, '2026-10-06').rules.quests[0].id, 'x');
  await assert.rejects(service.review(a, { id, proposalId: 'change1', accept: true }), /already counts/);
  await assert.rejects(service.review(outsider, { id, proposalId: 'change1', accept: true }), /participants/);
  await service.review(b, { id, proposalId: 'change1', accept: false });
  await service.propose(b, { id, requestId: 'change2', rules: rules([q('z')]) });
  assert.deepEqual(await service.review(a, { id, proposalId: 'change2', accept: true }), { effective: '2026-10-12' });
  await service.review(a, { id, proposalId: 'change2', accept: true });
  let result = await service.get(b, { id }); assert.equal(result.versions.length, 2);
  assert.equal(versionAt(result.versions, '2026-10-11').rules.quests[0].id, 'x');
  setTime('2026-10-12T00:00Z'); result = await service.get(b, { id }); assert.equal(versionAt(result.versions, result.today).rules.quests[0].id, 'z');
  assert.ok(result.days.find(d => d.date === '2026-10-06').participants[0].misses.some(m => m.questId === 'x'));
});
test('concurrent duplicate completions cannot inflate weekly quota; finalization and settlement are idempotent', async () => {
  const { db, service, id, setTime } = await setup([q('w', { frequency: 'weekly', target: 4, extra: 6, assignment: 'owner' })]);
  for (const date of ['2026-10-05', '2026-10-06']) {
    setTime(`${date}T12:00Z`);
    await Promise.all(Array.from({ length: 8 }, () => service.complete(a, { id, questId: 'w', surge: true })));
  }
  setTime('2026-10-12T00:00Z'); await Promise.all([service.reconcile(id), service.reconcile(id)]);
  const result = await service.get(a, { id });
  assert.equal((await db.collection('challenges').doc(id).collection('completions').get()).size, 2);
  const week = result.weeks.find(w => w.week === '2026-10-05'); assert.equal(week.participants[0].shortfalls, 2); assert.equal(week.participants[1].shortfalls, 0);
  assert.equal(result.obligations.filter(o => o.kind === 'missed-day').length, 0);
  assert.equal(result.obligations.filter(o => o.kind === 'weekly-shortfall').length, 2);
  assert.equal(result.obligations.filter(o => o.kind === 'reward').length, 1);
  const obligation = result.obligations[0]; await assert.rejects(service.settle(b, { id, recordId: obligation.id }), /own commitments/);
  await service.settle(a, { id, recordId: obligation.id }); const stamp = (await service.get(a, { id })).obligations.find(o => o.id === obligation.id).settledAt;
  setTime('2026-10-12T01:00Z'); await service.settle(a, { id, recordId: obligation.id }); await service.reconcile(id);
  const after = await service.get(a, { id }); assert.equal(after.obligations.length, result.obligations.length); assert.equal(after.obligations.find(o => o.id === obligation.id).settledAt, stamp);
  await assert.rejects(service.complete(a, { id, questId: 'w', date: '2026-10-06' }), /backdated/);
});
test('two misses generate one punishment per person and retain both quest misses', async () => {
  const { service, id, setTime } = await setup([q('x'), q('y')], '2026-10-05T12:00Z');
  setTime('2026-10-06T00:00Z'); const result = await service.get(a, { id });
  assert.equal(result.days[0].participants[0].misses.length, 2); assert.equal(result.obligations.length, 2);
});
test('six dates meet weekly extra frequency and earn one weekly-basis reward', async () => {
  const { service, id, setTime } = await setup([q('w', { frequency: 'weekly', target: 4, extra: 6 })]);
  const ref = service.ref(id); const v = (await ref.collection('versions').doc('initial').get()).data();
  await ref.collection('versions').doc('initial').set({ ...v, rules: { ...v.rules, rewardBasis: 'weekly', rewardTarget: 1 } });
  for (let i = 5; i <= 10; i++) { setTime(`2026-10-${String(i).padStart(2, '0')}T12:00Z`); await service.complete(a, { id, questId: 'w' }); }
  setTime('2026-10-12T00:00Z'); let result = await service.get(a, { id });
  assert.equal(result.weeks[0].participants[0].weeklySurges, 1); assert.equal(result.weeks[0].participants[0].surgeDays, 0);
  assert.equal(result.obligations.filter(o => o.uid === a.uid && o.kind === 'reward').length, 1);
  await service.reconcile(id); result = await service.get(a, { id }); assert.equal(result.obligations.filter(o => o.uid === a.uid && o.kind === 'reward').length, 1);
});
test('private photo access and proof validation', async () => {
  const { service, id } = await setup([q('photo', { proof: 'photo' })]);
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=';
  const { record } = await service.complete(a, { id, questId: 'photo', proof: { type: 'photo', image } });
  assert.equal((await service.proof(b, { id, recordId: record.id })).image, image);
  await assert.rejects(service.proof(outsider, { id, recordId: record.id }), /participants/);
  assert.throws(() => validatePhoto({ image: 'data:image/png;base64,ZmFrZQ==' }), /Invalid image/);
  assert.throws(() => validatePhoto({ image: 'data:image/svg+xml;base64,ZmFrZQ==' }), /PNG/);
});
