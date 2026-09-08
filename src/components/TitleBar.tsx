import React from 'react';
import { Minus, X, Maximize2, Minimize2, Pin, Sparkles } from 'lucide-react';

interface TitleBarProps {
  isCompact: boolean;
  alwaysOnTop: boolean;
  onToggleMode: () => void;
  onToggleAlwaysOnTop: () => void;
  onMinimize: () => void;
  onClose: () => void;
  activeDateLabel?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  isCompact,
  alwaysOnTop,
  onToggleMode,
  onToggleAlwaysOnTop,
  onMinimize,
  onClose,
  activeDateLabel,
}) => {
  return (
    <header
      className="titlebar-draggable"
      style={{
        height: '42px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        backgroundColor: 'rgba(15, 18, 24, 0.95)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      {/* Left branding */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '5px',
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)',
          }}
        >
          <Sparkles size={11} color="#ffffff" />
        </div>
        <span
          style={{
            fontSize: '0.825rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-display)',
            background: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          ALBAQROS
        </span>
        <span
          style={{
            fontSize: '0.65rem',
            padding: '1px 6px',
            borderRadius: '4px',
            backgroundColor: isCompact ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: isCompact ? '#818cf8' : '#34d399',
            fontWeight: 600,
            letterSpacing: '0.05em',
            border: `1px solid ${isCompact ? 'rgba(99, 102, 241, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
          }}
        >
          {isCompact ? 'WIDGET' : 'STUDIO'}
        </span>
      </div>

      {/* Center label (if date provided in compact or studio mode) */}
      {activeDateLabel && (
        <div
          style={{
            fontSize: '0.775rem',
            color: 'var(--text-muted)',
            fontWeight: 500,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {activeDateLabel}
        </div>
      )}

      {/* Right controls */}
      <div
        className="no-drag"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {/* Pin Always on Top Toggle */}
        <button
          type="button"
          onClick={onToggleAlwaysOnTop}
          title={alwaysOnTop ? 'Unpin from Top' : 'Keep Always on Top'}
          className={`btn-icon ${alwaysOnTop ? 'active' : ''}`}
          style={{ width: '28px', height: '28px', padding: 0 }}
        >
          <Pin size={13} style={{ transform: alwaysOnTop ? 'rotate(45deg)' : 'none' }} />
        </button>

        {/* Compact vs Maximized Switcher */}
        <button
          type="button"
          onClick={onToggleMode}
          title={isCompact ? 'Expand to Studio Mode' : 'Collapse to Widget Mode'}
          className="btn-icon"
          style={{ width: '28px', height: '28px', padding: 0 }}
        >
          {isCompact ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
        </button>

        {/* Minimize Window */}
        <button
          type="button"
          onClick={onMinimize}
          title="Minimize Window"
          className="btn-icon"
          style={{ width: '28px', height: '28px', padding: 0 }}
        >
          <Minus size={13} />
        </button>

        {/* Close Window */}
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="btn-icon"
          style={{
            width: '28px',
            height: '28px',
            padding: 0,
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            (e.currentTarget as HTMLElement).style.color = '#ef4444';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
        >
          <X size={13} />
        </button>
      </div>
    </header>
  );
};
