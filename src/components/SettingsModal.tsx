import React, { useState, useEffect } from 'react';
import { Settings, Folder, Cloud, Download, Monitor, Pin, X, Check, ShieldCheck, ExternalLink } from 'lucide-react';
import { AppData, AppSettings, VaultInfo } from '../types';
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

  useEffect(() => {
    // If electron is available, check native auto-launch state and storage path
    if (typeof window !== 'undefined' && (window as any).electronAPI?.getStorageInfo) {
      (window as any).electronAPI.getStorageInfo().then((info: any) => {
        if (info?.filePath) setCurrentPath(info.filePath);
      });
      (window as any).electronAPI.getAutoLaunch().then((launch: boolean) => {
        setRunOnStartup(launch);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
