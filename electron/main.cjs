const { app, BrowserWindow, ipcMain, dialog, screen, Tray, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('Albaqros');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.albaqros.app');
}

let mainWindow = null;
let isCompact = false;
let fileWatcher = null;
let tray = null;
let lastLocalSaveTime = 0;

const PRIMARY_DATA_FILENAME = 'albaqros-data.json';
const LEGACY_DATA_FILENAME = 'productivity-data.json';
const VAULT_META_FILENAME = 'vault.json';

function getAppConfigPath() {
  return path.join(app.getPath('userData'), 'albaqros-config.json');
}

function loadAppConfig() {
  try {
    const cfgPath = getAppConfigPath();
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load albaqros-config.json:', err);
  }
  return { vaultPath: '', recentVaults: [] };
}

function saveAppConfig(config) {
  try {
    const cfgPath = getAppConfigPath();
    const dir = path.dirname(cfgPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save albaqros-config.json:', err);
  }
}

// Initialize config on boot
let appConfig = loadAppConfig();
let activeVaultPath = appConfig.vaultPath && fs.existsSync(appConfig.vaultPath) ? appConfig.vaultPath : '';

function getDefaultVaultPath() {
  return path.join(app.getPath('userData'), 'DefaultVault');
}

function detectCloudProvider(dirPath) {
  if (!dirPath) return 'local';
  const lower = dirPath.toLowerCase();
  if (lower.includes('onedrive')) return 'onedrive';
  if (lower.includes('google drive') || lower.includes('googledrive') || lower.includes('my drive') || lower.includes('drive')) return 'google-drive';
  if (lower.includes('dropbox')) return 'dropbox';
  if (lower.includes('icloud')) return 'icloud';
  return 'local';
}

function getActiveVaultDirectory() {
  if (activeVaultPath && fs.existsSync(activeVaultPath)) {
    return activeVaultPath;
  }
  const defaultDir = getDefaultVaultPath();
  if (!fs.existsSync(defaultDir)) {
    try {
      fs.mkdirSync(defaultDir, { recursive: true });
    } catch (e) {}
  }
  return defaultDir;
}

function getActiveDataFilePath() {
  const vaultDir = getActiveVaultDirectory();
  const primaryPath = path.join(vaultDir, PRIMARY_DATA_FILENAME);
  const legacyPath = path.join(vaultDir, LEGACY_DATA_FILENAME);

  if (fs.existsSync(primaryPath)) return primaryPath;
  if (fs.existsSync(legacyPath)) return legacyPath;

  // Check legacy user data path for migration
  const oldUserDefault = path.join(app.getPath('userData'), LEGACY_DATA_FILENAME);
  if (fs.existsSync(oldUserDefault) && !activeVaultPath) {
    return oldUserDefault;
  }

  return primaryPath;
}

function getVaultInfo(vaultDir) {
  const targetDir = vaultDir || getActiveVaultDirectory();
  const exists = fs.existsSync(targetDir);
  let vaultName = exists ? path.basename(targetDir) : (targetDir ? path.basename(targetDir) : 'Default Vault');

  // Try reading vault.json if exists
  const metaPath = path.join(targetDir, VAULT_META_FILENAME);
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (meta.name) vaultName = meta.name;
    } catch (e) {}
  }

  const primaryPath = path.join(targetDir, PRIMARY_DATA_FILENAME);
  const legacyPath = path.join(targetDir, LEGACY_DATA_FILENAME);
  const hasDataFile = fs.existsSync(primaryPath) || fs.existsSync(legacyPath);
  const activeFilePath = fs.existsSync(primaryPath) ? primaryPath : (fs.existsSync(legacyPath) ? legacyPath : primaryPath);

  return {
    path: targetDir,
    name: vaultName,
    exists,
    hasDataFile,
    dataFilePath: activeFilePath,
    cloudProvider: detectCloudProvider(targetDir),
    isCustom: Boolean(activeVaultPath && activeVaultPath !== getDefaultVaultPath()),
    recentVaults: appConfig.recentVaults || [],
  };
}

function recordRecentVault(vaultPath, vaultName) {
  if (!vaultPath) return;
  const name = vaultName || path.basename(vaultPath);
  const existing = (appConfig.recentVaults || []).filter((v) => v.path !== vaultPath);
  const updated = [
    { path: vaultPath, name, lastUsed: new Date().toISOString() },
    ...existing,
  ].slice(0, 8);
  appConfig.recentVaults = updated;
  appConfig.vaultPath = vaultPath;
  saveAppConfig(appConfig);
}

function setupFileWatcher(filePath) {
  if (fileWatcher) {
    try {
      fileWatcher.close();
    } catch (e) {}
    fileWatcher = null;
  }
  try {
    if (fs.existsSync(filePath)) {
      fileWatcher = fs.watch(filePath, (eventType) => {
        // Ignore local saves made by Albaqros within 2.5 seconds
        if (Date.now() - lastLocalSaveTime < 2500) return;
        if (eventType === 'change' && mainWindow && !mainWindow.isDestroyed()) {
          console.log('External data change detected in vault:', filePath);
          mainWindow.webContents.send('external-data-change');
        }
      });
    }
  } catch (err) {
    console.error('Failed to setup file watcher:', err);
  }
}

function setupTray() {
  if (tray) return;
  const trayIconPath = path.join(__dirname, '../assets/tray.png');
  const fallbackIconPath = path.join(__dirname, '../assets/icon.png');
  const actualTrayIcon = fs.existsSync(trayIconPath) ? trayIconPath : fallbackIconPath;

  if (fs.existsSync(actualTrayIcon)) {
    try {
      tray = new Tray(actualTrayIcon);
      tray.setToolTip('Albaqros - Daily Tasks & Reflection Companion');

      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Open Albaqros',
          click: () => {
            if (mainWindow) {
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.show();
              mainWindow.focus();
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Quit Albaqros',
          click: () => {
            app.isQuitting = true;
            app.quit();
          },
        },
      ]);

      tray.setContextMenu(contextMenu);
      tray.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            if (mainWindow.isMinimized()) {
              mainWindow.restore();
            }
            mainWindow.focus();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      });
    } catch (err) {
      console.error('Error creating tray:', err);
    }
  }
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const iconPath = path.join(__dirname, '../assets/icon.png');

  mainWindow = new BrowserWindow({
    title: 'Albaqros',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    width: 420,
    height: 680,
    minWidth: 380,
    minHeight: 550,
    frame: false,
    skipTaskbar: false, // Ensures Albaqros displays in the Windows taskbar
    transparent: false,
    backgroundColor: '#0b0d11',
    hasShadow: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Start in compact mode at the right side of the screen
  isCompact = true;
  mainWindow.setPosition(screenWidth - 440, Math.max(40, Math.floor((screenHeight - 680) / 2)));

  const distPath = path.join(__dirname, '../dist/index.html');
  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development');

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  // Initial file watch
  setupFileWatcher(getActiveDataFilePath());
}

// IPC Handlers
ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-toggle-mode', (_, targetMode) => {
  if (!mainWindow) return isCompact;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  if (targetMode !== undefined) {
    isCompact = targetMode === 'compact';
  } else {
    isCompact = !isCompact;
  }

  if (isCompact) {
    // Switch to Compact Floating Widget
    mainWindow.setResizable(true);
    mainWindow.setSize(420, 680, true);
    mainWindow.setPosition(screenWidth - 440, Math.max(40, Math.floor((screenHeight - 680) / 2)), true);
  } else {
    // Switch to Maximized Studio Mode
    const targetW = Math.min(1240, screenWidth - 100);
    const targetH = Math.min(840, screenHeight - 80);
    mainWindow.setResizable(true);
    mainWindow.setSize(targetW, targetH, true);
    mainWindow.center();
  }

  return isCompact;
});

ipcMain.handle('window-set-always-on-top', (_, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(Boolean(flag));
    return mainWindow.isAlwaysOnTop();
  }
  return false;
});

// Storage & Vault IPCs
ipcMain.handle('load-data', async () => {
  const filePath = getActiveDataFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      setupFileWatcher(filePath);
      return parsed;
    }
  } catch (err) {
    console.error('Error reading data file:', err);
  }
  return null;
});

ipcMain.handle('save-data', async (_, data) => {
  const vaultDir = getActiveVaultDirectory();
  try {
    if (!fs.existsSync(vaultDir)) {
      fs.mkdirSync(vaultDir, { recursive: true });
    }

    // Write vault.json metadata if not already present
    const metaPath = path.join(vaultDir, VAULT_META_FILENAME);
    if (!fs.existsSync(metaPath)) {
      try {
        fs.writeFileSync(
          metaPath,
          JSON.stringify(
            {
              name: path.basename(vaultDir),
              createdAt: new Date().toISOString(),
              version: 1,
            },
            null,
            2
          ),
          'utf-8'
        );
      } catch (e) {}
    }

    const filePath = path.join(vaultDir, PRIMARY_DATA_FILENAME);
    lastLocalSaveTime = Date.now();
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);

    setupFileWatcher(filePath);
    return { success: true, path: filePath, vaultInfo: getVaultInfo() };
  } catch (err) {
    console.error('Error saving data file:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('vault-get-info', () => {
  return getVaultInfo();
});

ipcMain.handle('vault-select-existing', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Albaqros Vault Folder (Google Drive / OneDrive / Local)',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedDir = result.filePaths[0];
    activeVaultPath = selectedDir;
    recordRecentVault(selectedDir);

    const vaultInfo = getVaultInfo(selectedDir);
    const dataFilePath = getActiveDataFilePath();
    let loadedData = null;

    if (fs.existsSync(dataFilePath)) {
      try {
        const raw = fs.readFileSync(dataFilePath, 'utf-8');
        loadedData = JSON.parse(raw);
      } catch (e) {
        console.error('Error parsing vault data:', e);
      }
    }

    setupFileWatcher(dataFilePath);
    return {
      success: true,
      vaultInfo,
      data: loadedData,
      isEmpty: !loadedData,
    };
  }
  return null;
});

ipcMain.handle('vault-create-new', async (_, { vaultName, parentPath, initialData }) => {
  if (!mainWindow) return { success: false, error: 'No main window' };

  let targetParent = parentPath;
  if (!targetParent || !fs.existsSync(targetParent)) {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: `Choose Destination Folder for "${vaultName || 'Albaqros Vault'}" (e.g. inside Google Drive or OneDrive)`,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    targetParent = result.filePaths[0];
  }

  const cleanName = (vaultName || 'Albaqros Vault').trim();
  const targetVaultDir = path.join(targetParent, cleanName);

  try {
    if (!fs.existsSync(targetVaultDir)) {
      fs.mkdirSync(targetVaultDir, { recursive: true });
    }

    // Create artifacts subfolder in vault
    const artifactsDir = path.join(targetVaultDir, 'artifacts');
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    // Write vault.json metadata
    const metaPath = path.join(targetVaultDir, VAULT_META_FILENAME);
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          name: cleanName,
          createdAt: new Date().toISOString(),
          version: 1,
        },
        null,
        2
      ),
      'utf-8'
    );

    // Write initial data if provided
    const dataFilePath = path.join(targetVaultDir, PRIMARY_DATA_FILENAME);
    if (initialData) {
      lastLocalSaveTime = Date.now();
      fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2), 'utf-8');
    }

    activeVaultPath = targetVaultDir;
    recordRecentVault(targetVaultDir, cleanName);
    setupFileWatcher(dataFilePath);

    return {
      success: true,
      vaultInfo: getVaultInfo(targetVaultDir),
      data: initialData || null,
    };
  } catch (err) {
    console.error('Error creating new vault:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('vault-switch', async (_, { vaultPath, migrateCurrentData, currentData }) => {
  if (!vaultPath || !fs.existsSync(vaultPath)) {
    return { success: false, error: 'Vault directory does not exist' };
  }

  activeVaultPath = vaultPath;
  recordRecentVault(vaultPath);

  const dataFilePath = getActiveDataFilePath();
  let loadedData = null;

  if (fs.existsSync(dataFilePath)) {
    try {
      const raw = fs.readFileSync(dataFilePath, 'utf-8');
      loadedData = JSON.parse(raw);
    } catch (e) {
      console.error('Error loading vault data:', e);
    }
  } else if (migrateCurrentData && currentData) {
    try {
      lastLocalSaveTime = Date.now();
      fs.writeFileSync(dataFilePath, JSON.stringify(currentData, null, 2), 'utf-8');
      loadedData = currentData;
    } catch (e) {
      console.error('Error migrating data into vault:', e);
    }
  }

  setupFileWatcher(dataFilePath);
  return {
    success: true,
    vaultInfo: getVaultInfo(vaultPath),
    data: loadedData,
  };
});

ipcMain.handle('vault-open-in-explorer', async (_, targetPath) => {
  const dir = targetPath || getActiveVaultDirectory();
  if (fs.existsSync(dir)) {
    await shell.openPath(dir);
    return true;
  }
  return false;
});

// Backwards-compatible aliases
ipcMain.handle('select-storage-directory', async () => {
  const vaultInfo = getVaultInfo();
  return vaultInfo.path;
});

ipcMain.handle('get-storage-info', () => {
  const info = getVaultInfo();
  return {
    filePath: info.dataFilePath,
    isCustom: info.isCustom,
  };
});

// Auto-Launch setting for Windows
ipcMain.handle('set-auto-launch', (_, enable) => {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enable),
    path: process.execPath,
  });
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('get-auto-launch', () => {
  return app.getLoginItemSettings().openAtLogin;
});

// Creative Project Files & Milestone Deliverables IPCs
ipcMain.handle('select-project-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Milestone Deliverable / Project File',
    properties: ['openFile'],
    filters: [
      {
        name: 'All Creative Assets',
        extensions: [
          'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg',
          'blend', 'obj', 'fbx', 'gltf', 'glb', 'stl', 'c4d', 'max', 'ma', 'mb',
          'wav', 'mp3', 'ogg', 'flac', 'm4a', 'aac', 'aif', 'aiff',
          'psd', 'clip', 'kra', 'procreate', 'flp', 'als', 'logic', 'prproj', 'aep', 'pdf', 'zip'
        ]
      },
      { name: 'Images & Concept Art', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] },
      { name: '3D Projects & Models', extensions: ['blend', 'obj', 'fbx', 'gltf', 'glb', 'stl', 'c4d', 'max', 'ma', 'mb', 'step', 'dae'] },
      { name: 'Audio, Music & SFX', extensions: ['wav', 'mp3', 'ogg', 'flac', 'm4a', 'aac', 'aif', 'aiff'] },
      { name: 'Creative Project Files', extensions: ['psd', 'clip', 'kra', 'procreate', 'flp', 'als', 'logic', 'prproj', 'aep'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  let fileSize = 0;
  try {
    const stats = fs.statSync(filePath);
    fileSize = stats.size;
  } catch (err) {
    console.error('Error stating file:', err);
  }

  const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'];
  const threeDExts = ['.blend', '.obj', '.fbx', '.gltf', '.glb', '.stl', '.c4d', '.max', '.ma', '.mb', '.step', '.dae'];
  const audioExts = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.aif', '.aiff'];

  let detectedType = 'file';
  if (imageExts.includes(ext)) detectedType = 'image';
  else if (threeDExts.includes(ext)) detectedType = '3d';
  else if (audioExts.includes(ext)) detectedType = 'audio';

  // For images and audio under 30MB, read into base64 Data URL for instant in-app preview/playback
  let dataUrl = undefined;
  if ((detectedType === 'image' || detectedType === 'audio') && fileSize < 30 * 1024 * 1024) {
    try {
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.flac': 'audio/flac',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
      };
      const mime = mimeTypes[ext] || (detectedType === 'image' ? 'image/png' : 'audio/mpeg');
      const buffer = fs.readFileSync(filePath);
      dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (err) {
      console.error('Error generating data URL for file:', err);
    }
  }

  return {
    filePath,
    fileName,
    fileSize,
    fileExtension: ext,
    detectedType,
    dataUrl,
  };
});

ipcMain.handle('select-cover-image', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Render or Cover Thumbnail',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  try {
    const buffer = fs.readFileSync(filePath);
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch (e) {
    return null;
  }
});

ipcMain.handle('open-external-file', async (_, filePath) => {
  if (!filePath) return false;
  try {
    await shell.openPath(filePath);
    return true;
  } catch (err) {
    console.error('Failed to open external file:', err);
    return false;
  }
});

ipcMain.handle('show-item-in-folder', (_, filePath) => {
  if (!filePath) return false;
  try {
    shell.showItemInFolder(filePath);
    return true;
  } catch (err) {
    console.error('Failed to show item in folder:', err);
    return false;
  }
});

app.whenReady().then(() => {
  createWindow();
  setupTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
