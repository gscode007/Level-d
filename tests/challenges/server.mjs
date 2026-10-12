// Run only through Firebase emulators with project demo-leveld-challenges.
// This serves the production API and real UI; nothing accesses a live project.
import { createServer } from 'vite';
import admin from 'firebase-admin';
import { createHandler } from '../../api/challenges/index.js';
import { ChallengeService } from '../../src/challenges/service.js';
export async function startFixture() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Both Firebase emulators are required.');
  const projectId = 'demo-leveld-challenges';
  if (!admin.apps.length) admin.initializeApp({ projectId });
  for (const name of ['alice', 'bob', 'eve']) {
    try { await admin.auth().createUser({ uid: name, email: `${name}@example.com`, emailVerified: true, displayName: name[0].toUpperCase() + name.slice(1), password: 'ChallengeTest123!' }); }
    catch (e) { if (e.code !== 'auth/uid-already-exists') throw e; }
  }
  let now = Date.parse('2026-10-04T12:00:00Z');
  process.env.VITE_FIREBASE_PROJECT_ID = projectId; process.env.VITE_FIREBASE_API_KEY = 'fake-api-key'; process.env.VITE_FIREBASE_AUTH_DOMAIN = `${projectId}.firebaseapp.com`; process.env.VITE_FIREBASE_APP_ID = 'test-challenges';
  const db = admin.firestore();
  const handler = createHandler({ getDatabase: () => db, createService: database => new ChallengeService(database, () => now) });
  const middleware = async (req, res, next) => {
    if (req.url !== '/api/challenges') return next();
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 240000) { res.statusCode = 413; res.end(); return; } }
    req.body = body;
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return res; };
    await handler(req, res);
  };
  const server = await createServer({ plugins: [{ name: 'challenge-test-api', configureServer(vite) { vite.middlewares.use(middleware); } }], server: { host: '127.0.0.1', port: 5175, strictPort: true } });
  await server.listen();
  return { server, db, setTime: date => { now = Date.parse(date); } };
}
