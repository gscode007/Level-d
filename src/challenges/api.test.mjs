import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../../api/challenges/index.js';
import cron from '../../api/challenges/reconcile.js';
import { ChallengeService } from './service.js';
import { MemoryStore } from '../../tests/challenges/memoryStore.js';
const actor = { uid: 'a', email: 'a@example.com', email_verified: true };
const db = new MemoryStore();
const handler = createHandler({ getDatabase: () => db, verifyToken: async token => { if (token !== 'valid') throw new Error('invalid'); return actor; }, createService: database => new ChallengeService(database) });
function response() { return { headers: {}, code: 200, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; }, end() { return this; } }; }
test('API refuses missing/invalid tokens, unsafe actions and invalid JSON; never caches private responses', async () => {
  for (const headers of [{}, { authorization: 'Bearer invalid' }]) { const res = response(); await handler({ method: 'POST', headers, body: { action: 'list' } }, res); assert.equal(res.code, 401); assert.equal(res.headers['Cache-Control'], 'private, no-store'); }
  for (const body of ['{broken', { action: 'constructor' }, { action: 'reconcile' }]) { const res = response(); await handler({ method: 'POST', headers: { authorization: 'Bearer valid' }, body }, res); assert.equal(res.code, 400); }
  const res = response(); await handler({ method: 'GET', headers: {} }, res); assert.equal(res.code, 405);
});
test('cron refuses all invocations without its configured secret', async () => {
  const old = process.env.CRON_SECRET; delete process.env.CRON_SECRET;
  try { const res = response(); await cron({ method: 'GET', headers: { authorization: 'Bearer undefined' } }, res); assert.equal(res.code, 401); }
  finally { if (old !== undefined) process.env.CRON_SECRET = old; }
});
