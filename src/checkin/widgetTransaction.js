import { completeHabit } from './completeHabit.js';
import { applyResilienceDecay } from '../utils.js';

export async function completeWidgetTransaction(transaction, reference, goalId, now) {
  const snapshot = await transaction.get(reference);
  if (!snapshot.exists()) throw new Error('Set up your habits in Level’d first.');
  const raw = snapshot.data();
  const state = { ...raw, ...applyResilienceDecay(raw) };
  const result = completeHabit(state, goalId, {}, now);
  if (!result.duplicate) transaction.update(reference, { ...result.patch, widgetRevision: (state.widgetRevision || 0) + 1 });
  return result;
}
