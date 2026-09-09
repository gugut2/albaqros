import React, { useState, useEffect } from 'react';
import { Settings, Folder, Cloud, Download, Monitor, Pin, X, Check, ShieldCheck, ExternalLink, Sparkles, RefreshCw, ArrowUpCircle, AlertTriangle } from 'lucide-react';
import { AppData, AppSettings, VaultInfo, UpdateInfo } from '../types';
import { StorageService } from '../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  data: AppData;
  vaultInfo?: VaultInfo | null;
  onOpenVaultModal?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  data,
  vaultInfo,
  onOpenVaultModal,
}) => {
  const [currentPath, setCurrentPath] = useState(settings.storagePath || 'Default User Data Directory');
  const [runOnStartup, setRunOnStartup] = useState(settings.runOnStartup);
  const [alwaysOnTop, setAlwaysOnTop] = useState(settings.alwaysOnTop);
  const [savedNotice, setSavedNotice] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({ state: 'idle' });

  useEffect(() => {
    // If electron is available, check native auto-launch state, version, and storage path
    if (typeof window !== 'undefined') {
      if ((window as any).electronAPI?.getStorageInfo) {
        (window as any).electronAPI.getStorageInfo().then((info: any) => {
          if (info?.filePath) setCurrentPath(info.filePath);
        });
      }
      if ((window as any).electronAPI?.getAutoLaunch) {
        (window as any).electronAPI.getAutoLaunch().then((launch: boolean) => {
          setRunOnStartup(launch);
        });
      }
      StorageService.getAppVersion().then(setAppVersion);

      const unsubscribe = StorageService.onUpdaterStatus((info) => {
        setUpdateInfo(info);
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheckForUpdates = async () => {
    setUpdateInfo({ state: 'checking' });
    const res = await StorageService.checkForUpdates();
    if (res && !res.success && res.error) {
      setUpdateInfo({ state: 'error', error: res.error });
    }
  };

  const handleDownloadUpdate = async () => {
    setUpdateInfo((prev) => ({ ...prev, state: 'downloading', progress: 0 }));
    const res = await StorageService.downloadUpdate();
    if (res && !res.success && res.error) {
      setUpdateInfo({ state: 'error', error: res.error });
    }
  };

  const handleInstallUpdate = async () => {
    await StorageService.installUpdate();
  };

  const handleSelectFolder = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.selectStorageDirectory) {
      const selected = await (window as any).electronAPI.selectStorageDirectory();
      if (selected) {
        setCurrentPath(selected);
        onUpdateSettings({ ...settings, storagePath: selected });
        showSaved();
      }
    } else {
      alert('In the desktop version, you can select any Google Drive or OneDrive folder.');
    }
  };

  const handleToggleStartup = async (val: boolean) => {
    setRunOnStartup(val);
    if (typeof window !== 'undefined' && (window as any).electronAPI?.setAutoLaunch) {
      await (window as any).electronAPI.setAutoLaunch(val);
    }
    onUpdateSettings({ ...settings, runOnStartup: val });
    showSaved();
  };

  const handleToggleAlwaysOnTop = (val: boolean) => {
    setAlwaysOnTop(val);
    if (typeof window !== 'undefined' && (window as any).electronAPI?.setAlwaysOnTop) {
      (window as any).electronAPI.setAlwaysOnTop(val);
    }
    onUpdateSettings({ ...settings, alwaysOnTop: val });
    showSaved();
  };

  const showSaved = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '24px',
          backgroundColor: '#12161f',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <Settings size={16} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Settings & Sync</h3>
          </div>
          <button type="button" onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Cloud Sync & Vault Storage Section */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'rgba(99, 102, 241, 0.05)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#818cf8" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Active Storage Vault
                </span>
              </div>
              {onOpenVaultModal && (
                <button
                  type="button"
                  onClick={onOpenVaultModal}
                  className="btn-primary"
                  style={{ fontSize: '0.75rem', padding: '5px 10px', gap: '6px' }}
                >
                  <Folder size={12} /> Manage Vault...
                </button>
              )}
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.4 }}>
              Albaqros saves all tasks, notes, journal entries, and tracked metrics inside your chosen vault folder. When placed in Google Drive or OneDrive, it auto-syncs across computers.
            </p>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '7px 10px',
                  fontSize: '0.775rem',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-mono)',
                }}
                title={vaultInfo?.path || currentPath}
              >
                {vaultInfo?.path || currentPath}
              </div>
              <button
                type="button"
                onClick={handleSelectFolder}
                className="btn-secondary"
                style={{ fontSize: '0.775rem', padding: '7px 12px', flexShrink: 0 }}
                title="Browse for folder"
              >
                <Folder size={13} /> Browse...
              </button>
            </div>
          </div>

          {/* Desktop Integrations */}
          <div
            style={{
              padding: '14px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Monitor size={15} color="#a855f7" /> Desktop Behaviors
            </span>

            {/* Launch on Startup Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>Open on Windows Startup</div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                  Launches automatically in minimal widget mode when your PC starts
                </div>
              </div>
              <input
                type="checkbox"
                checked={runOnStartup}
                onChange={(e) => handleToggleStartup(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }}
              />
            </label>

            {/* Always on Top */}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-primary)' }}>Keep Widget Always on Top</div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                  Floating widget stays visible above other windows
                </div>
              </div>
              <input
                type="checkbox"
                checked={alwaysOnTop}
                onChange={(e) => handleToggleAlwaysOnTop(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#6366f1', cursor: 'pointer' }}
              />
            </label>
          </div>

          {/* App Version & Auto-Patcher */}
          <div
            style={{
              padding: '14px',
              backgroundColor: 'rgba(56, 189, 248, 0.04)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(56, 189, 248, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={15} color="#38bdf8" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  App Version & Auto-Patcher
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                v{appVersion}
              </span>
            </div>

            {/* State: Idle */}
            {updateInfo.state === 'idle' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Checks GitHub Releases for new updates and delta patches.
                </span>
                <button
                  type="button"
                  onClick={handleCheckForUpdates}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '5px 10px', gap: '5px', flexShrink: 0 }}
                >
                  <RefreshCw size={12} /> Check for Updates
                </button>
              </div>
            )}

            {/* State: Checking */}
            {updateInfo.state === 'checking' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                <RefreshCw size={13} color="#38bdf8" className="animate-spin" />
                <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                  Checking GitHub Releases for new versions...
                </span>
              </div>
            )}

            {/* State: Up to Date */}
            {updateInfo.state === 'not-available' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} color="#34d399" />
                  <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 500 }}>
                    Albaqros is up to date (v{appVersion})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCheckForUpdates}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Check again
                </button>
              </div>
            )}

            {/* State: Update Available */}
            {updateInfo.state === 'available' && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#818cf8" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff' }}>
                      New Version Available: v{updateInfo.version}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadUpdate}
                    className="btn-primary"
                    style={{ fontSize: '0.75rem', padding: '4px 10px', gap: '5px' }}
                  >
                    <Download size={12} /> Download Patch
                  </button>
                </div>
                {updateInfo.releaseNotes && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.3 }}>
                    {updateInfo.releaseNotes}
                  </p>
                )}
              </div>
            )}

            {/* State: Downloading */}
            {updateInfo.state === 'downloading' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.725rem' }}>
                  <span style={{ color: '#38bdf8' }}>Downloading patch...</span>
                  <span style={{ fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                    {updateInfo.progress || 0}%
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '3px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${updateInfo.progress || 0}%`,
                      backgroundColor: '#38bdf8',
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* State: Downloaded / Ready to Install */}
            {updateInfo.state === 'downloaded' && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(52, 211, 153, 0.12)',
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399' }}>
                    Patch Downloaded!
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Restart Albaqros to apply the update immediately.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleInstallUpdate}
                  className="btn-primary"
                  style={{
                    backgroundColor: '#10b981',
                    fontSize: '0.75rem',
                    padding: '6px 12px',
                    gap: '5px',
                    boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
                  }}
                >
                  <ArrowUpCircle size={14} /> Restart & Apply
                </button>
              </div>
            )}

            {/* State: Error */}
            {updateInfo.state === 'error' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={13} color="#f87171" />
                  <span style={{ fontSize: '0.725rem', color: '#f87171' }}>
                    {updateInfo.error || 'Failed to check for updates'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCheckForUpdates}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* Backup & Export */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => StorageService.downloadBackup(data)}
              className="btn-secondary"
              style={{ fontSize: '0.775rem' }}
            >
              <Download size={13} /> Export JSON Backup
            </button>

            {savedNotice && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#10b981' }}>
                <Check size={13} /> Settings saved!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
