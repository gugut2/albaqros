import React, { useState } from 'react';
import {
  X,
  Folder,
  FolderPlus,
  FolderOpen,
  Cloud,
  Check,
  RefreshCw,
  Copy,
  ExternalLink,
  HardDrive,
  Sparkles,
  ArrowRight,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { AppData, VaultInfo } from '../types';
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
  const [newVaultName, setNewVaultName] = useState('My Albaqros Vault');
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3500);
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
          // If newly selected folder has no data, migrate current data into it
          await StorageService.save(currentData);
          showMsg(`Initialized new vault "${res.vaultInfo.name}" with your current data!`);
          onVaultChanged(res.vaultInfo, currentData);
        } else {
          showMsg(`Switched to vault "${res.vaultInfo.name}"!`);
          onVaultChanged(res.vaultInfo, res.data);
        }
      }
    } catch (err: any) {
      showMsg('Error selecting vault: ' + err.message, 'error');
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
        onVaultChanged(res.vaultInfo, currentData);
        setIsCreating(false);
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
      const res = await StorageService.switchVault(recentPath, true, currentData);
      if (res.success && res.vaultInfo) {
        showMsg(`Switched to "${res.vaultInfo.name}"!`);
        onVaultChanged(res.vaultInfo, res.data || currentData);
      } else {
        showMsg(res.error || 'Failed to switch vault', 'error');
      }
    } catch (err: any) {
      showMsg('Error switching vault: ' + err.message, 'error');
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
          maxWidth: '620px',
          maxHeight: '90vh',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
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
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Albaqros Vault & Cloud Sync
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Your personal storage vault with automatic drive sync & hot-reloading
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-icon">
            <X size={16} />
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                    Choose Existing Vault
                  </span>
                </div>
                <p style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Select any folder inside Google Drive, OneDrive, or your PC. If it contains existing Albaqros records, everything loads immediately.
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
                  Pick a custom name and choose where to put it on your drive. Your current data will be initialized inside.
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
      </div>
    </div>
  );
};
