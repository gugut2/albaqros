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
  extractFileThumbnail: (filePath) => ipcRenderer.invoke('extract-file-thumbnail', filePath),
  openExternalFile: (filePath) => ipcRenderer.invoke('open-external-file', filePath),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
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
  canvas: {
    listCanvases: () => ipcRenderer.invoke('canvas-list'),
    readCanvas: (relativePath) => ipcRenderer.invoke('canvas-read', relativePath),
    writeCanvas: (relativePath, data) => ipcRenderer.invoke('canvas-write', { relativePath, data }),
    createCanvas: (title, folder, initialData) =>
      ipcRenderer.invoke('canvas-create', { title, folder, initialData }),
    deleteCanvas: (relativePath) => ipcRenderer.invoke('canvas-delete', relativePath),
    renameCanvas: (oldRelativePath, newTitle, newFolder) =>
      ipcRenderer.invoke('canvas-rename', { oldRelativePath, newTitle, newFolder }),
    createFolder: (folderPath) => ipcRenderer.invoke('canvas-create-folder', folderPath),
    openCanvasFolder: (relativePath) => ipcRenderer.invoke('canvas-open-folder', relativePath),
  },
});
