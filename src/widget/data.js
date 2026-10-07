import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase.js';
import { completeWidgetTransaction } from '../checkin/widgetTransaction.js';
import { appendXpAudit } from '../observability/audit.js';

export async function recordWidgetHabit(uid, goalId) {
  const reference = doc(db, 'users', uid);
  const now = Date.now();
  const result = await runTransaction(db, transaction => completeWidgetTransaction(transaction, reference, goalId, now));
  if (!result.duplicate) appendXpAudit(uid, { ...result.audit, source: 'widget' });
  return result;
}
