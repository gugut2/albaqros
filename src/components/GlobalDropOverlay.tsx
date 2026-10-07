import React from 'react';
import { Box, Palette, UploadCloud, Sparkles } from 'lucide-react';
import { SUPPORTED_3D_EXTENSIONS, SUPPORTED_2D_EXTENSIONS } from '../services/fileDropRouter';

interface GlobalDropOverlayProps {
  isVisible: boolean;
}

export const GlobalDropOverlay: React.FC<GlobalDropOverlayProps> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(7, 10, 16, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        pointerEvents: 'none', // Transparent to mouse so drops pass cleanly to window
        animation: 'fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Outer Glowing Frame */}
      <div
        style={{
          position: 'absolute',
          inset: '16px',
          borderRadius: '24px',
          border: '2px dashed rgba(129, 140, 248, 0.55)',
          boxShadow: '0 0 50px rgba(99, 102, 241, 0.25) inset, 0 0 30px rgba(99, 102, 241, 0.15)',
        }}
      />

      {/* Drop Content */}
      <div
        style={{
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '720px',
          width: '100%',
          gap: '24px',
        }}
      >
        {/* Header Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '999px',
            backgroundColor: 'rgba(99, 102, 241, 0.18)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            color: '#c7d2fe',
            fontSize: '0.85rem',
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.2)',
          }}
        >
          <UploadCloud size={17} color="#a5b4fc" />
          <span>RELEASE TO DROP & AUTO-SORT</span>
          <Sparkles size={14} color="#facc15" />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#ffffff',
              fontFamily: 'var(--font-display, sans-serif)',
              letterSpacing: '-0.02em',
              marginBottom: '8px',
            }}
          >
            Automatic Library Sorting
          </h2>
          <p
            style={{
              fontSize: '0.9rem',
              color: '#94a3b8',
              maxWidth: '520px',
              lineHeight: 1.5,
            }}
          >
            Albaqros detects 3D models and 2D artwork and saves each file into its dedicated vault library.
          </p>
        </div>

        {/* Dual Library Target Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
            width: '100%',
          }}
        >
          {/* 3D Asset Library Target */}
          <div
            style={{
              backgroundColor: 'rgba(24, 20, 16, 0.88)',
              border: '1.5px solid rgba(249, 115, 22, 0.45)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(249, 115, 22, 0.12)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-30px',
                right: '-30px',
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(249, 115, 22, 0.25) 0%, transparent 70%)',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(249, 115, 22, 0.15)',
                  border: '1px solid rgba(249, 115, 22, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fb923c',
                }}
              >
                <Box size={22} />
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fed7aa', margin: 0 }}>
                  3D Asset Library
                </h4>
                <span style={{ fontSize: '0.75rem', color: '#ea580c', fontWeight: 600 }}>
                  Models & 3D Scenes
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
              Saves to 3D Models vault, computes mesh polycounts & renders 3/4 isometric preview.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '5px',
                marginTop: 'auto',
                paddingTop: '6px',
              }}
            >
              {SUPPORTED_3D_EXTENSIONS.map((ext) => (
                <span
                  key={ext}
                  style={{
                    fontSize: '0.68rem',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    backgroundColor: 'rgba(249, 115, 22, 0.12)',
                    color: '#fed7aa',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(249, 115, 22, 0.25)',
                  }}
                >
                  {ext}
                </span>
              ))}
            </div>
          </div>

          {/* 2D Art Library Target */}
          <div
            style={{
              backgroundColor: 'rgba(24, 16, 26, 0.88)',
              border: '1.5px solid rgba(236, 72, 153, 0.45)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(236, 72, 153, 0.12)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-30px',
                right: '-30px',
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, transparent 70%)',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(236, 72, 153, 0.15)',
                  border: '1px solid rgba(236, 72, 153, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f472b6',
                }}
              >
                <Palette size={22} />
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fbcfe8', margin: 0 }}>
                  2D Art Library
                </h4>
                <span style={{ fontSize: '0.75rem', color: '#db2777', fontWeight: 600 }}>
                  Digital Art & Projects
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
              Saves to 2D Art vault, inspects resolution/bit-depth & extracts embedded high-res previews.
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '5px',
                marginTop: 'auto',
                paddingTop: '6px',
              }}
            >
              {SUPPORTED_2D_EXTENSIONS.slice(0, 10).map((ext) => (
                <span
                  key={ext}
                  style={{
                    fontSize: '0.68rem',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    backgroundColor: 'rgba(236, 72, 153, 0.12)',
                    color: '#fbcfe8',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(236, 72, 153, 0.25)',
                  }}
                >
                  {ext}
                </span>
              ))}
              <span
                style={{
                  fontSize: '0.68rem',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-muted, #64748b)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                +{SUPPORTED_2D_EXTENSIONS.length - 10} more
              </span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
          Tip: Press <kbd style={{ padding: '2px 6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>Esc</kbd> anytime to cancel
        </div>
      </div>
    </div>
  );
};
