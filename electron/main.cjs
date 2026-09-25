const { app, BrowserWindow, ipcMain, dialog, screen, Tray, Menu, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { extractThumbnail } = require('./thumbnailExtractor.cjs');

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
  const isDev = !app.isPackaged || Boolean(process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development');

  mainWindow.webContents.on('console-message', (e, level, message, line, sourceId) => {
    console.log(`[Renderer]: ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (e, errorCode, errorDescription) => {
    console.warn(`[Electron] Failed to load URL, retrying in 1s (${errorCode}: ${errorDescription})`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (isDev) {
          mainWindow.loadURL('http://localhost:5173');
        } else if (fs.existsSync(distPath)) {
          mainWindow.loadFile(distPath);
        }
      }
    }, 1000);
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  // Intercept window open (target="_blank" or window.open) to open in OS default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Prevent in-app navigation when clicking external links
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isLocal = url.startsWith('http://localhost:5173') || url.startsWith('http://127.0.0.1:5173') || url.startsWith('file://');
    if (!isLocal && (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:'))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

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

  // Identify the exact display that mainWindow is currently located on
  const currentBounds = mainWindow.getBounds();
  const currentDisplay = screen.getDisplayMatching(currentBounds);
  const { x: displayX, y: displayY, width: screenWidth, height: screenHeight } = currentDisplay.workArea;

  if (targetMode !== undefined) {
    isCompact = targetMode === 'compact';
  } else {
    isCompact = !isCompact;
  }

  if (isCompact) {
    // Switch to Compact Floating Widget on the CURRENT monitor
    const targetW = 420;
    const targetH = 680;
    const targetX = displayX + screenWidth - 440;
    const targetY = displayY + Math.max(40, Math.floor((screenHeight - targetH) / 2));
    mainWindow.setResizable(true);
    mainWindow.setBounds({ x: targetX, y: targetY, width: targetW, height: targetH }, true);
  } else {
    // Switch to Maximized Studio Mode on the CURRENT monitor (never jump to other monitor)
    const targetW = Math.min(1240, screenWidth - 100);
    const targetH = Math.min(840, screenHeight - 80);
    const targetX = displayX + Math.max(20, Math.floor((screenWidth - targetW) / 2));
    const targetY = displayY + Math.max(20, Math.floor((screenHeight - targetH) / 2));
    mainWindow.setResizable(true);
    mainWindow.setBounds({ x: targetX, y: targetY, width: targetW, height: targetH }, true);
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
  const digitalArtExts = ['.kra', '.psd', '.clip', '.procreate'];

  let detectedType = 'file';
  if (imageExts.includes(ext) || digitalArtExts.includes(ext)) detectedType = 'image';
  else if (threeDExts.includes(ext)) detectedType = '3d';
  else if (audioExts.includes(ext)) detectedType = 'audio';

  let dataUrl = undefined;
  let thumbnailUrl = undefined;
  let autoGeneratedCover = false;
  let coverSource = null;

  // Direct read for standard image/audio files under 30MB
  if ((imageExts.includes(ext) || audioExts.includes(ext)) && fileSize < 30 * 1024 * 1024) {
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
      if (detectedType === 'image') {
        thumbnailUrl = dataUrl;
      }
    } catch (err) {
      console.error('Error generating data URL for file:', err);
    }
  }

  // Automatic screenshot / thumbnail extraction for native project files (.kra, .psd, .blend, etc.)
  if (!dataUrl || digitalArtExts.includes(ext) || ext === '.blend') {
    try {
      const extracted = await extractThumbnail(filePath);
      if (extracted && extracted.dataUrl) {
        thumbnailUrl = extracted.dataUrl;
        dataUrl = extracted.dataUrl;
        autoGeneratedCover = true;
        coverSource = extracted.source;
      }
    } catch (err) {
      console.error('Error extracting project thumbnail:', err);
    }
  }

  return {
    filePath,
    fileName,
    fileSize,
    fileExtension: ext,
    detectedType,
    dataUrl,
    thumbnailUrl,
    autoGeneratedCover,
    coverSource,
  };
});

ipcMain.handle('extract-file-thumbnail', async (_, filePath) => {
  if (!filePath) return null;
  try {
    const extracted = await extractThumbnail(filePath);
    return extracted;
  } catch (err) {
    console.error('Error extracting thumbnail for file:', err);
    return null;
  }
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

ipcMain.handle('open-external-url', async (_, url) => {
  if (!url) return false;
  try {
    let target = String(url).trim();
    if (!/^https?:\/\/|^mailto:/i.test(target)) {
      target = 'https://' + target;
    }
    await shell.openExternal(target);
    return true;
  } catch (err) {
    console.error('Failed to open external URL:', err);
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

// ==========================================
// Vault Notes & Markdown System IPCs
// ==========================================

function getVaultNotesDirectory() {
  const vaultDir = getActiveVaultDirectory();
  const notesDir = path.join(vaultDir, 'notes');
  if (!fs.existsSync(notesDir)) {
    try {
      fs.mkdirSync(notesDir, { recursive: true });
    } catch (e) {
      console.error('Error creating notes directory:', e);
    }
  }
  return notesDir;
}

function parseNoteTags(content) {
  const tags = new Set();
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  let body = content;

  if (fmMatch) {
    body = content.substring(fmMatch[0].length);
    const fmLines = fmMatch[1].split('\n');
    let inTags = false;
    for (const fLine of fmLines) {
      const fTrim = fLine.trim();
      if (fTrim.startsWith('tags:')) {
        const inline = fTrim.replace(/^tags:\s*/, '').trim();
        if (inline.startsWith('[') && inline.endsWith(']')) {
          inline
            .slice(1, -1)
            .split(',')
            .forEach((t) => {
              const clean = t.trim().replace(/^['"#]+|['"]+$/g, '').toLowerCase();
              if (clean) tags.add(clean);
            });
          inTags = false;
        } else {
          inTags = true;
        }
      } else if (inTags && fTrim.startsWith('- ')) {
        const clean = fTrim.replace(/^-\s*/, '').replace(/^['"#]+|['"]+$/g, '').toLowerCase();
        if (clean) tags.add(clean);
      } else if (inTags && fTrim.includes(':')) {
        inTags = false;
      }
    }
  }

  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('# ') ||
      trimmed.startsWith('## ') ||
      trimmed.startsWith('### ') ||
      trimmed.startsWith('#### ') ||
      trimmed.startsWith('##### ') ||
      trimmed.startsWith('###### ')
    ) {
      continue;
    }
    const matches = line.match(/(?:^|\s)#([a-zA-Z0-9_\-\/]+)/g);
    if (matches) {
      for (const m of matches) {
        const tag = m.trim().replace(/^#/, '').toLowerCase();
        if (tag && !/^\d+$/.test(tag)) {
          tags.add(tag);
        }
      }
    }
  }
  return Array.from(tags);
}

function parseNoteTitle(content, fallbackName) {
  const match = content.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }
  return fallbackName.replace(/\.md$/i, '');
}

function scanNotesAndFolders(baseDir) {
  let notes = [];
  let folders = [];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        const relDir = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        if (relDir && relDir !== '.') {
          folders.push(relDir);
        }
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        try {
          const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          const rawFolder = path.dirname(relativePath).replace(/\\/g, '/');
          const folder = rawFolder === '.' ? '' : rawFolder;
          const content = fs.readFileSync(fullPath, 'utf-8');
          const stats = fs.statSync(fullPath);
          const title = parseNoteTitle(content, entry.name);
          const tags = parseNoteTags(content);

          const plainText = content
            .replace(/^#+\s+/gm, '')
            .replace(/\[\[(.*?)\]\]/g, '$1')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/[*_~`>]/g, '')
            .trim();
          const preview = plainText.slice(0, 150).replace(/\s+/g, ' ');

          notes.push({
            id: relativePath,
            title,
            fileName: entry.name,
            relativePath,
            folder,
            tags,
            preview,
            createdAt: stats.birthtime ? stats.birthtime.toISOString() : new Date().toISOString(),
            updatedAt: stats.mtime ? stats.mtime.toISOString() : new Date().toISOString(),
            size: stats.size,
          });
        } catch (err) {
          console.error('Error reading note file:', fullPath, err);
        }
      }
    }
  }

  walk(baseDir);
  return {
    notes,
    folders: Array.from(new Set(folders)).sort(),
  };
}

ipcMain.handle('notes-list', async () => {
  try {
    const notesDir = getVaultNotesDirectory();
    const files = fs.readdirSync(notesDir);
    if (files.length === 0) {
      const welcomePath = path.join(notesDir, 'Welcome to Albaqros Notes.md');
      const welcomeContent = `# Welcome to Albaqros Notes

Welcome to your personal **Notes & Knowledge Hub**! Everything you write is saved as genuine \`.md\` Markdown files directly inside your active Vault.

## Quick Tour
- [x] Full Markdown support (headers, bold, lists, and code blocks)
- [ ] Connect thoughts using **[[Wikilinks]]** (type \`[[\` in edit mode)
- [ ] Organize topics with tags like #learning #skills #gamedev #ideas
- [ ] Press \`Ctrl+E\` to toggle between **Edit Mode** and **Preview Mode**

## Obsidian & Cloud Storage Ready
Your notes reside directly in:
\`${notesDir}\`

You can open this folder inside Obsidian, VS Code, or let Google Drive / OneDrive sync your knowledge base automatically.
`;
      try {
        fs.writeFileSync(welcomePath, welcomeContent, 'utf-8');
      } catch (e) {}
    }

    const { notes, folders } = scanNotesAndFolders(notesDir);
    return { success: true, notes, folders, notesDir };
  } catch (err) {
    console.error('Error listing notes:', err);
    return { success: false, error: err.message, notes: [], folders: [] };
  }
});

ipcMain.handle('notes-read', async (_, relativePath) => {
  try {
    const notesDir = getVaultNotesDirectory();
    const safePath = path.normalize(path.join(notesDir, relativePath));
    if (!safePath.toLowerCase().startsWith(notesDir.toLowerCase())) {
      return { success: false, error: 'Access denied: path outside notes directory' };
    }
    if (!fs.existsSync(safePath)) {
      return { success: false, error: 'Note file not found' };
    }
    const content = fs.readFileSync(safePath, 'utf-8');
    const stats = fs.statSync(safePath);
    return {
      success: true,
      content,
      relativePath,
      fileName: path.basename(safePath),
      fullPath: safePath,
      updatedAt: stats.mtime ? stats.mtime.toISOString() : new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error reading note:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('notes-write', async (_, { relativePath, content }) => {
  try {
    const notesDir = getVaultNotesDirectory();
    const safePath = path.normalize(path.join(notesDir, relativePath));
    if (!safePath.toLowerCase().startsWith(notesDir.toLowerCase())) {
      return { success: false, error: 'Access denied: path outside notes directory' };
    }
    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    lastLocalSaveTime = Date.now();
    fs.writeFileSync(safePath, content, 'utf-8');
    return { success: true, relativePath, fullPath: safePath };
  } catch (err) {
    console.error('Error writing note:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('notes-create', async (_, { title, folder, content }) => {
  try {
    const notesDir = getVaultNotesDirectory();
    const cleanTitle = (title || 'Untitled Note').replace(/[\\/:*?"<>|]/g, '').trim();
    let fileName = cleanTitle.endsWith('.md') ? cleanTitle : `${cleanTitle}.md`;
    const targetFolder = folder ? folder.trim().replace(/^[/\\]+|[/\\]+$/g, '') : '';
    const targetDir = targetFolder ? path.join(notesDir, targetFolder) : notesDir;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let filePath = path.join(targetDir, fileName);
    let counter = 1;
    const baseName = fileName.replace(/\.md$/i, '');
    while (fs.existsSync(filePath)) {
      fileName = `${baseName} (${counter}).md`;
      filePath = path.join(targetDir, fileName);
      counter++;
    }

    const defaultContent = content !== undefined ? content : `# ${cleanTitle}\n\n`;
    lastLocalSaveTime = Date.now();
    fs.writeFileSync(filePath, defaultContent, 'utf-8');
    const relativePath = path.relative(notesDir, filePath).replace(/\\/g, '/');
    return { success: true, relativePath, fileName, content: defaultContent, fullPath: filePath };
  } catch (err) {
    console.error('Error creating note:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('notes-delete', async (_, relativePath) => {
  try {
    const notesDir = getVaultNotesDirectory();
    const safePath = path.normalize(path.join(notesDir, relativePath));
    if (!safePath.toLowerCase().startsWith(notesDir.toLowerCase())) {
      return { success: false, error: 'Access denied: path outside notes directory' };
    }
    if (fs.existsSync(safePath)) {
      lastLocalSaveTime = Date.now();
      fs.unlinkSync(safePath);
      return { success: true };
    }
    return { success: false, error: 'File does not exist' };
  } catch (err) {
    console.error('Error deleting note:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('notes-rename', async (_, { oldRelativePath, newTitle, newFolder }) => {
  try {
    const notesDir = getVaultNotesDirectory();
    const oldSafePath = path.normalize(path.join(notesDir, oldRelativePath));
    if (!oldSafePath.toLowerCase().startsWith(notesDir.toLowerCase()) || !fs.existsSync(oldSafePath)) {
      return { success: false, error: 'Original note not found' };
    }
    const cleanTitle = (newTitle || path.basename(oldRelativePath, '.md')).replace(/[\\/:*?"<>|]/g, '').trim();
    const fileName = `${cleanTitle}.md`;
    const targetFolder = newFolder !== undefined ? newFolder.trim().replace(/^[/\\]+|[/\\]+$/g, '') : path.dirname(oldRelativePath);
    const targetDir = targetFolder && targetFolder !== '.' ? path.join(notesDir, targetFolder) : notesDir;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    let finalFileName = fileName;
    let newSafePath = path.join(targetDir, finalFileName);
    if (oldSafePath.toLowerCase() !== newSafePath.toLowerCase() && fs.existsSync(newSafePath)) {
      let counter = 1;
      const baseName = cleanTitle;
      while (fs.existsSync(path.join(targetDir, `${baseName} (${counter}).md`))) {
        counter++;
      }
      finalFileName = `${baseName} (${counter}).md`;
      newSafePath = path.join(targetDir, finalFileName);
    }

    lastLocalSaveTime = Date.now();
    fs.renameSync(oldSafePath, newSafePath);
    const newRelativePath = path.relative(notesDir, newSafePath).replace(/\\/g, '/');
    return { success: true, relativePath: newRelativePath, fileName: finalFileName, fullPath: newSafePath };
  } catch (err) {
    console.error('Error renaming note:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('notes-create-folder', async (_, folderPath) => {
  try {
    const notesDir = getVaultNotesDirectory();
    const safePath = path.normalize(path.join(notesDir, folderPath));
    if (!safePath.toLowerCase().startsWith(notesDir.toLowerCase())) {
      return { success: false, error: 'Access denied' };
    }
    if (!fs.existsSync(safePath)) {
      fs.mkdirSync(safePath, { recursive: true });
    }
    return { success: true, folder: path.relative(notesDir, safePath).replace(/\\/g, '/') };
  } catch (err) {
    console.error('Error creating folder:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('notes-open-folder', async (_, relativePath) => {
  try {
    const notesDir = getVaultNotesDirectory();
    const target = relativePath ? path.join(notesDir, relativePath) : notesDir;
    if (fs.existsSync(target)) {
      await shell.openPath(target);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error opening notes folder:', err);
    return false;
  }
});

// ==========================================
// Vault Canvas System IPCs (Obsidian Canvas)
// ==========================================

function getVaultCanvasDirectory() {
  const vaultDir = getActiveVaultDirectory();
  const canvasDir = path.join(vaultDir, 'canvas');
  if (!fs.existsSync(canvasDir)) {
    try {
      fs.mkdirSync(canvasDir, { recursive: true });
    } catch (e) {
      console.error('Error creating canvas directory:', e);
    }
  }
  return canvasDir;
}

function scanCanvasAndFolders(baseDir) {
  let canvases = [];
  let folders = [];

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        const relDir = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        if (relDir && relDir !== '.') {
          folders.push(relDir);
        }
        walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.canvas') || entry.name.endsWith('.json'))) {
        try {
          const stats = fs.statSync(fullPath);
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          const folder = relPath.includes('/') ? relPath.substring(0, relPath.lastIndexOf('/')) : '';
          const title = entry.name.replace(/\.(canvas|json)$/i, '');

          let nodeCount = 0;
          try {
            const raw = fs.readFileSync(fullPath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.nodes)) nodeCount = parsed.nodes.length;
          } catch (e) {}

          canvases.push({
            id: relPath,
            title,
            fileName: entry.name,
            relativePath: relPath,
            folder,
            createdAt: stats.birthtime ? stats.birthtime.toISOString() : new Date().toISOString(),
            updatedAt: stats.mtime ? stats.mtime.toISOString() : new Date().toISOString(),
            nodeCount,
          });
        } catch (e) {
          console.error('Error reading canvas entry:', e);
        }
      }
    }
  }

  walk(baseDir);
  return {
    canvases: canvases.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    folders: Array.from(new Set(folders)).sort(),
  };
}

ipcMain.handle('canvas-list', async () => {
  try {
    const canvasDir = getVaultCanvasDirectory();
    const files = fs.readdirSync(canvasDir);
    if (files.length === 0) {
      const welcomePath = path.join(canvasDir, 'Welcome to Albaqros Canvas.canvas');
      const starterData = {
        nodes: [
          {
            id: 'welcome-card',
            type: 'text',
            x: -250,
            y: -120,
            width: 340,
            height: 220,
            color: 'blue',
            text: '### 🎨 Welcome to Canvas!\n\nThis is your infinite visual workspace inspired by **Obsidian Canvas**.\n\n- 🖼️ Add images, scale & resize them\n- 📝 Type cards, notes & ideas\n- 🔗 Connect cards with arrows\n- 📁 Put them in folders just like notes',
          },
          {
            id: 'shortcuts-card',
            type: 'text',
            x: 200,
            y: -120,
            width: 320,
            height: 220,
            color: 'purple',
            text: '### ⚡ Quick Navigation\n\n- **Pan**: Hold `Space` + Drag or Middle Click\n- **Zoom**: Mouse Wheel or `+` / `-` buttons\n- **Scale**: Drag any card corner or edge\n- **Connect**: Drag from side dots to link cards',
          },
          {
            id: 'ideas-card',
            type: 'text',
            x: -30,
            y: 180,
            width: 300,
            height: 180,
            color: 'green',
            text: '### 💡 Infinite Uses\n\n- Moodboards & concept art\n- Project pipelines & mindmaps\n- Game design schematics\n- Brainstorming & study flows',
          },
        ],
        edges: [
          {
            id: 'edge-1',
            fromNode: 'welcome-card',
            fromSide: 'right',
            toNode: 'shortcuts-card',
            toSide: 'left',
            label: 'navigation',
          },
          {
            id: 'edge-2',
            fromNode: 'shortcuts-card',
            fromSide: 'bottom',
            toNode: 'ideas-card',
            toSide: 'top',
          },
        ],
        viewport: {
          x: 0,
          y: 0,
          zoom: 1,
        },
      };
      try {
        fs.writeFileSync(welcomePath, JSON.stringify(starterData, null, 2), 'utf-8');
      } catch (e) {}
    }

    const { canvases, folders } = scanCanvasAndFolders(canvasDir);
    return { success: true, canvases, folders, canvasDir };
  } catch (err) {
    console.error('Error listing canvases:', err);
    return { success: false, error: err.message, canvases: [], folders: [] };
  }
});

ipcMain.handle('canvas-read', async (_, relativePath) => {
  try {
    const canvasDir = getVaultCanvasDirectory();
    const safePath = path.normalize(path.join(canvasDir, relativePath));
    if (!safePath.toLowerCase().startsWith(canvasDir.toLowerCase())) {
      return { success: false, error: 'Access denied' };
    }
    if (!fs.existsSync(safePath)) {
      return { success: false, error: 'Canvas file not found' };
    }
    const raw = fs.readFileSync(safePath, 'utf-8');
    const data = JSON.parse(raw);
    const stats = fs.statSync(safePath);
    return {
      success: true,
      data,
      relativePath,
      fileName: path.basename(safePath),
      fullPath: safePath,
      updatedAt: stats.mtime ? stats.mtime.toISOString() : new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error reading canvas:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('canvas-write', async (_, { relativePath, data }) => {
  try {
    const canvasDir = getVaultCanvasDirectory();
    const safePath = path.normalize(path.join(canvasDir, relativePath));
    if (!safePath.toLowerCase().startsWith(canvasDir.toLowerCase())) {
      return { success: false, error: 'Access denied' };
    }
    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    lastLocalSaveTime = Date.now();
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    fs.writeFileSync(safePath, content, 'utf-8');
    return { success: true, relativePath, fullPath: safePath };
  } catch (err) {
    console.error('Error writing canvas:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('canvas-create', async (_, { title, folder, initialData }) => {
  try {
    const canvasDir = getVaultCanvasDirectory();
    const cleanTitle = (title || 'Untitled Canvas').replace(/[\\/:*?"<>|]/g, '').trim();
    let fileName = cleanTitle.endsWith('.canvas') ? cleanTitle : `${cleanTitle}.canvas`;
    const targetFolder = folder ? folder.trim().replace(/^[/\\]+|[/\\]+$/g, '') : '';
    const targetDir = targetFolder ? path.join(canvasDir, targetFolder) : canvasDir;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let filePath = path.join(targetDir, fileName);
    let counter = 1;
    const baseName = fileName.replace(/\.canvas$/i, '');
    while (fs.existsSync(filePath)) {
      fileName = `${baseName} (${counter}).canvas`;
      filePath = path.join(targetDir, fileName);
      counter++;
    }

    const defaultData = initialData || {
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    lastLocalSaveTime = Date.now();
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
    const relativePath = path.relative(canvasDir, filePath).replace(/\\/g, '/');
    return { success: true, relativePath, fileName, data: defaultData, fullPath: filePath };
  } catch (err) {
    console.error('Error creating canvas:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('canvas-delete', async (_, relativePath) => {
  try {
    const canvasDir = getVaultCanvasDirectory();
    const safePath = path.normalize(path.join(canvasDir, relativePath));
    if (!safePath.toLowerCase().startsWith(canvasDir.toLowerCase())) {
      return { success: false, error: 'Access denied' };
    }
    if (fs.existsSync(safePath)) {
      lastLocalSaveTime = Date.now();
      fs.unlinkSync(safePath);
      return { success: true };
    }
    return { success: false, error: 'File does not exist' };
  } catch (err) {
    console.error('Error deleting canvas:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('canvas-rename', async (_, { oldRelativePath, newTitle, newFolder }) => {
  try {
    const canvasDir = getVaultCanvasDirectory();
    const oldSafePath = path.normalize(path.join(canvasDir, oldRelativePath));
    if (!oldSafePath.toLowerCase().startsWith(canvasDir.toLowerCase()) || !fs.existsSync(oldSafePath)) {
      return { success: false, error: 'Original canvas not found' };
    }
    const cleanTitle = (newTitle || path.basename(oldRelativePath, '.canvas')).replace(/[\\/:*?"<>|]/g, '').trim();
    const fileName = `${cleanTitle}.canvas`;
    const targetFolder = newFolder !== undefined ? newFolder.trim().replace(/^[/\\]+|[/\\]+$/g, '') : path.dirname(oldRelativePath);
    const targetDir = targetFolder && targetFolder !== '.' ? path.join(canvasDir, targetFolder) : canvasDir;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    let finalFileName = fileName;
    let newSafePath = path.join(targetDir, finalFileName);
    if (oldSafePath.toLowerCase() !== newSafePath.toLowerCase() && fs.existsSync(newSafePath)) {
      let counter = 1;
      const baseName = cleanTitle;
      while (fs.existsSync(path.join(targetDir, `${baseName} (${counter}).canvas`))) {
        counter++;
      }
      finalFileName = `${baseName} (${counter}).canvas`;
      newSafePath = path.join(targetDir, finalFileName);
    }

    lastLocalSaveTime = Date.now();
    fs.renameSync(oldSafePath, newSafePath);
    const newRelativePath = path.relative(canvasDir, newSafePath).replace(/\\/g, '/');
    return { success: true, relativePath: newRelativePath, fileName: finalFileName, fullPath: newSafePath };
  } catch (err) {
    console.error('Error renaming canvas:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('canvas-create-folder', async (_, folderPath) => {
  try {
    const canvasDir = getVaultCanvasDirectory();
    const safePath = path.normalize(path.join(canvasDir, folderPath));
    if (!safePath.toLowerCase().startsWith(canvasDir.toLowerCase())) {
      return { success: false, error: 'Access denied' };
    }
    if (!fs.existsSync(safePath)) {
      fs.mkdirSync(safePath, { recursive: true });
    }
    return { success: true, folder: path.relative(canvasDir, safePath).replace(/\\/g, '/') };
  } catch (err) {
    console.error('Error creating canvas folder:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('canvas-open-folder', async (_, relativePath) => {
  try {
    const canvasDir = getVaultCanvasDirectory();
    const target = relativePath ? path.join(canvasDir, relativePath) : canvasDir;
    if (fs.existsSync(target)) {
      await shell.openPath(target);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error opening canvas folder:', err);
    return false;
  }
});

ipcMain.handle('clipboard-read-image', async () => {
  try {
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      const size = image.getSize();
      return {
        success: true,
        dataUrl: image.toDataURL(),
        width: size.width,
        height: size.height,
        aspectRatio: size.width / (size.height || 1),
      };
    }

    // Check if clipboard contains a copied image file path (e.g. from Windows Explorer)
    const text = clipboard.readText();
    if (text) {
      const cleanPath = text.startsWith('file://') ? decodeURI(text.replace(/^file:\/\/\/?/, '')) : text.trim();
      const ext = path.extname(cleanPath).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'].includes(ext) && fs.existsSync(cleanPath)) {
        const fileBuf = fs.readFileSync(cleanPath);
        const mime =
          ext === '.svg'
            ? 'image/svg+xml'
            : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : `image/${ext.slice(1)}`;
        return {
          success: true,
          dataUrl: `data:${mime};base64,${fileBuf.toString('base64')}`,
          fileName: path.basename(cleanPath),
        };
      }
    }

    return { success: false, error: 'No image found on clipboard' };
  } catch (err) {
    console.error('Error reading clipboard image:', err);
    return { success: false, error: err.message };
  }
});

// ==========================================
// In-App Patcher & Auto-Updater Integration
// ==========================================

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let latestAvailableVersion = null;
let downloadedFallbackPath = null;
let isFallbackDownloading = false;

function sendUpdaterStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater-status', payload);
  }
}

async function fallbackDownloadInstaller(targetVersion) {
  if (isFallbackDownloading) return false;
  isFallbackDownloading = true;
  try {
    sendUpdaterStatus({ state: 'downloading', progress: 0 });
    const tag = targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`;
    const apiRes = await fetch(`https://api.github.com/repos/gugut2/albaqros/releases/tags/${tag}`, {
      headers: { 'User-Agent': 'Albaqros-App' },
    });
    if (!apiRes.ok) {
      throw new Error(`GitHub release ${tag} not found (HTTP ${apiRes.status})`);
    }
    const releaseData = await apiRes.json();
    const assets = releaseData.assets || [];
    // Prioritize Albaqros-Setup or Albaqros.Setup or any .exe installer (excluding blockmap)
    const exeAsset = assets.find(
      (a) => a.name.toLowerCase().endsWith('.exe') && !a.name.toLowerCase().includes('blockmap')
    );
    if (!exeAsset || !exeAsset.browser_download_url) {
      throw new Error(`No installer executable (.exe) found in release ${tag}`);
    }

    const tempDir = app.getPath('temp');
    const destPath = path.join(tempDir, exeAsset.name);

    const downloadRes = await fetch(exeAsset.browser_download_url, {
      headers: { 'User-Agent': 'Albaqros-App' },
      redirect: 'follow',
    });
    if (!downloadRes.ok) {
      throw new Error(`Failed to download installer from GitHub (HTTP ${downloadRes.status})`);
    }

    const totalBytes = Number(downloadRes.headers.get('content-length')) || exeAsset.size || 0;
    const fileStream = fs.createWriteStream(destPath);
    const reader = downloadRes.body.getReader();
    let transferred = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(value);
      transferred += value.length;
      if (totalBytes > 0) {
        const percent = Math.min(100, Math.round((transferred / totalBytes) * 100));
        sendUpdaterStatus({
          state: 'downloading',
          progress: percent,
          transferred,
          total: totalBytes,
        });
      }
    }
    fileStream.end();

    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });

    downloadedFallbackPath = destPath;
    sendUpdaterStatus({
      state: 'downloaded',
      version: targetVersion,
    });
    return true;
  } catch (err) {
    console.error('Fallback download failed:', err);
    sendUpdaterStatus({
      state: 'error',
      error: `Patch download failed: ${err.message}`,
    });
    return false;
  } finally {
    isFallbackDownloading = false;
  }
}

autoUpdater.on('checking-for-update', () => {
  sendUpdaterStatus({ state: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  latestAvailableVersion = info.version;
  downloadedFallbackPath = null;
  sendUpdaterStatus({
    state: 'available',
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
  });
});

autoUpdater.on('update-not-available', (info) => {
  sendUpdaterStatus({
    state: 'not-available',
    version: info?.version,
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  sendUpdaterStatus({
    state: 'downloading',
    progress: Math.round(progressObj.percent || 0),
    bytesPerSecond: progressObj.bytesPerSecond,
    transferred: progressObj.transferred,
    total: progressObj.total,
  });
});

autoUpdater.on('update-downloaded', (info) => {
  sendUpdaterStatus({
    state: 'downloaded',
    version: info?.version,
  });
});

autoUpdater.on('error', async (err) => {
  console.error('autoUpdater error:', err);
  // If download failed and we know the target version, attempt smart fallback
  if (latestAvailableVersion && !downloadedFallbackPath && !isFallbackDownloading) {
    console.log(`[Updater] Attempting fallback installer download for v${latestAvailableVersion}...`);
    const ok = await fallbackDownloadInstaller(latestAvailableVersion);
    if (ok) return;
  }
  sendUpdaterStatus({
    state: 'error',
    error: err ? err.message : 'Unknown updater error',
  });
});

ipcMain.handle('app-get-version', () => {
  return app.getVersion();
});

ipcMain.handle('updater-check', async () => {
  try {
    const isDev = Boolean(process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development' || !app.isPackaged);
    if (isDev) {
      sendUpdaterStatus({ state: 'checking' });
      setTimeout(() => {
        sendUpdaterStatus({
          state: 'not-available',
          version: app.getVersion(),
          releaseNotes: 'You are running the development build of Albaqros. Automatic GitHub updates run in packaged builds.',
        });
      }, 750);
      return { success: true, isDev: true };
    }
    const result = await autoUpdater.checkForUpdates();
    return { success: true, result };
  } catch (err) {
    console.error('Error checking for updates:', err);
    sendUpdaterStatus({ state: 'error', error: err.message });
    return { success: false, error: err.message };
  }
});

ipcMain.handle('updater-download', async () => {
  try {
    const isDev = Boolean(process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development' || !app.isPackaged);
    if (isDev) {
      // Simulate download progress for previewing UI in dev mode
      sendUpdaterStatus({ state: 'downloading', progress: 10 });
      setTimeout(() => sendUpdaterStatus({ state: 'downloading', progress: 50 }), 400);
      setTimeout(() => sendUpdaterStatus({ state: 'downloading', progress: 100 }), 800);
      setTimeout(() => sendUpdaterStatus({ state: 'downloaded', version: '1.3.1' }), 1000);
      return { success: true, isDev: true };
    }

    if (downloadedFallbackPath && fs.existsSync(downloadedFallbackPath)) {
      sendUpdaterStatus({ state: 'downloaded', version: latestAvailableVersion });
      return { success: true };
    }

    // Try standard autoUpdater download first
    await autoUpdater.downloadUpdate().catch(async (err) => {
      console.warn('Standard autoUpdater.downloadUpdate failed, attempting fallback:', err.message);
      if (latestAvailableVersion) {
        await fallbackDownloadInstaller(latestAvailableVersion);
      } else {
        throw err;
      }
    });
    return { success: true };
  } catch (err) {
    console.error('Error downloading update:', err);
    sendUpdaterStatus({ state: 'error', error: err.message });
    return { success: false, error: err.message };
  }
});

ipcMain.handle('updater-install', () => {
  if (downloadedFallbackPath && fs.existsSync(downloadedFallbackPath)) {
    const { spawn } = require('child_process');
    spawn(downloadedFallbackPath, ['--updated'], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    app.quit();
  } else {
    autoUpdater.quitAndInstall(false, true);
  }
});

app.whenReady().then(() => {
  createWindow();
  setupTray();

  // Check for updates automatically in background 4 seconds after launch (when packaged)
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn('Initial background update check skipped:', err.message);
      });
    }, 4000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
