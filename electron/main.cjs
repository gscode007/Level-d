const { app, BrowserWindow, Menu, Tray, ipcMain, powerMonitor, screen, dialog } = require('electron');
const path = require('node:path');
const { serveWidget } = require('./widget-server.cjs');
const { popupBounds } = require('./popup-bounds.cjs');
app.setName('Leveld');
let widget, tray, server, origin, wakeTimer;
let quitting = false;
let active = false;
let expanded = false;

function showWidget() {
  if (!widget || widget.isDestroyed()) return;
  widget.setBounds(popupBounds(screen.getDisplayNearestPoint(screen.getCursorScreenPoint())));
  widget.show(); widget.focus();
}
function resizeWidget(open) {
  if (!widget || widget.isDestroyed()) return;
  expanded = active || open;
  if (expanded) showWidget();
  else widget.hide();
}
function openSettings() {
  if (!widget || widget.isDestroyed()) return;
  if (!active) widget.webContents.send('widget:open-settings');
  resizeWidget(true);
}
function updateTray() {
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: active ? 'Show check-in' : 'Check-in settings', click: openSettings }, { type: 'separator' },
    { label: 'Quit widget', enabled: !active, click: () => { quitting = true; app.quit(); } },
  ]));
}
function wake() { if (widget && !widget.isDestroyed()) widget.webContents.send('checkin:wake'); }
function validSender(event) {
  return widget && event.sender === widget.webContents && event.senderFrame === widget.webContents.mainFrame
    && new URL(event.senderFrame.url).origin === origin;
}
async function createWidget() {
  let url;
  if (!app.isPackaged && process.env.LEVELD_DEV_URL) {
    url = process.env.LEVELD_DEV_URL; origin = new URL(url).origin;
  } else {
    const port = !app.isPackaged && process.env.LEVELD_WIDGET_PORT ? Number(process.env.LEVELD_WIDGET_PORT) : 5174;
    const local = await serveWidget(path.join(__dirname, '../dist'), port);
    server = local.server; origin = local.origin; url = `${origin}/widget.html`;
  }
  widget = new BrowserWindow({ ...popupBounds(screen.getPrimaryDisplay()), frame: false, transparent: true,
    backgroundColor: '#00000000', alwaysOnTop: true, skipTaskbar: true,
    resizable: false, movable: false, closable: false, maximizable: false, minimizable: false, show: false,
    title: 'Level’d check-ins', icon: path.join(__dirname, '../build-assets/icon.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, spellcheck: false,
      preload: path.join(__dirname, 'preload.cjs'), backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  widget.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    if (active) showWidget();
  });
  widget.on('minimize', event => { event.preventDefault(); showWidget(); });
  widget.on('query-session-end', () => { quitting = true; });
  widget.on('will-move', event => event.preventDefault());
  screen.on('display-metrics-changed', () => { if (widget.isVisible()) showWidget(); });
  screen.on('display-removed', () => { if (widget.isVisible()) showWidget(); });
  widget.webContents.setWindowOpenHandler(({ url: targetURL }) => {
    const target = new URL(targetURL);
    if (target.protocol === 'https:' && (
      (target.pathname.startsWith('/__/auth/') && target.hostname.endsWith('.firebaseapp.com')) ||
      target.hostname === 'accounts.google.com' || target.hostname === 'www.googleapis.com'
    )) return { action: 'allow', overrideBrowserWindowOptions: {
      width: 500, height: 650, frame: true, transparent: false, alwaysOnTop: true, skipTaskbar: false,
      autoHideMenuBar: true, resizable: true, minimizable: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: undefined },
    } };
    return { action: 'deny' };
  });
  widget.webContents.on('will-navigate', (event, targetURL) => { if (new URL(targetURL).origin !== origin) event.preventDefault(); });
  await widget.loadURL(url);
  tray = new Tray(path.join(__dirname, '../build-assets/icon.ico'));
  tray.setToolTip('Level’d check-ins'); tray.on('double-click', openSettings); updateTray();
  powerMonitor.on('resume', wake); powerMonitor.on('unlock-screen', wake);
  powerMonitor.on('shutdown', () => { quitting = true; });
}
ipcMain.on('checkin:state', (event, payload) => {
  if (!validSender(event) || !payload || typeof payload.enabled !== 'boolean' || typeof payload.active !== 'boolean') return;
  clearTimeout(wakeTimer);
  const nextActive = payload.enabled && payload.active;
  if (nextActive !== active) {
    active = nextActive; resizeWidget(active);
    updateTray();
  }
  if (payload.enabled && !payload.active && Number.isFinite(payload.nextAt)) {
    wakeTimer = setTimeout(wake, Math.min(86_400_000, Math.max(1_000, payload.nextAt - Date.now())));
  }
});
ipcMain.on('widget:view', (event, payload) => {
  if (validSender(event) && typeof payload?.expanded === 'boolean') resizeWidget(payload.expanded);
});
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', openSettings);
  app.whenReady().then(createWidget).catch(error => {
    dialog.showErrorBox('Level’d widget could not start', error.code === 'EADDRINUSE'
      ? 'The old Level’d development server is still using port 5174. Close it and start the widget again.' : error.message);
    quitting = true; app.quit();
  });
}
app.on('before-quit', event => {
  if (active && !quitting) { event.preventDefault(); showWidget(); return; }
  quitting = true; clearTimeout(wakeTimer); server?.close();
});
app.on('window-all-closed', () => {});
app.on('activate', openSettings);
