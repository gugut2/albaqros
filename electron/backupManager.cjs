const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');

const PRIMARY_DATA_FILENAME = 'albaqros-data.json';
const BACKUPS_DIR_NAME = 'backups';
const MAX_ROLLING_BACKUPS = 40;

function getUserDataPath() {
  if (app && typeof app.getPath === 'function') {
    try {
      return app.getPath('userData');
    } catch (e) {}
  }
  const base = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Application Support') : path.join(process.env.HOME || '', '.config'));
  return path.join(base, 'Albaqros');
}

function getEmergencyBackupsDir() {
  const dir = path.join(getUserDataPath(), 'emergency-backups');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error('[BackupManager] Failed to create emergency-backups directory:', e);
    }
  }
  return dir;
}

function getVaultBackupsDir(vaultDir) {
  if (!vaultDir) return null;
  const dir = path.join(vaultDir, BACKUPS_DIR_NAME);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      console.error('[BackupManager] Failed to create vault backups directory:', e);
    }
  }
  return dir;
}

function safeWriteFileSync(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${filePath}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempPath, content, 'utf-8');
    try {
      fs.renameSync(tempPath, filePath);
    } catch (renameErr) {
      // Common with cloud sync drivers (Google Drive G:\, OneDrive) locking files
      fs.writeFileSync(filePath, content, 'utf-8');
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (e) {}
    }
  } catch (err) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

function formatTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

function pruneBackups(dirPath, maxCount = MAX_ROLLING_BACKUPS) {
  if (!dirPath || !fs.existsSync(dirPath)) return;
  try {
    const files = fs.readdirSync(dirPath)
      .filter((f) => f.endsWith('.json') && f !== 'latest.json')
      .map((f) => {
        const full = path.join(dirPath, f);
        const stat = fs.statSync(full);
        return { name: f, path: full, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length <= maxCount) return;

    // Keep the latest maxCount, but preserve at least 1 backup per day
    const keepPaths = new Set(files.slice(0, maxCount).map((f) => f.path));
    const seenDays = new Set();

    for (const file of files) {
      const dayMatch = file.name.match(/\d{4}-\d{2}-\d{2}/);
      if (dayMatch) {
        const day = dayMatch[0];
        if (!seenDays.has(day)) {
          seenDays.add(day);
          keepPaths.add(file.path);
        }
      }
    }

    for (const file of files) {
      if (!keepPaths.has(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('[BackupManager] Failed to prune backups in', dirPath, err);
  }
}

function createBackup(vaultDir, data, reason = 'auto') {
  if (!data) return null;

  const timestamp = formatTimestamp();
  const serialized = JSON.stringify(data, null, 2);
  const taskCount = Array.isArray(data.tasks) ? data.tasks.length : 0;
  const majorTaskCount = Array.isArray(data.majorTasks) ? data.majorTasks.length : 0;
  const entryCount = data.entries ? Object.keys(data.entries).length : 0;

  const fileName = `albaqros-backup-${timestamp}${reason !== 'auto' ? `-${reason}` : ''}.json`;

  const results = {
    timestamp,
    fileName,
    taskCount,
    majorTaskCount,
    entryCount,
    vaultBackupPath: null,
    emergencyBackupPath: null,
  };

  // 1. Vault Backup (Syncs with Cloud Vault)
  if (vaultDir && fs.existsSync(vaultDir)) {
    try {
      const vDir = getVaultBackupsDir(vaultDir);
      if (vDir) {
        const backupPath = path.join(vDir, fileName);
        safeWriteFileSync(backupPath, serialized);
        safeWriteFileSync(path.join(vDir, 'latest.json'), serialized);
        pruneBackups(vDir, MAX_ROLLING_BACKUPS);
        results.vaultBackupPath = backupPath;
      }
    } catch (err) {
      console.error('[BackupManager] Failed to create vault backup:', err);
    }
  }

  // 2. Local Emergency Air-Gap Backup (Completely independent of cloud drive)
  try {
    const emergDir = getEmergencyBackupsDir();
    const emergPath = path.join(emergDir, fileName);
    safeWriteFileSync(emergPath, serialized);
    safeWriteFileSync(path.join(emergDir, 'latest.json'), serialized);
    pruneBackups(emergDir, MAX_ROLLING_BACKUPS);
    results.emergencyBackupPath = emergPath;
  } catch (err) {
    console.error('[BackupManager] Failed to create emergency backup:', err);
  }

  return results;
}

function listBackups(vaultDir) {
  const backups = [];
  const seenNames = new Set();

  function scanDir(dirPath, source) {
    if (!dirPath || !fs.existsSync(dirPath)) return;
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        if (!file.endsWith('.json') || file === 'latest.json') continue;
        const filePath = path.join(dirPath, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.size < 10) continue;

          let taskCount = 0;
          let majorTaskCount = 0;
          let entryCount = 0;
          let version = 1;

          try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            taskCount = Array.isArray(parsed.tasks) ? parsed.tasks.length : 0;
            majorTaskCount = Array.isArray(parsed.majorTasks) ? parsed.majorTasks.length : 0;
            entryCount = parsed.entries ? Object.keys(parsed.entries).length : 0;
            version = parsed.version || 1;
          } catch (e) {
            // If json parse fails, still register the file with 0
          }

          const id = `${source}:${file}`;
          if (!seenNames.has(id)) {
            seenNames.add(id);
            backups.push({
              id,
              fileName: file,
              filePath,
              source, // 'vault' | 'emergency'
              timestamp: stat.mtime.toISOString(),
              sizeBytes: stat.size,
              taskCount,
              majorTaskCount,
              entryCount,
              version,
            });
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('[BackupManager] Error reading dir:', dirPath, err);
    }
  }

  // Scan vault backups
  if (vaultDir) {
    scanDir(path.join(vaultDir, BACKUPS_DIR_NAME), 'vault');
  }

  // Scan emergency backups
  scanDir(getEmergencyBackupsDir(), 'emergency');

  // Sort descending by timestamp
  backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return backups;
}

function restoreBackup(backupFilePath, vaultDir) {
  if (!backupFilePath || !fs.existsSync(backupFilePath)) {
    throw new Error('Backup file does not exist: ' + backupFilePath);
  }

  const raw = fs.readFileSync(backupFilePath, 'utf-8');
  const parsedData = JSON.parse(raw);

  if (!parsedData || typeof parsedData !== 'object') {
    throw new Error('Invalid backup file content');
  }

  // Before restoring, take a safety backup of current state if exists
  if (vaultDir && fs.existsSync(vaultDir)) {
    const primaryPath = path.join(vaultDir, PRIMARY_DATA_FILENAME);
    if (fs.existsSync(primaryPath)) {
      try {
        const currentRaw = fs.readFileSync(primaryPath, 'utf-8');
        const currentData = JSON.parse(currentRaw);
        createBackup(vaultDir, currentData, 'pre-restore');
      } catch (e) {}
    }

    // Write restored data
    safeWriteFileSync(primaryPath, JSON.stringify(parsedData, null, 2));
  }

  // Also update emergency latest.json
  createBackup(vaultDir, parsedData, 'restored');
  return parsedData;
}

function openBackupsFolder(vaultDir, location = 'vault') {
  let targetDir = null;
  if (location === 'emergency') {
    targetDir = getEmergencyBackupsDir();
  } else {
    targetDir = vaultDir ? path.join(vaultDir, BACKUPS_DIR_NAME) : getEmergencyBackupsDir();
  }

  if (targetDir && fs.existsSync(targetDir)) {
    shell.openPath(targetDir);
    return true;
  }
  return false;
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  openBackupsFolder,
  safeWriteFileSync,
  getEmergencyBackupsDir,
  getVaultBackupsDir,
};
