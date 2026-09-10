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
  getVaultInfo: () => ipcRenderer.invoke('vault-get-info'),
  selectVaultDirectory: () => ipcRenderer.invoke('vault-select-existing'),
  createNewVault: (vaultName, parentPath, initialData) =>
    ipcRenderer.invoke('vault-create-new', { vaultName, parentPath, initialData }),
  switchVault: (vaultPath, migrateCurrentData, currentData) =>
    ipcRenderer.invoke('vault-switch', { vaultPath, migrateCurrentData, currentData }),
  openVaultInExplorer: (vaultPath) => ipcRenderer.invoke('vault-open-in-explorer', vaultPath),
  setAutoLaunch: (enable) => ipcRenderer.invoke('set-auto-launch', enable),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  selectProjectFile: () => ipcRenderer.invoke('select-project-file'),
  selectCoverImage: () => ipcRenderer.invoke('select-cover-image'),
  openExternalFile: (filePath) => ipcRenderer.invoke('open-external-file', filePath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  onExternalDataChange: (callback) => {
    ipcRenderer.on('external-data-change', () => callback());
  },
  getAppVersion: () => ipcRenderer.invoke('app-get-version'),
  checkForUpdates: () => ipcRenderer.invoke('updater-check'),
  downloadUpdate: () => ipcRenderer.invoke('updater-download'),
  installUpdate: () => ipcRenderer.invoke('updater-install'),
  onUpdaterStatus: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('updater-status', listener);
    return () => ipcRenderer.removeListener('updater-status', listener);
  },
  notes: {
    listNotes: () => ipcRenderer.invoke('notes-list'),
    readNote: (relativePath) => ipcRenderer.invoke('notes-read', relativePath),
    writeNote: (relativePath, content) => ipcRenderer.invoke('notes-write', { relativePath, content }),
    createNote: (title, folder, content) => ipcRenderer.invoke('notes-create', { title, folder, content }),
    deleteNote: (relativePath) => ipcRenderer.invoke('notes-delete', relativePath),
    renameNote: (oldRelativePath, newTitle, newFolder) =>
      ipcRenderer.invoke('notes-rename', { oldRelativePath, newTitle, newFolder }),
    createFolder: (folderPath) => ipcRenderer.invoke('notes-create-folder', folderPath),
    openNotesFolder: (relativePath) => ipcRenderer.invoke('notes-open-folder', relativePath),
  },
});
