const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('window-minimize'),
  close: () => ipcRenderer.invoke('window-close'),
  toggleWindowMode: (targetMode) => ipcRenderer.invoke('window-toggle-mode', targetMode),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('window-set-always-on-top', flag),
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  selectStorageDirectory: () => ipcRenderer.invoke('select-storage-directory'),
  getStorageInfo: () => ipcRenderer.invoke('get-storage-info'),
  setAutoLaunch: (enable) => ipcRenderer.invoke('set-auto-launch', enable),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  onExternalDataChange: (callback) => {
    ipcRenderer.on('external-data-change', () => callback());
  },
});
