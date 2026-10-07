import { spawn } from 'node:child_process';
import electron from 'electron';

// A stable origin preserves Firebase sign-in and reminder storage across restarts.
// strictPort fails instead of silently moving to a different storage origin.
const port = 5174;
const url = `http://localhost:${port}`;
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', 'localhost', '--port', String(port), '--strictPort'], { stdio: 'inherit' });
let desktop;
const stop = () => { desktop?.kill(); vite.kill(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', stop);
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (vite.exitCode !== null) throw new Error('The local frontend could not start.');
    try { ready = (await fetch(url)).ok; } catch { /* waiting for Vite */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Timed out waiting for the local frontend.');
  const env = { ...process.env, LEVELD_DEV_URL: `${url}/widget.html` };
  delete env.ELECTRON_RUN_AS_NODE;
  desktop = spawn(electron, ['.'], { stdio: 'inherit', env });
  desktop.on('error', error => { console.error(error.message); process.exitCode = 1; stop(); });
  desktop.on('exit', code => { process.exitCode = code || 0; vite.kill(); });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
  stop();
}
