import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Plus,
  Image as ImageIcon,
  Box,
  Music,
  FileText,
  Calendar,
  ExternalLink,
  FolderOpen,
  Edit2,
  Trash2,
  Clock,
  ArrowUpDown,
  Maximize2,
  X,
  Play,
  Pause,
  Volume2,
} from 'lucide-react';
import { MajorTask, ProjectArtifact, ProjectArtifactType } from '../types';
import { formatFileSize, calculateCadenceStatus } from '../services/majorTasks';
import { formatDateLabel } from '../services/storage';
import { EvolutionCompareModal } from './EvolutionCompareModal';

interface EvolutionGalleryProps {
  majorTask: MajorTask;
  onOpenAddArtifact: () => void;
  onEditArtifact: (artifact: ProjectArtifact) => void;
  onDeleteArtifact: (artifactId: string) => void;
}

export const EvolutionGallery: React.FC<EvolutionGalleryProps> = ({
  majorTask,
  onOpenAddArtifact,
  onEditArtifact,
  onDeleteArtifact,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [lightboxArtifact, setLightboxArtifact] = useState<ProjectArtifact | null>(null);
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const artifacts = majorTask.artifacts || [];
  const cadence = calculateCadenceStatus(majorTask);

  // Filter
  const filtered = filterType === 'all'
    ? artifacts
    : artifacts.filter((a) => a.type === filterType);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });

  const handleOpenExternal = (filePath?: string) => {
    if (filePath && typeof window !== 'undefined' && (window as any).electronAPI?.openExternalFile) {
      (window as any).electronAPI.openExternalFile(filePath);
    }
  };

  const handleShowInFolder = (filePath?: string) => {
    if (filePath && typeof window !== 'undefined' && (window as any).electronAPI?.showItemInFolder) {
      (window as any).electronAPI.showItemInFolder(filePath);
    }
  };

  const counts = {
    all: artifacts.length,
    image: artifacts.filter((a) => a.type === 'image').length,
    '3d': artifacts.filter((a) => a.type === '3d').length,
    audio: artifacts.filter((a) => a.type === 'audio').length,
    file: artifacts.filter((a) => a.type === 'file').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Cadence Status & Evolution Metrics Strip */}
      <div
        style={{
          padding: '16px 20px',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor:
                cadence.status === 'due_today'
                  ? 'rgba(245, 158, 11, 0.15)'
                  : cadence.status === 'overdue'
                  ? 'rgba(248, 113, 113, 0.15)'
                  : 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color:
                cadence.status === 'due_today'
                  ? '#fbbf24'
                  : cadence.status === 'overdue'
                  ? '#f87171'
                  : '#818cf8',
            }}
          >
            <Clock size={18} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {cadence.badgeText}
              </span>
              {majorTask.cadenceDays && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  Cadence: Every {majorTask.cadenceDays}d
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {artifacts.length === 1
                ? '1 milestone piece completed'
                : `${artifacts.length} milestone pieces completed to date`}
            </div>
          </div>
        </div>

        {/* Action Buttons: Compare & Add */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {artifacts.length >= 2 && (
            <button
              type="button"
              onClick={() => setIsCompareOpen(true)}
              className="btn-secondary"
              style={{ fontSize: '0.775rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Sparkles size={13} color="#818cf8" /> Compare Evolution
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAddArtifact}
            className="btn-primary"
            style={{ fontSize: '0.775rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={13} /> Log Milestone Piece
          </button>
        </div>
      </div>

      {/* Filter & Sort Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All (${counts.all})` },
            { id: 'image', label: `Concept Art (${counts.image})` },
            { id: '3d', label: `3D Projects (${counts['3d']})` },
            { id: 'audio', label: `Music / SFX (${counts.audio})` },
            { id: 'file', label: `Files (${counts.file})` },
          ].map((item) => {
            const isSelected = filterType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilterType(item.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.725rem',
                  fontWeight: isSelected ? 600 : 500,
                  border: isSelected ? '1px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Sort Button */}
        <button
          type="button"
          onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.725rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <ArrowUpDown size={12} />
          <span>{sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
        </button>
      </div>

      {/* Artifacts Gallery Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {sorted.map((artifact) => {
          return (
            <div
              key={artifact.id}
              className="glass-panel"
              style={{
                backgroundColor: 'rgba(14, 18, 25, 0.85)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Media Container */}
              <div
                style={{
                  height: '180px',
                  backgroundColor: '#07090d',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Image Media */}
                {artifact.type === 'image' && (
                  artifact.dataUrl ? (
                    <div
                      onClick={() => setLightboxArtifact(artifact)}
                      style={{
                        width: '100%',
                        height: '100%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                      }}
                    >
                      <img
                        src={artifact.dataUrl}
                        alt={artifact.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.3s ease',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity 0.2s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                      >
                        <span
                          style={{
                            color: '#ffffff',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Maximize2 size={13} /> Full Screen Lightbox
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                      <ImageIcon size={32} />
                      <span style={{ fontSize: '0.75rem' }}>Concept Art Deliverable</span>
                    </div>
                  )
                )}

                {/* 3D Media */}
                {artifact.type === '3d' && (
                  artifact.thumbnailUrl ? (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                      <img
                        src={artifact.thumbnailUrl}
                        alt={artifact.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          backgroundColor: 'rgba(168, 85, 247, 0.85)',
                          color: '#ffffff',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Box size={10} /> 3D RENDER
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        color: '#c084fc',
                      }}
                    >
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(168, 85, 247, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Box size={28} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {artifact.fileExtension ? artifact.fileExtension.toUpperCase() : '3D'} Project Model
                      </span>
                    </div>
                  )
                )}

                {/* Audio Media */}
                {artifact.type === 'audio' && (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      padding: '16px',
                      backgroundColor: 'rgba(245, 158, 11, 0.04)',
                    }}
                  >
                    <div
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fbbf24',
                      }}
                    >
                      <Music size={24} />
                    </div>
                    {artifact.dataUrl && (
                      <audio controls src={artifact.dataUrl} style={{ width: '90%', height: '32px' }} />
                    )}
                  </div>
                )}

                {/* Generic Project File */}
                {artifact.type === 'file' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      color: '#818cf8',
                    }}
                  >
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileText size={28} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {artifact.fileExtension ? artifact.fileExtension.toUpperCase() : 'PROJECT'} File
                    </span>
                  </div>
                )}

                {/* Milestone Badge Pill on Top Left */}
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  Piece #{artifact.milestoneNumber || 1}
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {/* Title and date */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                  <div>
                    <h4
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-display)',
                        lineHeight: 1.3,
                      }}
                    >
                      {artifact.title}
                    </h4>
                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={11} /> {formatDateLabel(artifact.createdAt.slice(0, 10))}
                      {artifact.fileSize && <span>• {formatFileSize(artifact.fileSize)}</span>}
                    </div>
                  </div>

                  {/* Actions: Edit / Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <button
                      type="button"
                      onClick={() => onEditArtifact(artifact)}
                      className="btn-icon"
                      title="Edit Milestone"
                      style={{ padding: '4px' }}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteArtifact(artifact.id)}
                      className="btn-icon"
                      title="Delete Milestone"
                      style={{ padding: '4px', color: '#f87171' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Self-Critique / Reflections */}
                {artifact.notes && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '2px solid var(--accent-indigo)',
                      lineHeight: 1.4,
                      marginTop: '4px',
                    }}
                  >
                    {artifact.notes}
                  </div>
                )}

                {/* Native Electron File Open & Explorer Buttons */}
                {artifact.filePath && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginTop: 'auto',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenExternal(artifact.filePath)}
                      className="btn-secondary"
                      style={{
                        flex: 1,
                        fontSize: '0.725rem',
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                      title={artifact.filePath}
                    >
                      <ExternalLink size={11} /> Open in App
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShowInFolder(artifact.filePath)}
                      className="btn-secondary"
                      style={{
                        fontSize: '0.725rem',
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Show in File Explorer"
                    >
                      <FolderOpen size={11} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            backgroundColor: 'rgba(255, 255, 255, 0.015)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
            }}
          >
            <Sparkles size={24} />
          </div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {artifacts.length === 0 ? 'No milestone projects logged yet' : 'No deliverables match this filter'}
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: 1.4 }}>
            {artifacts.length === 0
              ? 'Finished an art piece, 3D model, audio track, or project deliverable? Log it here to start tracking your tangible skill evolution over time!'
              : 'Try changing the filter above or log a new deliverable in this category.'}
          </p>
          <button
            type="button"
            onClick={onOpenAddArtifact}
            className="btn-primary"
            style={{ marginTop: '6px', fontSize: '0.8rem' }}
          >
            <Plus size={14} /> Log First Milestone Piece
          </button>
        </div>
      )}

      {/* High-Resolution Image Lightbox Modal */}
      {lightboxArtifact && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 7, 10, 0.92)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 150,
            padding: '24px',
          }}
          onClick={() => setLightboxArtifact(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '1000px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar with Title & Close */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: 'rgba(18, 22, 30, 0.8)',
                backdropFilter: 'blur(8px)',
                borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                border: '1px solid var(--border-medium)',
                borderBottom: 'none',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#818cf8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Piece #{lightboxArtifact.milestoneNumber || 1} • {formatDateLabel(lightboxArtifact.createdAt.slice(0, 10))}
                </span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {lightboxArtifact.title}
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {lightboxArtifact.filePath && (
                  <button
                    type="button"
                    onClick={() => handleOpenExternal(lightboxArtifact.filePath)}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                  >
                    <ExternalLink size={12} /> Open File
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLightboxArtifact(null)}
                  className="btn-icon"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Image Preview Container */}
            <div
              style={{
                width: '100%',
                maxHeight: '68vh',
                backgroundColor: '#07090e',
                borderLeft: '1px solid var(--border-medium)',
                borderRight: '1px solid var(--border-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: '12px',
              }}
            >
              <img
                src={lightboxArtifact.dataUrl}
                alt={lightboxArtifact.title}
                style={{
                  maxHeight: '65vh',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: '4px',
                }}
              />
            </div>

            {/* Critique & Notes Footer */}
            {lightboxArtifact.notes && (
              <div
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  backgroundColor: 'rgba(18, 22, 30, 0.95)',
                  border: '1px solid var(--border-medium)',
                  borderTop: 'none',
                  borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                  fontSize: '0.825rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Self-Critique & Reflections
                </div>
                {lightboxArtifact.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compare Evolution Modal */}
      {isCompareOpen && (
        <EvolutionCompareModal
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          artifacts={artifacts}
          majorTaskTitle={majorTask.title}
        />
      )}
    </div>
  );
};
