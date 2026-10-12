// Vite + the existing trusted Firebase API on one localhost origin.
// No emulator, mock, provisioning or deployment fallback in normal development.
import { createServer, loadEnv } from 'vite';
import handler from '../api/challenges/index.js';
const env = loadEnv('development', process.cwd(), '');
for (const key of ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'GOOGLE_APPLICATION_CREDENTIALS']) if (!process.env[key] && env[key]) process.env[key] = env[key];
const server = await createServer({ plugins: [{ name: 'challenges-local-api', configureServer(vite) {
  vite.middlewares.use(async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/challenges') return next();
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 240000) { res.statusCode = 413; res.end(JSON.stringify({ error: 'Request too large.' })); return; } }
    req.body = body;
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return res; };
    await handler(req, res);
  });
} }], server: { host: 'localhost', port: Number(process.env.LEVELD_DEV_PORT || 5173), strictPort: true } });
await server.listen(); server.printUrls();
const stop = async () => { await server.close(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
