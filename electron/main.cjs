const { app, BrowserWindow, ipcMain, dialog, screen, Tray, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('Albaqros');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.albaqros.app');
}

let mainWindow = null;
let isCompact = false;
let customStoragePath = '';
let fileWatcher = null;
let tray = null;

const DEFAULT_DATA_FILENAME = 'productivity-data.json';

function getDefaultStoragePath() {
  return path.join(app.getPath('userData'), DEFAULT_DATA_FILENAME);
}

function getActiveFilePath() {
  if (customStoragePath && fs.existsSync(customStoragePath)) {
    // If it's a directory, join with filename
    const stat = fs.statSync(customStoragePath);
    if (stat.isDirectory()) {
      return path.join(customStoragePath, DEFAULT_DATA_FILENAME);
    }
    return customStoragePath;
  }
  return getDefaultStoragePath();
}

function setupFileWatcher(filePath) {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
  try {
    if (fs.existsSync(filePath)) {
      fileWatcher = fs.watch(filePath, (eventType) => {
        if (eventType === 'change' && mainWindow) {
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
  setupFileWatcher(getActiveFilePath());
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

// Storage IPCs
ipcMain.handle('load-data', async () => {
  const filePath = getActiveFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading data file:', err);
  }
  return null;
});

ipcMain.handle('save-data', async (_, data) => {
  const filePath = getActiveFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Atomic write via temp file
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
    return { success: true, path: filePath };
  } catch (err) {
    console.error('Error saving data file:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('select-storage-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Cloud Sync Folder (Google Drive / OneDrive)',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    customStoragePath = result.filePaths[0];
    const newFilePath = getActiveFilePath();
    setupFileWatcher(newFilePath);
    return customStoragePath;
  }
  return null;
});

ipcMain.handle('get-storage-info', () => {
  return {
    filePath: getActiveFilePath(),
    isCustom: Boolean(customStoragePath),
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
