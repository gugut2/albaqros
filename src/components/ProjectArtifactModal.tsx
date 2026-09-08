import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Box,
  Music,
  FileText,
  Calendar,
  Sparkles,
  Check,
  FolderOpen,
  Trash2,
} from 'lucide-react';
import { ProjectArtifact, ProjectArtifactType } from '../types';
import { formatFileSize } from '../services/majorTasks';
import { getTodayString } from '../services/storage';

interface ProjectArtifactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveArtifact: (artifactData: Omit<ProjectArtifact, 'id'>, existingId?: string) => void;
  majorTaskId: string;
  majorTaskTitle: string;
  existingArtifact?: ProjectArtifact | null;
  defaultMilestoneNumber: number;
}

export const ProjectArtifactModal: React.FC<ProjectArtifactModalProps> = ({
  isOpen,
  onClose,
  onSaveArtifact,
  majorTaskId,
  majorTaskTitle,
  existingArtifact,
  defaultMilestoneNumber,
}) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ProjectArtifactType>('image');
  const [filePath, setFilePath] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState<number | undefined>(undefined);
  const [fileExtension, setFileExtension] = useState('');
  const [dataUrl, setDataUrl] = useState<string | undefined>(undefined);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [createdAt, setCreatedAt] = useState(getTodayString());
  const [milestoneNumber, setMilestoneNumber] = useState<number>(defaultMilestoneNumber);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existingArtifact) {
      setTitle(existingArtifact.title);
      setType(existingArtifact.type);
      setFilePath(existingArtifact.filePath || '');
      setFileName(existingArtifact.fileName || '');
      setFileSize(existingArtifact.fileSize);
      setFileExtension(existingArtifact.fileExtension || '');
      setDataUrl(existingArtifact.dataUrl);
      setThumbnailUrl(existingArtifact.thumbnailUrl);
      setNotes(existingArtifact.notes || '');
      setCreatedAt(existingArtifact.createdAt.slice(0, 10));
      setMilestoneNumber(existingArtifact.milestoneNumber || defaultMilestoneNumber);
    } else {
      setTitle('');
      setType('image');
      setFilePath('');
      setFileName('');
      setFileSize(undefined);
      setFileExtension('');
      setDataUrl(undefined);
      setThumbnailUrl(undefined);
      setNotes('');
      setCreatedAt(getTodayString());
      setMilestoneNumber(defaultMilestoneNumber);
    }
  }, [existingArtifact, isOpen, defaultMilestoneNumber]);

  if (!isOpen) return null;

  // Native Electron file select with browser fallback
  const handleSelectFile = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.selectProjectFile) {
      const result = await (window as any).electronAPI.selectProjectFile();
      if (result) {
        setFilePath(result.filePath);
        setFileName(result.fileName);
        setFileSize(result.fileSize);
        setFileExtension(result.fileExtension);
        setType(result.detectedType as ProjectArtifactType);
        if (result.dataUrl) {
          setDataUrl(result.dataUrl);
        }
        if (!title.trim()) {
          // Default title from clean filename
          const cleanName = result.fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
          setTitle(`Piece #${milestoneNumber}: ${capitalized}`);
        }
      }
    } else {
      // Browser fallback
      fileInputRef.current?.click();
    }
  };

  const handleBrowserFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize(file.size);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    setFileExtension(ext);

    // Auto-detect type
    if (file.type.startsWith('image/')) {
      setType('image');
    } else if (file.type.startsWith('audio/')) {
      setType('audio');
    } else if (['.blend', '.obj', '.fbx', '.gltf', '.glb', '.stl'].includes(ext)) {
      setType('3d');
    } else {
      setType('file');
    }

    if (!title.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const capitalized = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      setTitle(`Piece #${milestoneNumber}: ${capitalized}`);
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectCover = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.selectCoverImage) {
      const cover = await (window as any).electronAPI.selectCoverImage();
      if (cover) setThumbnailUrl(cover);
    } else {
      coverInputRef.current?.click();
    }
  };

  const handleBrowserCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setThumbnailUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSaveArtifact(
      {
        majorTaskId,
        title: title.trim(),
        type,
        filePath: filePath || undefined,
        fileName: fileName || undefined,
        fileSize,
        fileExtension: fileExtension || undefined,
        dataUrl,
        thumbnailUrl,
        notes: notes.trim() || undefined,
        createdAt: new Date(createdAt).toISOString(),
        milestoneNumber,
      },
      existingArtifact?.id
    );

    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.8)',
        backdropFilter: 'blur(8px)',
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
          maxWidth: '560px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px',
          backgroundColor: '#12161f',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 24px 50px rgba(0, 0, 0, 0.85)',
          borderRadius: 'var(--radius-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden File Inputs for Browser Fallback */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleBrowserFileChange}
        />
        <input
          type="file"
          accept="image/*"
          ref={coverInputRef}
          style={{ display: 'none' }}
          onChange={handleBrowserCoverChange}
        />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {existingArtifact ? 'Edit Milestone Deliverable' : 'Log Milestone Deliverable'}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {majorTaskTitle} • Track your skill evolution
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* File Picker Zone */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              PROJECT FILE OR DELIVERABLE
            </label>
            <div
              onClick={handleSelectFile}
              style={{
                border: fileName ? '1px solid rgba(99, 102, 241, 0.4)' : '1px dashed var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                backgroundColor: fileName ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                }}
              >
                {type === 'image' && <ImageIcon size={20} />}
                {type === '3d' && <Box size={20} />}
                {type === 'audio' && <Music size={20} />}
                {type === 'file' && <FileText size={20} />}
              </div>

              {fileName ? (
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {fileName}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {formatFileSize(fileSize)} {fileExtension ? `• ${fileExtension.toUpperCase()}` : ''}
                    {filePath && ` • Click to change file`}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#818cf8' }}>
                    Click to select file from your PC
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Supports Images (PNG, JPG, PSD), 3D (.blend, .obj, .fbx), Audio (.wav, .mp3, .flac), & all files
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Media Type Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              MEDIA / DISCIPLINE TYPE
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { id: 'image', label: 'Concept Art', icon: ImageIcon },
                { id: '3d', label: '3D Project', icon: Box },
                { id: 'audio', label: 'Music / SFX', icon: Music },
                { id: 'file', label: 'Project File', icon: FileText },
              ].map((item) => {
                const isSelected = type === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id as ProjectArtifactType)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px 6px',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '1px solid #6366f1' : '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: isSelected ? 600 : 500,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={16} color={isSelected ? '#818cf8' : 'currentColor'} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview for Images or Cover for 3D/Audio */}
          {type === 'image' && dataUrl && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                IMAGE PREVIEW
              </label>
              <div
                style={{
                  maxHeight: '180px',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: '#0a0d13',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={dataUrl}
                  alt="Deliverable Preview"
                  style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain' }}
                />
              </div>
            </div>
          )}

          {/* Optional Render / Cover Image for 3D or Audio */}
          {(type === '3d' || type === 'audio' || type === 'file') && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  RENDER / COVER THUMBNAIL (OPTIONAL)
                </label>
                {thumbnailUrl && (
                  <button
                    type="button"
                    onClick={() => setThumbnailUrl(undefined)}
                    style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '0.7rem', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
              </div>
              {thumbnailUrl ? (
                <div
                  style={{
                    maxHeight: '120px',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: '#0a0d13',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={thumbnailUrl}
                    alt="Cover Thumbnail"
                    style={{ maxHeight: '120px', maxWidth: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSelectCover}
                  className="btn-secondary"
                  style={{ width: '100%', fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  <ImageIcon size={14} /> Add render preview or cover art image
                </button>
              )}
            </div>
          )}

          {/* Audio Preview if audio type */}
          {type === 'audio' && dataUrl && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                AUDIO PREVIEW
              </label>
              <audio controls src={dataUrl} style={{ width: '100%', height: '36px' }} />
            </div>
          )}

          {/* Title & Milestone Number */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                DELIVERABLE TITLE
              </label>
              <input
                type="text"
                placeholder="e.g. Week 2 Still Life Study, Low-Poly Mech..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                PIECE / STAGE #
              </label>
              <input
                type="number"
                min="1"
                value={milestoneNumber}
                onChange={(e) => setMilestoneNumber(parseInt(e.target.value, 10) || 1)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  textAlign: 'center',
                }}
              />
            </div>
          </div>

          {/* Date Completed */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              COMPLETION DATE
            </label>
            <input
              type="date"
              value={createdAt}
              onChange={(e) => setCreatedAt(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Self-Critique & Reflections */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              CREATIVE REFLECTION & CRITIQUE (OPTIONAL)
            </label>
            <textarea
              placeholder="What techniques did you practice? What felt easy vs difficult? What will you improve on the next piece?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontSize: '0.825rem',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!title.trim()}>
              <Check size={14} /> {existingArtifact ? 'Save Changes' : 'Log Deliverable'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
