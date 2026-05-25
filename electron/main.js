const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

app.setName('Life RPG');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, '../build-assets/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
    },
    backgroundColor: '#080E1A',
    autoHideMenuBar: true,
    title: 'Life RPG',
    show: false,
  });

  Menu.setApplicationMenu(null);

  win.loadURL('https://life-rpg-gold.vercel.app');

  win.once('ready-to-show', () => win.show());

  // Open external links in system browser, not in the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('https://life-rpg-gold.vercel.app')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
