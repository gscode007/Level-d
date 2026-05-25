const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

app.setName('Leveld');

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
    title: 'Leveld',
    show: false,
  });

  Menu.setApplicationMenu(null);

  win.loadURL('https://life-rpg-gold.vercel.app');

  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    // Allow Firebase auth popup + Google OAuth to open inside Electron
    // so the sign-in result comes back to the app instead of the browser
    if (
      url.includes('/__/auth/') ||
      url.startsWith('https://accounts.google.com') ||
      url.startsWith('https://www.googleapis.com')
    ) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 650,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        },
      };
    }
    // Everything else opens in the system browser
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
