const { contextBridge, ipcRenderer } = require('electron');

// Narrow bridge: no arbitrary IPC channels, filesystem, or Node access.
contextBridge.exposeInMainWorld('leveldDesktop', {
  setWidgetView: ({ expanded }) => ipcRenderer.send('widget:view', { expanded }),
  onOpenSettings: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('widget:open-settings', listener);
    return () => ipcRenderer.removeListener('widget:open-settings', listener);
  },
  setCheckin: ({ enabled, active, nextAt }) => ipcRenderer.send('checkin:state', { enabled, active, nextAt }),
  onCheckinWake: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('checkin:wake', listener);
    return () => ipcRenderer.removeListener('checkin:wake', listener);
  },
});
