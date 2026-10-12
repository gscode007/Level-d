import { initAdmin, admin } from '../../src/server/firebaseAdmin.js';
import { ChallengeService } from '../../src/challenges/service.js';
import { ChallengeError } from '../../src/challenges/domain.js';
export const config = { maxDuration: 300 };
export function createHandler({ getDatabase = initAdmin, verifyToken = token => admin.auth().verifyIdToken(token, true), createService = db => new ChallengeService(db) } = {}) {
return async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  try {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token) return res.status(401).json({ error: 'Sign in to use Challenges.' });
    const db = getDatabase();
    let actor;
    try { actor = await verifyToken(token); }
    catch { return res.status(401).json({ error: 'Your session expired. Sign in again.' }); }
    let input;
    try { input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { throw new ChallengeError('Invalid JSON request.'); }
    if (!input || JSON.stringify(input).length > 240000) throw new ChallengeError('Request too large.');
    const service = createService(db);
    const actions = ['list', 'create', 'invitation', 'propose', 'review', 'complete', 'get', 'proof', 'settle', 'history'];
    if (!actions.includes(input.action)) throw new ChallengeError('Unknown challenge action.');
    return res.status(200).json(await service[input.action](actor, input));
  } catch (error) {
    if (!(error instanceof ChallengeError)) console.error('Challenges API:', error.code || error.message);
    return res.status(error.status || 503).json({ error: error instanceof ChallengeError ? error.message : 'Challenges server is unavailable. Check Firebase Admin configuration and retry.' });
  }
};
}
export default createHandler();
