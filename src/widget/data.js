import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase.js';
import { completeWidgetTransaction } from '../checkin/widgetTransaction.js';
import { appendXpAudit } from '../observability/audit.js';
import { addWidgetQuestTransaction, completeWidgetQuestTransaction } from './sideQuest.js';

export async function recordWidgetQuest(uid, questId) {
  const reference = doc(db, 'users', uid);
  const now = Date.now();
  const result = await runTransaction(db, transaction => completeWidgetQuestTransaction(transaction, reference, questId, now));
  if (!result.duplicate) appendXpAudit(uid, { ...result.audit, source: 'widget' });
  return result;
}

export function addWidgetQuest(uid, payload) {
  const reference = doc(db, 'users', uid);
  const id = crypto.randomUUID();
  const now = Date.now();
  return runTransaction(db, transaction => addWidgetQuestTransaction(transaction, reference, payload, id, now));
}

export async function recordWidgetHabit(uid, goalId) {
  const reference = doc(db, 'users', uid);
  const now = Date.now();
  const result = await runTransaction(db, transaction => completeWidgetTransaction(transaction, reference, goalId, now));
  if (!result.duplicate) appendXpAudit(uid, { ...result.audit, source: 'widget' });
  return result;
}
