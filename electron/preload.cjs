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
  readClipboardImage: () => ipcRenderer.invoke('clipboard-read-image'),
  readClipboardText: () => ipcRenderer.invoke('clipboard-read-text'),
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
  getBackups: () => ipcRenderer.invoke('backup-list'),
  createBackup: (note) => ipcRenderer.invoke('backup-create-manual', note),
  restoreBackup: (filePath) => ipcRenderer.invoke('backup-restore', filePath),
  openBackupsFolder: (location) => ipcRenderer.invoke('backup-open-folder', location),
  syncMarkdownNow: () => ipcRenderer.invoke('markdown-sync-now'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  openDetachedWindow: (params) => ipcRenderer.invoke('notes-open-detached', params),
  dockNoteBack: (relativePath) => ipcRenderer.invoke('notes-dock-back', relativePath),
  getDetachedNotes: () => ipcRenderer.invoke('notes-get-detached'),
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
    openDetachedWindow: (params) => ipcRenderer.invoke('notes-open-detached', params),
    dockNoteBack: (relativePath) => ipcRenderer.invoke('notes-dock-back', relativePath),
    getDetachedNotes: () => ipcRenderer.invoke('notes-get-detached'),
    onNoteDocked: (callback) => {
      const listener = (_, data) => callback(data);
      ipcRenderer.on('note-docked', listener);
      return () => ipcRenderer.removeListener('note-docked', listener);
    },
    onDetachedNotesChanged: (callback) => {
      const listener = (_, data) => callback(data);
      ipcRenderer.on('detached-notes-changed', listener);
      return () => ipcRenderer.removeListener('detached-notes-changed', listener);
    },
    onNoteContentChanged: (callback) => {
      const listener = (_, data) => callback(data);
      ipcRenderer.on('note-content-changed', listener);
      return () => ipcRenderer.removeListener('note-content-changed', listener);
    },
    onNoteRenamed: (callback) => {
      const listener = (_, data) => callback(data);
      ipcRenderer.on('note-renamed', listener);
      return () => ipcRenderer.removeListener('note-renamed', listener);
    },
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
  assets: {
    listAssets: () => ipcRenderer.invoke('assets-list'),
    importAsset: (params) => ipcRenderer.invoke('assets-import', params),
    selectAndImportAsset: (params) => ipcRenderer.invoke('assets-select-and-import', params),
    renderPreview: (assetId) => ipcRenderer.invoke('assets-render-preview', assetId),
    updateAsset: (asset) => ipcRenderer.invoke('assets-update', asset),
    deleteAsset: (assetId, deleteFile) => ipcRenderer.invoke('assets-delete', { assetId, deleteFile }),
    openInBlender: (filePath) => ipcRenderer.invoke('assets-open-in-blender', filePath),
    openAssetsFolder: (subfolder) => ipcRenderer.invoke('assets-open-folder', subfolder),
    createScene: (assetIds, sceneName) => ipcRenderer.invoke('assets-create-scene', { assetIds, sceneName }),
    generateAppendScript: (filePath) => ipcRenderer.invoke('assets-generate-append-script', filePath),
    createFolder: (folderPath) => ipcRenderer.invoke('assets-create-folder', folderPath),
    moveAsset: (assetId, targetFolder) => ipcRenderer.invoke('assets-move', { assetId, targetFolder }),
    deleteFolder: (folderPath) => ipcRenderer.invoke('assets-delete-folder', folderPath),
  },
  art2d: {
    listAssets: () => ipcRenderer.invoke('art2d-list'),
    importAsset: (params) => ipcRenderer.invoke('art2d-import', params),
    selectAndImportAsset: (params) => ipcRenderer.invoke('art2d-select-and-import', params),
    extractPreview: (assetId) => ipcRenderer.invoke('art2d-extract-preview', assetId),
    updateAsset: (asset) => ipcRenderer.invoke('art2d-update', asset),
    deleteAsset: (assetId, deleteFile) => ipcRenderer.invoke('art2d-delete', { assetId, deleteFile }),
    openInSoftware: (filePath, preferredSoftware) =>
      ipcRenderer.invoke('art2d-open-software', { filePath, preferredSoftware }),
    openFolder: (subfolder) => ipcRenderer.invoke('art2d-open-folder', subfolder),
    copyToClipboard: (assetId) => ipcRenderer.invoke('art2d-copy-clipboard', assetId),
    exportPreview: (assetId) => ipcRenderer.invoke('art2d-export-preview', assetId),
    addToCanvas: (assetId, canvasPath) => ipcRenderer.invoke('art2d-add-to-canvas', { assetId, canvasPath }),
    createFolder: (folderPath) => ipcRenderer.invoke('art2d-create-folder', folderPath),
    moveAsset: (assetId, targetFolder) => ipcRenderer.invoke('art2d-move', { assetId, targetFolder }),
    deleteFolder: (folderPath) => ipcRenderer.invoke('art2d-delete-folder', folderPath),
  },
});

