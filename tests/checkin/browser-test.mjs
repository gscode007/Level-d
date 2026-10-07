import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Optional browser tooling: resolve an installed Playwright, or the desktop
// workspace's bundled runtime via PLAYWRIGHT_MODULE. No production dependency.
const require = createRequire(import.meta.url);
const { chromium, _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.CHECKIN_TEST_URL || 'http://localhost:5174';
const url = `${base}/tests/checkin/index.html`;
const key = 'leveld-checkin-v1:integration-test';
const browser = await chromium.launch({ headless: true, ...(process.env.CHECKIN_BROWSER_CHANNEL ? { channel: process.env.CHECKIN_BROWSER_CHANNEL } : {}) });
const errors = [];
try {
  const remotePage = await browser.newPage();
  await remotePage.goto(url);
  await remotePage.locator('dialog[open]').waitFor();
  await remotePage.evaluate(() => window.sendCheckinCommand({ id: 'remote-settings', type: 'settings', settings: { enabled: false } }));
  await remotePage.waitForFunction(() => JSON.parse(localStorage.getItem('leveld-checkin-v1:integration-test')).commandId === 'remote-settings');
  assert.equal(await remotePage.locator('dialog').evaluate(el => el.open), true);
  await remotePage.evaluate(() => window.sendCheckinCommand({ id: 'remote-later', type: 'later', until: Date.now() + 1800000 }));
  await remotePage.locator('dialog').waitFor({ state: 'detached' });
  await remotePage.reload();
  await remotePage.waitForFunction(() => document.querySelector('[data-testid=active]').textContent === 'inactive');
  await remotePage.evaluate(() => window.sendCheckinCommand({ id: 'remote-frequency', type: 'settings', settings: { enabled: true, intervalMinutes: 30, startHour: 0, endHour: 24 } }));
  await remotePage.waitForFunction(() => JSON.parse(localStorage.getItem('leveld-checkin-v1:integration-test')).settings.intervalMinutes === 30);
  await remotePage.close();
  const page = await browser.newPage({ viewport: { width: 1000, height: 850 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.locator('dialog[open]').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog').evaluate(el => el.open), true);
  await page.mouse.click(5, 5);
  assert.equal(await page.locator('dialog').evaluate(el => el.open), true);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')), true);
  }
  await page.getByRole('checkbox').first().click();
  await page.waitForFunction(() => document.querySelector('[data-testid=remaining]').textContent === '1');
  await page.reload();
  await page.locator('dialog[open]').waitFor();
  assert.equal(await page.getByRole('checkbox').count(), 1);
  await page.getByRole('button', { name: 'In 15 min', exact: true }).click();
  await page.locator('dialog').waitFor({ state: 'detached' });
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  assert.equal(saved.active, false);
  assert.equal(saved.snoozes, 1);
  assert.ok(saved.nextAt > Date.now() + 14 * 60_000);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-testid=active]').textContent === 'inactive');
  await page.getByRole('button', { name: 'Check in now', exact: true }).click();
  await page.locator('dialog[open]').waitFor();
  await page.getByLabel('Or choose a time').fill('2020-01-01T12:00');
  await page.getByRole('button', { name: 'Set check-in', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('dialog').evaluate(el => el.open), true);

  // A storage failure must not falsely dismiss a check-in.
  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('Simulated storage failure'); };
  });
  await page.getByRole('button', { name: 'In 30 min', exact: true }).click();
  assert.equal(await page.locator('dialog').evaluate(el => el.open), true);
  assert.match(await page.getByRole('alert').innerText(), /could not be saved/);
  await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
  await page.getByRole('checkbox').click();
  await page.locator('dialog').waitFor({ state: 'detached' });
  assert.equal(await page.getByTestId('remaining').innerText(), '0');

  // Fresh mobile fixture: ensure the dialog fits and both resolution paths remain accessible.
  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await mobile.goto(url);
  await mobile.locator('dialog[open]').waitFor();
  assert.equal(await mobile.locator('dialog').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  if (process.env.CHECKIN_SCREENSHOT) await mobile.screenshot({ path: process.env.CHECKIN_SCREENSHOT });
  const future = await mobile.evaluate(() => {
    const date = new Date(Date.now() + 90 * 60_000);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  });
  await mobile.getByLabel('Or choose a time').fill(future);
  await mobile.getByRole('button', { name: 'Set check-in', exact: true }).click();
  await mobile.locator('dialog').waitFor({ state: 'detached' });
  await mobile.evaluate(key => {
    const schedule = JSON.parse(localStorage.getItem(key));
    schedule.nextAt = Date.now() - 1_000;
    localStorage.setItem(key, JSON.stringify(schedule));
  }, key);
  await mobile.reload();
  await mobile.locator('dialog[open]').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS browser: strict dismissal, focus, partial completion/reload, snooze/reload/wake, custom times, storage failure, mobile layout.');
} finally { await browser.close(); }

if (process.env.CHECKIN_TEST_DESKTOP === '1') {
  const profile = await mkdtemp(path.join(os.tmpdir(), 'leveld-checkin-test-'));
  const env = { ...process.env, LEVELD_DEV_URL: url, LEVELD_TEST_USER_DATA: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  let desktop;
  try {
    desktop = await _electron.launch({ executablePath: require('electron'), args: ['tests/checkin/desktop-fixture.cjs'], env });
    const page = await desktop.firstWindow();
    await page.locator('dialog[open]').waitFor();
    await page.waitForFunction(() => !!window.leveldDesktop);
    let native = await desktop.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return { closable: win.isClosable(), minimizable: win.isMinimizable(), movable: win.isMovable(), onTop: win.isAlwaysOnTop() };
    });
    assert.deepEqual(native, { closable: false, minimizable: false, movable: false, onTop: true });
    await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    assert.equal(await page.locator('dialog').evaluate(el => el.open), true);
    await page.getByRole('button', { name: 'In 15 min', exact: true }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });
    await desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    assert.deepEqual(await desktop.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return { visible: win.isVisible() };
    }), { visible: false });

    // Simulate a saved deadline becoming due while the desktop renderer is hidden.
    await page.evaluate(key => {
      const schedule = JSON.parse(localStorage.getItem(key));
      schedule.active = false;
      schedule.explicit = true;
      schedule.nextAt = Date.now() + 1_500;
      localStorage.setItem(key, JSON.stringify(schedule));
      location.reload();
    }, key);
    await page.locator('dialog[open]').waitFor();
    native = await desktop.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return { visible: win.isVisible(), width: win.getBounds().width, closable: win.isClosable() };
    });
    assert.equal(native.visible, true);
    assert.ok(native.width > 0);
    const geometry = await desktop.evaluate(({ BrowserWindow, screen }) => {
      const bounds = BrowserWindow.getAllWindows()[0].getBounds();
      const monitor = screen.getDisplayMatching(bounds);
      return { bounds, monitor };
    });
    const { bounds, monitor } = geometry;
    assert.ok(Math.abs(bounds.width / bounds.height - monitor.bounds.width / monitor.bounds.height) < 0.005);
    assert.ok(Math.abs(bounds.x + bounds.width / 2 - monitor.workArea.x - monitor.workArea.width / 2) <= 1);
    assert.ok(Math.abs(bounds.y + bounds.height / 2 - monitor.workArea.y - monitor.workArea.height / 2) <= 1);
    if (process.env.CHECKIN_POPUP_SCREENSHOT) await page.screenshot({ path: process.env.CHECKIN_POPUP_SCREENSHOT });
    assert.equal(native.closable, false);
    await page.getByRole('button', { name: 'In 30 min', exact: true }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(await desktop.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      return { count: windows.length, visible: windows[0].isVisible() };
    }), { count: 1, visible: false });
    console.log('PASS widget: preload bridge, strict close controls, hidden between check-ins, timed centered popup, screen aspect ratio, no movement or dismissal.');
  } finally {
    if (desktop) await desktop.evaluate(({ app }) => app.exit(0)).catch(() => {});
    // Only remove the fresh isolated profile created above, never the real app profile.
    if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep)) {
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    }
  }
}
