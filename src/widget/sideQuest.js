import { USER_CATEGORIES } from '../constants.js';
import { getGamificationConfig } from '../gamification.config.js';
import { getRank } from '../utils.js';

export function completeSideQuest(state, questId, now = Date.now()) {
  const quest = state.quests?.find(item => item.id === questId);
  if (!quest) throw new Error('This side quest no longer exists.');
  if (quest.status === 'completed') return { duplicate: true };
  if (quest.chapterId && quest.chapterId !== state.currentLevelId) throw new Error('This side quest belongs to a different chapter.');
  if (!USER_CATEGORIES.includes(quest.dimension)) throw new Error('This side quest has an invalid identity dimension.');
  const xp = Number.isFinite(quest.xp) ? Math.max(0, quest.xp) : 0;
  const catScores = { ...state.catScores, [quest.dimension]: (state.catScores?.[quest.dimension] || 0) + xp };
  return { duplicate: false, patch: {
    quests: state.quests.map(item => item.id === questId ? { ...item, status: 'completed', completedAt: now, xpAwarded: true } : item),
    catScores, catRanks: { ...state.catRanks, [quest.dimension]: getRank(catScores[quest.dimension]) },
  }, audit: { kind: 'quest_completion', questId, dimension: quest.dimension, xp } };
}

export async function completeWidgetQuestTransaction(transaction, reference, questId, now) {
  const snapshot = await transaction.get(reference);
  if (!snapshot.exists()) throw new Error('Finish setup in Level’d first.');
  const state = snapshot.data();
  const result = completeSideQuest(state, questId, now);
  if (!result.duplicate) transaction.update(reference, { ...result.patch, widgetRevision: (state.widgetRevision || 0) + 1 });
  return result;
}

export function createSideQuest(state, { title, dimension, band, signature = false, chapterLinked = true }, id, now) {
  if (!title?.trim()) throw new Error('Enter a side quest title.');
  if (!USER_CATEGORIES.includes(dimension)) throw new Error('Choose an identity dimension.');
  const level = state.levels?.find(item => item.id === state.currentLevelId);
  if (!state.setupDone || !level) throw new Error('Finish setup in Level’d first.');
  const config = getGamificationConfig(state);
  const resolvedBand = config.quests.bands[band] !== undefined ? band : config.quests.defaultBand;
  return { id, title: title.trim(), dimension, band: resolvedBand, xp: config.quests.bands[resolvedBand],
    status: 'active', signature: !!signature, chapterId: chapterLinked ? level.id : null, createdAt: now };
}

export async function addWidgetQuestTransaction(transaction, reference, payload, id, now) {
  const snapshot = await transaction.get(reference);
  if (!snapshot.exists()) throw new Error('Finish setup in Level’d first.');
  const state = snapshot.data();
  if (state.quests?.some(quest => quest.id === id)) return;
  const quest = createSideQuest(state, payload, id, now);
  transaction.update(reference, { quests: [...(state.quests || []), quest], widgetRevision: (state.widgetRevision || 0) + 1 });
}
