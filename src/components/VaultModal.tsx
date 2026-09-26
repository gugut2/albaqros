import React, { useState, useEffect } from 'react';
import {
  X,
  Folder,
  FolderPlus,
  FolderOpen,
  Cloud,
  Check,
  RefreshCw,
  Copy,
  Sparkles,
  ArrowRight,
  Clock,
  ShieldCheck,
  FileText,
  Database,
  RotateCcw,
  AlertTriangle,
  HardDrive,
  Download,
} from 'lucide-react';
import { AppData, VaultInfo, BackupSnapshot } from '../types';
import { StorageService } from '../services/storage';

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultInfo: VaultInfo | null;
  onVaultChanged: (newVaultInfo: VaultInfo, newData?: AppData) => void;
  currentData: AppData;
}

export const VaultModal: React.FC<VaultModalProps> = ({
  isOpen,
  onClose,
  vaultInfo,
  onVaultChanged,
  currentData,
}) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'redundancy'>('storage');
  const [newVaultName, setNewVaultName] = useState('My Albaqros Vault');
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Redundancy & Backups state
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isSyncingMarkdown, setIsSyncingMarkdown] = useState(false);
  const [restoreConfirmBackup, setRestoreConfirmBackup] = useState<BackupSnapshot | null>(null);
  const [emptyVaultPrompt, setEmptyVaultPrompt] = useState<{ vaultInfo: VaultInfo } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadBackupsList();
    }
  }, [isOpen, vaultInfo?.path]);

  if (!isOpen) return null;

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const loadBackupsList = async () => {
    setIsLoadingBackups(true);
    try {
      const list = await StorageService.getBackups();
      setBackups(list);
    } catch (err: any) {
      console.warn('Failed to load backups list:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleCopyPath = () => {
    if (vaultInfo?.path) {
      navigator.clipboard.writeText(vaultInfo.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenExplorer = async (path?: string) => {
    await StorageService.openVaultInExplorer(path || vaultInfo?.path);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const refreshed = await StorageService.load();
      const info = await StorageService.getVaultInfo();
      if (info) {
        onVaultChanged(info, refreshed);
      }
      await loadBackupsList();
      showMsg('Vault reloaded & synced from disk!');
    } catch (e: any) {
      showMsg('Failed to reload: ' + e.message, 'error');
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  };

  const handleSelectExisting = async () => {
    try {
      const res = await StorageService.selectVaultDirectory();
      if (res && res.success && res.vaultInfo) {
        if (res.isEmpty) {
          // SAFE GUARD: Do NOT blindly overwrite! Ask the user explicitly.
          setEmptyVaultPrompt({ vaultInfo: res.vaultInfo });
        } else if (res.data) {
          showMsg(`Switched to vault "${res.vaultInfo.name}"!`);
          onVaultChanged(res.vaultInfo, res.data);
          loadBackupsList();
        }
      }
    } catch (err: any) {
      showMsg('Error selecting vault: ' + err.message, 'error');
    }
  };

  const confirmInitializeEmptyVault = async () => {
    if (!emptyVaultPrompt) return;
    try {
      await StorageService.save(currentData);
      showMsg(`Initialized vault "${emptyVaultPrompt.vaultInfo.name}" with your current workspace data!`);
      onVaultChanged(emptyVaultPrompt.vaultInfo, currentData);
      setEmptyVaultPrompt(null);
      loadBackupsList();
    } catch (err: any) {
      showMsg('Failed to initialize vault: ' + err.message, 'error');
    }
  };

  const handleCreateNewVault = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newVaultName.trim();
    if (!cleanName) return;

    setIsCreating(true);
    try {
      const res = await StorageService.createNewVault(cleanName, undefined, currentData);
      if (res.success && res.vaultInfo) {
        showMsg(`Created & connected vault "${res.vaultInfo.name}"!`);
        onVaultChanged(res.vaultInfo, res.data || currentData);
        setIsCreating(false);
        loadBackupsList();
      } else if (res.error) {
        showMsg(res.error, 'error');
        setIsCreating(false);
      }
    } catch (err: any) {
      showMsg('Error creating vault: ' + err.message, 'error');
      setIsCreating(false);
    }
  };

  const handleSwitchRecent = async (recentPath: string) => {
    try {
      const res = await StorageService.switchVault(recentPath, false, currentData);
      if (res.success && res.vaultInfo) {
        showMsg(`Switched to "${res.vaultInfo.name}"!`);
        onVaultChanged(res.vaultInfo, res.data || currentData);
        loadBackupsList();
      } else {
        showMsg(res.error || 'Failed to switch vault', 'error');
      }
    } catch (err: any) {
      showMsg('Error switching vault: ' + err.message, 'error');
    }
  };

  const handleCreateManualBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await StorageService.createManualBackup('user');
      if (res.success) {
        showMsg('Instant backup snapshot created!');
        await loadBackupsList();
      } else {
        showMsg('Failed to create backup snapshot', 'error');
      }
    } catch (e: any) {
      showMsg('Backup error: ' + e.message, 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreConfirmBackup) return;
    try {
      const res = await StorageService.restoreBackup(restoreConfirmBackup.filePath);
      if (res.success && res.data) {
        showMsg(`Successfully restored snapshot from ${new Date(restoreConfirmBackup.timestamp).toLocaleDateString()}!`);
        if (vaultInfo) {
          onVaultChanged(vaultInfo, res.data);
        }
        setRestoreConfirmBackup(null);
        await loadBackupsList();
      } else {
        showMsg(res.error || 'Failed to restore snapshot', 'error');
      }
    } catch (e: any) {
      showMsg('Restore error: ' + e.message, 'error');
    }
  };

  const handleSyncMarkdown = async () => {
    setIsSyncingMarkdown(true);
    try {
      const res = await StorageService.syncMarkdownNow();
      if (res.success) {
        showMsg('Major Goals.md & Daily Tasks.md synced in vault!');
      } else {
        showMsg(res.error || 'Failed to sync markdown', 'error');
      }
    } catch (e: any) {
      showMsg('Markdown sync error: ' + e.message, 'error');
    } finally {
      setTimeout(() => setIsSyncingMarkdown(false), 500);
    }
  };

  const handleOpenMarkdownFile = async (fileName: string) => {
    const success = await StorageService.openMarkdownFile(fileName);
    if (!success) {
      await StorageService.syncMarkdownNow();
      await StorageService.openMarkdownFile(fileName);
    }
  };

  const getCloudBadge = (provider?: string) => {
    switch (provider) {
      case 'onedrive':
        return { label: 'OneDrive Cloud Synced', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' };
      case 'google-drive':
        return { label: 'Google Drive Cloud Synced', color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)' };
      case 'dropbox':
        return { label: 'Dropbox Cloud Synced', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)' };
      case 'icloud':
        return { label: 'iCloud Synced', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.12)' };
      default:
        return { label: 'Local PC Storage', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
    }
  };

  const badge = getCloudBadge(vaultInfo?.cloudProvider);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 110,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '26px',
          backgroundColor: '#0f141d',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          boxShadow: '0 24px 50px rgba(0, 0, 0, 0.85), 0 0 40px rgba(99, 102, 241, 0.1)',
          borderRadius: 'var(--radius-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)',
              }}
            >
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Albaqros Vault & Redundancy
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Dual-layer backup redundancy, cloud drive synchronization & standalone Markdown files
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '18px',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            style={{
              flex: 1,
              padding: '7px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              backgroundColor: activeTab === 'storage' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: activeTab === 'storage' ? '#ffffff' : 'var(--text-muted)',
              borderBottom: activeTab === 'storage' ? '2px solid #6366f1' : '2px solid transparent',
            }}
          >
            <Folder size={14} /> Vault Folder & Cloud Sync
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('redundancy');
              loadBackupsList();
            }}
            style={{
              flex: 1,
              padding: '7px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              backgroundColor: activeTab === 'redundancy' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
              color: activeTab === 'redundancy' ? '#ffffff' : 'var(--text-muted)',
              borderBottom: activeTab === 'redundancy' ? '2px solid #6366f1' : '2px solid transparent',
            }}
          >
            <ShieldCheck size={14} /> Redundancy, Backups & MD
            {backups.length > 0 && (
              <span
                style={{
                  fontSize: '0.675rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(99, 102, 241, 0.4)',
                  color: '#ffffff',
                }}
              >
                {backups.length}
              </span>
            )}
          </button>
        </div>

        {/* Notification message */}
        {statusMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: statusMessage.type === 'success' ? '#34d399' : '#f87171',
              border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Sparkles size={14} />
            {statusMessage.text}
          </div>
        )}

        {/* Empty Vault Safe Guard Prompt Modal */}
        {emptyVaultPrompt && (
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              marginBottom: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fbbf24', marginBottom: '4px' }}>
                  Safety Shield: No existing data file found in this folder
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  Folder: <code style={{ color: '#ffffff' }}>{emptyVaultPrompt.vaultInfo.path}</code>
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.45 }}>
                  • <strong>Connecting from another PC?</strong> If this is a Google Drive or OneDrive folder, check that your cloud provider has completely finished downloading files before connecting to avoid wiping them.<br />
                  • <strong>Creating a new workspace?</strong> Click initialize to populate this folder with your current tasks and major goals.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setEmptyVaultPrompt(null)}
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              >
                Cancel (Don't Overwrite)
              </button>
              <button
                type="button"
                onClick={confirmInitializeEmptyVault}
                className="btn-primary"
                style={{ fontSize: '0.75rem', padding: '6px 12px', backgroundColor: '#d97706', borderColor: '#b45309' }}
              >
                Initialize with Current Data
              </button>
            </div>
          </div>
        )}

        {/* Restore Confirmation Dialog */}
        {restoreConfirmBackup && (
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              marginBottom: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <RotateCcw size={20} color="#818cf8" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                  Restore Snapshot Confirmation
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  File: <code style={{ color: '#38bdf8' }}>{restoreConfirmBackup.fileName}</code><br />
                  Contains: <strong>{restoreConfirmBackup.taskCount} tasks</strong>, <strong>{restoreConfirmBackup.majorTaskCount} major goals</strong>, <strong>{restoreConfirmBackup.entryCount} journal entries</strong>.<br />
                  Recorded: {new Date(restoreConfirmBackup.timestamp).toLocaleString()}
                </p>
                <p style={{ fontSize: '0.725rem', color: '#10b981', marginTop: '6px' }}>
                  🛡️ <em>Albaqros will automatically take a pre-restore backup of your current state before proceeding.</em>
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setRestoreConfirmBackup(null)}
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="btn-primary"
                style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              >
                Restore Snapshot
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Storage & Cloud Drive */}
        {activeTab === 'storage' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Active Vault Hero Card */}
            <div
              style={{
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#38bdf8',
                    }}
                  >
                    <Folder size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                        {vaultInfo?.name || 'Default Vault'}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.675rem',
                          fontWeight: 600,
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.color}33`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Cloud size={10} />
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '0.725rem', color: '#10b981' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                      Active & Watching for Drive Changes
                    </div>
                  </div>
                </div>

                {/* Sync / Reload Button */}
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '6px 10px', gap: '6px' }}
                  title="Force reload latest changes from drive"
                >
                  <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Syncing...' : 'Sync / Reload'}
                </button>
              </div>

              {/* Path & Explorer controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontSize: '0.725rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={vaultInfo?.path}
                >
                  {vaultInfo?.path || 'Default AppData Path'}
                </span>

                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="btn-icon"
                  style={{ padding: '4px' }}
                  title="Copy vault path"
                >
                  {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenExplorer()}
                  className="btn-secondary"
                  style={{ fontSize: '0.7rem', padding: '4px 8px', gap: '4px' }}
                  title="Open vault folder in Windows Explorer"
                >
                  <FolderOpen size={12} /> Explorer
                </button>
              </div>
            </div>

            {/* Dual Action Columns: Choose Existing or Create New */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* 1. Choose Existing Vault */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <FolderOpen size={16} color="#38bdf8" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Connect Existing Vault
                    </span>
                  </div>
                  <p style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Select an existing folder in Google Drive, OneDrive, or your PC. Albaqros checks for existing files and protects them from being overwritten.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSelectExisting}
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '8px 12px' }}
                >
                  <Folder size={14} /> Select Vault Folder...
                </button>
              </div>

              {/* 2. Create New Vault */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <FolderPlus size={16} color="#a855f7" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Create New Vault
                    </span>
                  </div>
                  <p style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Creates a dedicated folder with subfolders for notes, deliverables, and rolling backups.
                  </p>
                </div>

                <form onSubmit={handleCreateNewVault} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    value={newVaultName}
                    onChange={(e) => setNewVaultName(e.target.value)}
                    placeholder="e.g. LifeVault, CreativeVault..."
                    className="input-field"
                    style={{ fontSize: '0.775rem', padding: '7px 10px' }}
                    required
                  />
                  <button
                    type="submit"
                    disabled={isCreating || !newVaultName.trim()}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '8px 12px' }}
                  >
                    <Sparkles size={14} />
                    {isCreating ? 'Creating...' : 'Choose Location & Create'}
                  </button>
                </form>
              </div>
            </div>

            {/* Recent Vaults */}
            {vaultInfo?.recentVaults && vaultInfo.recentVaults.length > 1 && (
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <Clock size={14} color="#818cf8" />
                  <span style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Recent Vaults
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {vaultInfo.recentVaults.map((rv) => {
                    const isCurrent = rv.path === vaultInfo.path;
                    return (
                      <div
                        key={rv.path}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isCurrent ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                          border: `1px solid ${isCurrent ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-subtle)'}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <Folder size={14} color={isCurrent ? '#818cf8' : 'var(--text-muted)'} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isCurrent ? '#ffffff' : 'var(--text-primary)' }}>
                              {rv.name} {isCurrent && <span style={{ fontSize: '0.7rem', color: '#818cf8' }}>(Active)</span>}
                            </div>
                            <div
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '380px',
                              }}
                            >
                              {rv.path}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenExplorer(rv.path)}
                            className="btn-icon"
                            title="Open folder in Explorer"
                          >
                            <FolderOpen size={13} />
                          </button>
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleSwitchRecent(rv.path)}
                              className="btn-secondary"
                              style={{ fontSize: '0.725rem', padding: '4px 8px', gap: '4px' }}
                            >
                              Switch <ArrowRight size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Redundancy, Backups & Markdown */}
        {activeTab === 'redundancy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* 3 Pillars of Redundancy Status Banner */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
              }}
            >
              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '0.75rem', fontWeight: 700 }}>
                  <Cloud size={14} /> Vault Backups
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Rolling snapshots saved in <code style={{ color: '#ffffff' }}>vault/backups/</code>
                </p>
                <span style={{ fontSize: '0.675rem', color: '#38bdf8', fontWeight: 600, marginTop: '2px' }}>
                  ✓ Cloud Synced
                </span>
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '0.75rem', fontWeight: 700 }}>
                  <HardDrive size={14} /> Air-Gap Backups
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Stored locally in AppData outside cloud reach
                </p>
                <span style={{ fontSize: '0.675rem', color: '#34d399', fontWeight: 600, marginTop: '2px' }}>
                  ✓ Deletion-Immune
                </span>
              </div>

              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(168, 85, 247, 0.08)',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c084fc', fontSize: '0.75rem', fontWeight: 700 }}>
                  <FileText size={14} /> Standalone MD
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Live <code style={{ color: '#ffffff' }}>Major Goals.md</code> & <code style={{ color: '#ffffff' }}>Daily Tasks.md</code>
                </p>
                <span style={{ fontSize: '0.675rem', color: '#c084fc', fontWeight: 600, marginTop: '2px' }}>
                  ✓ App-Independent
                </span>
              </div>
            </div>

            {/* Markdown Quick Access Bar */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={15} color="#c084fc" /> Readable Markdown Files (Vault Root)
                  </h4>
                  <p style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                    Open your goals and daily tasks in Obsidian, VS Code, Notion, or any text editor:
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSyncMarkdown}
                  disabled={isSyncingMarkdown}
                  className="btn-secondary"
                  style={{ fontSize: '0.725rem', padding: '5px 10px', gap: '4px' }}
                >
                  <RefreshCw size={12} className={isSyncingMarkdown ? 'animate-spin' : ''} />
                  {isSyncingMarkdown ? 'Updating...' : 'Regenerate MD Now'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenMarkdownFile('Major Goals.md')}
                  className="btn-secondary"
                  style={{
                    padding: '8px 12px',
                    justifyContent: 'flex-start',
                    gap: '8px',
                    fontSize: '0.775rem',
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    borderColor: 'rgba(99, 102, 241, 0.25)',
                  }}
                >
                  <FileText size={14} color="#818cf8" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: '#ffffff' }}>Major Goals.md</div>
                    <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>Roadmap, milestones, progress & deliverables</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenMarkdownFile('Daily Tasks.md')}
                  className="btn-secondary"
                  style={{
                    padding: '8px 12px',
                    justifyContent: 'flex-start',
                    gap: '8px',
                    fontSize: '0.775rem',
                    backgroundColor: 'rgba(56, 189, 248, 0.08)',
                    borderColor: 'rgba(56, 189, 248, 0.25)',
                  }}
                >
                  <FileText size={14} color="#38bdf8" />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: '#ffffff' }}>Daily Tasks.md</div>
                    <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>Checklists, active tasks, subtasks & archive</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Backups Action & Snapshots List */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={16} color="#10b981" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Backup Snapshots & History ({backups.length})
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={handleCreateManualBackup}
                    disabled={isBackingUp}
                    className="btn-primary"
                    style={{ fontSize: '0.725rem', padding: '5px 10px', gap: '4px' }}
                  >
                    <Download size={12} /> {isBackingUp ? 'Backing Up...' : 'Create Snapshot'}
                  </button>

                  <button
                    type="button"
                    onClick={() => StorageService.openBackupsFolder('vault')}
                    className="btn-secondary"
                    style={{ fontSize: '0.725rem', padding: '5px 10px', gap: '4px' }}
                    title="Open vault backups folder in Explorer"
                  >
                    <FolderOpen size={12} /> Vault Backups
                  </button>

                  <button
                    type="button"
                    onClick={() => StorageService.openBackupsFolder('emergency')}
                    className="btn-secondary"
                    style={{ fontSize: '0.725rem', padding: '5px 10px', gap: '4px' }}
                    title="Open emergency local air-gap folder in Explorer"
                  >
                    <HardDrive size={12} /> Air-Gap Folder
                  </button>
                </div>
              </div>

              {isLoadingBackups ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Loading backups...
                </div>
              ) : backups.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '24px',
                    color: 'var(--text-muted)',
                    fontSize: '0.775rem',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  No snapshots recorded yet. Backups are created automatically on every change or when you click "Create Snapshot".
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                  }}
                >
                  {backups.slice(0, 20).map((b) => {
                    const isVault = b.source === 'vault';
                    return (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(0, 0, 0, 0.25)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              backgroundColor: isVault ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: isVault ? '#38bdf8' : '#34d399',
                              border: `1px solid ${isVault ? 'rgba(56, 189, 248, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                            }}
                          >
                            {isVault ? '☁️ Vault' : '🛡️ Air-Gap'}
                          </span>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {new Date(b.timestamp).toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
                              {b.taskCount} tasks • {b.majorTaskCount} major goals • {b.entryCount} entries • {(b.sizeBytes / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setRestoreConfirmBackup(b)}
                          className="btn-secondary"
                          style={{ fontSize: '0.7rem', padding: '4px 10px', gap: '4px' }}
                        >
                          <RotateCcw size={11} /> Restore
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
