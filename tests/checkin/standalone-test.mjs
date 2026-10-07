import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const profile = await mkdtemp(path.join(os.tmpdir(), 'leveld-standalone-test-'));
const env = { ...process.env, LEVELD_TEST_USER_DATA: profile, LEVELD_WIDGET_PORT: '0' };
delete env.ELECTRON_RUN_AS_NODE;
delete env.LEVELD_DEV_URL;
let desktop;
try {
  desktop = await _electron.launch({ executablePath: require('electron'), args: ['tests/checkin/desktop-fixture.cjs'], env });
  const page = await desktop.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForURL('**/widget.html');
  await page.reload();
  try { await page.getByRole('button', { name: 'Connect Google account', exact: true }).waitFor({ timeout: 15000 }); }
  catch (error) { console.error({ errors, body: await page.locator('body').innerText() }); throw error; }
  assert.ok(page.url().endsWith('/widget.html'));
  const origin = new URL(page.url()).origin;
  assert.equal((await fetch(`${origin}/index.html`)).status, 404);
  assert.equal((await fetch(`${origin}/.env`)).status, 404);
  assert.equal((await fetch(`${origin}/assets/..%5c..%5c.env`)).status, 403);
  assert.equal((await fetch(`${origin}/widget.html`, { method: 'POST' })).status, 403);
  assert.equal((await (await fetch(`${origin}/widget.html`)).text()).includes('registerSW'), false);
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
  await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('widget:open-settings'));
  await page.getByRole('button', { name: 'Connect Google account', exact: true }).waitFor();
  assert.equal(await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true);
  assert.deepEqual(errors, []);
  console.log('PASS standalone: starts from bundled files without Vite; independent widget only; hidden idle window and manually opened settings; no dashboard or source exposure.');
} finally {
  if (desktop) await desktop.evaluate(({ app }) => app.exit(0)).catch(() => {});
  if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep)) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
