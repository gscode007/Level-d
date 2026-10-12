import test from 'node:test';
import assert from 'node:assert/strict';
import { addWidgetQuestTransaction, createSideQuest, completeSideQuest, completeWidgetQuestTransaction } from './sideQuest.js';
import { prepareDashboardWrite } from '../checkin/dashboardSync.js';
import { pendingCheckinQuests } from '../checkin/schedule.js';
import { reconcileQuestXP } from '../utils.js';
const fixture = () => ({ setupDone: true, currentLevelId: 'chapter', levels: [{ id: 'chapter', goals: [] }], quests: [{ id: 'existing', status: 'completed' }], catScores: { Physical: 45 }, widgetRevision: 7 });
const payload = { title: '  Ship portfolio  ', dimension: 'Creational', band: 'large', signature: true, chapterLinked: true };

test('widget side quest uses account XP bands and current chapter without awarding XP', async () => {
  let state = fixture();
  state.gamificationConfig = { quests: { bands: { large: 123 } } };
  const quest = createSideQuest(state, payload, 'new', 1000);
  assert.equal(quest.title, 'Ship portfolio');
  assert.equal(quest.chapterId, 'chapter');
  assert.equal(quest.signature, true);
  assert.equal(quest.status, 'active');
  assert.equal(quest.xp, 123);
  const transaction = { get: async () => ({ exists: () => true, data: () => state }), update: (_, patch) => { state = { ...state, ...patch }; } };
  await addWidgetQuestTransaction(transaction, 'user', payload, 'new', 1000);
  assert.equal(state.quests.length, 2);
  assert.deepEqual(state.catScores, { Physical: 45 });
  assert.equal(state.widgetRevision, 8);
  assert.throws(() => prepareDashboardWrite(state, fixture(), 7), /widget-sync-conflict/);
});
test('retrying the same quest operation cannot duplicate the quest or revision', async () => {
  let state = fixture();
  const transaction = { get: async () => ({ exists: () => true, data: () => state }), update: (_, patch) => { state = { ...state, ...patch }; } };
  await addWidgetQuestTransaction(transaction, 'user', payload, 'new', 1000);
  await addWidgetQuestTransaction(transaction, 'user', payload, 'new', 1000);
  assert.equal(state.quests.length, 2);
  assert.equal(state.widgetRevision, 8);
});
test('invalid input and missing chapter cannot create quests; standalone quests remain unlinked', () => {
  assert.throws(() => createSideQuest(fixture(), { ...payload, title: ' ' }, 'new', 1000), /title/);
  assert.throws(() => createSideQuest(fixture(), { ...payload, dimension: 'Resilience' }, 'new', 1000), /dimension/);
  assert.throws(() => createSideQuest({ ...fixture(), levels: [] }, payload, 'new', 1000), /setup/);
  assert.equal(createSideQuest(fixture(), { ...payload, chapterLinked: false }, 'new', 1000).chapterId, null);
});

test('check-ins include current and unlinked side quests after daily quests are done', () => {
  const state = fixture();
  state.quests = [{ id: 'current', chapterId: 'chapter', title: 'Write', status: 'active', dimension: 'Creational' },
    { id: 'unlinked', title: 'Call', status: 'active', dimension: 'Emotional' },
    { id: 'past', chapterId: 'past', status: 'active' }, { id: 'completed', status: 'completed' }];
  assert.deepEqual(pendingCheckinQuests(state).map(quest => quest.id), ['current', 'unlinked']);
  assert.equal(pendingCheckinQuests(state)[0].type, 'sideQuest');
});

test('side quest completion awards flat XP once, updates rank, and survives dashboard reconciliation', async () => {
  let state = fixture();
  state.catScores.Creational = 190;
  state.quests.push(createSideQuest(state, { ...payload, band: 'small' }, 'new', 1000));
  const xp = state.quests[1].xp;
  let writes = 0;
  const transaction = { get: async () => ({ exists: () => true, data: () => state }), update: (_, patch) => { state = { ...state, ...patch }; writes++; } };
  const result = await completeWidgetQuestTransaction(transaction, 'user', 'new', 2000);
  assert.equal(result.audit.kind, 'quest_completion');
  assert.equal(result.audit.xp, xp);
  assert.equal(state.catScores.Creational, 190 + xp);
  assert.equal(state.catRanks.Creational, 'D');
  assert.equal(state.catScores.Physical, 45);
  assert.deepEqual(state.quests[0], { id: 'existing', status: 'completed' });
  assert.equal(state.quests[1].completedAt, 2000);
  assert.equal(state.quests[1].xpAwarded, true);
  assert.equal(reconcileQuestXP(state), null);
  assert.equal((await completeWidgetQuestTransaction(transaction, 'user', 'new', 3000)).duplicate, true);
  assert.equal(writes, 1);
  assert.equal(state.widgetRevision, 8);
  assert.throws(() => prepareDashboardWrite(state, fixture(), 7), /widget-sync-conflict/);
});

test('missing or past chapter quests cannot award XP', () => {
  assert.throws(() => completeSideQuest(fixture(), 'missing'), /no longer exists/);
  const state = fixture();
  state.quests.push({ id: 'past', chapterId: 'old', dimension: 'Physical', status: 'active', xp: 50 });
  assert.throws(() => completeSideQuest(state, 'past'), /different chapter/);
  assert.equal(state.catScores.Physical, 45);
});
