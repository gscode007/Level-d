import crypto from 'node:crypto';
import { initAdmin } from '../../src/server/firebaseAdmin.js';
import { ChallengeService } from '../../src/challenges/service.js';
export const config = { maxDuration: 300 };
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.authorization || '';
  const wanted = `Bearer ${expected}`;
  const suppliedBytes = Buffer.from(supplied); const wantedBytes = Buffer.from(wanted);
  if (!expected || suppliedBytes.length !== wantedBytes.length || !crypto.timingSafeEqual(suppliedBytes, wantedBytes)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const db = initAdmin(); const service = new ChallengeService(db);
    // Durable scan position: every active challenge is visited even when the job
    // cannot process the full collection within a single invocation.
    const checkpoint = db.collection('challengeJobs').doc('reconcile');
    let after = (await checkpoint.get()).data()?.after || null;
    const deadline = Date.now() + 240000; let processed = 0;
    while (Date.now() < deadline) {
      let query = db.collection('challenges').orderBy('__name__').limit(25);
      if (after) query = query.startAfter(after);
      const snap = await query.get();
      if (snap.empty) { await checkpoint.set({ after: null }); break; }
      for (const doc of snap.docs) {
        if (doc.data().status === 'active') await service.reconcile(doc.id);
        after = doc.id; processed++;
        await checkpoint.set({ after });
        if (Date.now() >= deadline) break;
      }
    }
    return res.json({ processed });
  } catch (e) { console.error('Challenge reconciliation:', e.code || e.message); return res.status(503).json({ error: 'Reconciliation failed; the durable cursor will retry.' }); }
}
