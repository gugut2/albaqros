import React, { useState } from 'react';
import {
  X,
  ArrowRight,
  Sparkles,
  Calendar,
  Image as ImageIcon,
  Box,
  Music,
  FileText,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { ProjectArtifact } from '../types';
import { formatDateLabel } from '../services/storage';

interface EvolutionCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  artifacts: ProjectArtifact[];
  majorTaskTitle: string;
}

export const EvolutionCompareModal: React.FC<EvolutionCompareModalProps> = ({
  isOpen,
  onClose,
  artifacts,
  majorTaskTitle,
}) => {
  if (!isOpen || artifacts.length < 2) return null;

  // Sort chronological (oldest to newest)
  const sorted = [...artifacts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const [leftId, setLeftId] = useState<string>(sorted[0].id);
  const [rightId, setRightId] = useState<string>(sorted[sorted.length - 1].id);

  const leftPiece = artifacts.find((a) => a.id === leftId) || sorted[0];
  const rightPiece = artifacts.find((a) => a.id === rightId) || sorted[sorted.length - 1];

  // Calculate days difference
  const leftTime = new Date(leftPiece.createdAt).getTime();
  const rightTime = new Date(rightPiece.createdAt).getTime();
  const diffDays = Math.max(0, Math.round(Math.abs(rightTime - leftTime) / (1000 * 60 * 60 * 24)));

  const handleOpenExternal = (filePath?: string) => {
    if (filePath && typeof window !== 'undefined' && (window as any).electronAPI?.openExternalFile) {
      (window as any).electronAPI.openExternalFile(filePath);
    }
  };

  const renderMedia = (piece: ProjectArtifact) => {
    if (piece.type === 'image' && piece.dataUrl) {
      return (
        <div
          style={{
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            backgroundColor: '#080a0e',
            border: '1px solid var(--border-subtle)',
            height: '280px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <img
            src={piece.dataUrl}
            alt={piece.title}
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      );
    }

    if (piece.type === '3d') {
      return (
        <div
          style={{
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            backgroundColor: '#080a0e',
            border: '1px solid var(--border-subtle)',
            height: '280px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '20px',
          }}
        >
          {piece.thumbnailUrl ? (
            <img
              src={piece.thumbnailUrl}
              alt={piece.title}
              style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
            />
          ) : (
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c084fc',
              }}
            >
              <Box size={32} />
            </div>
          )}
          {piece.filePath && (
            <button
              type="button"
              onClick={() => handleOpenExternal(piece.filePath)}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
            >
              <ExternalLink size={13} /> Open 3D Project in App
            </button>
          )}
        </div>
      );
    }

    if (piece.type === 'audio') {
      return (
        <div
          style={{
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#080a0e',
            border: '1px solid var(--border-subtle)',
            height: '280px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            padding: '24px',
          }}
        >
          {piece.thumbnailUrl ? (
            <img
              src={piece.thumbnailUrl}
              alt="Cover"
              style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fbbf24',
              }}
            >
              <Music size={32} />
            </div>
          )}
          {piece.dataUrl && (
            <audio controls src={piece.dataUrl} style={{ width: '100%', maxWidth: '300px' }} />
          )}
        </div>
      );
    }

    return (
      <div
        style={{
          borderRadius: 'var(--radius-md)',
          backgroundColor: '#080a0e',
          border: '1px solid var(--border-subtle)',
          height: '280px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
        }}
      >
        <FileText size={40} color="#818cf8" />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{piece.fileName || 'Project Deliverable'}</span>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 120,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px',
          backgroundColor: '#10131b',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          boxShadow: '0 28px 60px rgba(0, 0, 0, 0.9)',
          borderRadius: 'var(--radius-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
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
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Evolution Progression Comparison
              </h2>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {majorTaskTitle} • Side-by-side progression tracking your creative skill growth
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#34d399',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                padding: '4px 10px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Clock size={12} /> {diffDays === 0 ? 'Same day comparison' : `${diffDays} days of evolution`}
            </span>
            <button type="button" onClick={onClose} className="btn-icon">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Comparison Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginTop: '12px',
          }}
        >
          {/* Left Side: Earlier / Baseline Deliverable */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '16px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#94a3b8',
                  backgroundColor: 'rgba(148, 163, 184, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}
              >
                EARLIER MILESTONE
              </span>

              {/* Selector for Left */}
              <select
                value={leftId}
                onChange={(e) => setLeftId(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  padding: '4px 8px',
                }}
              >
                {sorted.map((item) => (
                  <option key={item.id} value={item.id}>
                    Piece #{item.milestoneNumber || '?'}: {item.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Media Box */}
            {renderMedia(leftPiece)}

            {/* Title & Metadata */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {leftPiece.title}
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                <Calendar size={12} /> {formatDateLabel(leftPiece.createdAt.slice(0, 10))}
                <span>•</span>
                <span>Piece #{leftPiece.milestoneNumber || 1}</span>
              </div>
            </div>

            {/* Reflection / Critique Notes */}
            {leftPiece.notes && (
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '2px solid #818cf8',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: '0.675rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Self-Critique & Reflections
                </div>
                {leftPiece.notes}
              </div>
            )}
          </div>

          {/* Right Side: Later / Evolution Deliverable */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '16px',
              backgroundColor: 'rgba(99, 102, 241, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#818cf8',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}
              >
                RECENT EVOLUTION
              </span>

              {/* Selector for Right */}
              <select
                value={rightId}
                onChange={(e) => setRightId(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  padding: '4px 8px',
                }}
              >
                {sorted.map((item) => (
                  <option key={item.id} value={item.id}>
                    Piece #{item.milestoneNumber || '?'}: {item.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Media Box */}
            {renderMedia(rightPiece)}

            {/* Title & Metadata */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {rightPiece.title}
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                <Calendar size={12} /> {formatDateLabel(rightPiece.createdAt.slice(0, 10))}
                <span>•</span>
                <span>Piece #{rightPiece.milestoneNumber || sorted.length}</span>
              </div>
            </div>

            {/* Reflection / Critique Notes */}
            {rightPiece.notes && (
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '2px solid #10b981',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontSize: '0.675rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Self-Critique & Reflections
                </div>
                {rightPiece.notes}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button type="button" onClick={onClose} className="btn-secondary">
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
