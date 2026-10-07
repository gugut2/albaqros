import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Check, List, Plus } from 'lucide-react';
import { DayEntry } from '../types';

interface JournalSectionProps {
  entry?: DayEntry;
  dateStr: string;
  onUpdateJournal: (dateStr: string, text: string) => void;
  isCompact?: boolean;
}

export const JournalSection: React.FC<JournalSectionProps> = ({
  entry,
  dateStr,
  onUpdateJournal,
  isCompact = false,
}) => {
  const [content, setContent] = useState(entry?.journal || '');
  const [isSaved, setIsSaved] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(entry?.journal || '');
  }, [entry?.journal, dateStr]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setContent(text);
    setIsSaved(false);
    onUpdateJournal(dateStr, text);
    setTimeout(() => setIsSaved(true), 400);
  };

  /**
   * Smart Bullet Management:
   * - Typing '-' followed by Space automatically becomes a bullet point.
   * - Hitting Enter on a bulleted line creates the next bullet point.
   * - Hitting Enter on an empty bullet line exits the bullet list.
   * - Hitting Backspace on an empty bullet clears it cleanly.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const lineEnd = value.indexOf('\n', selectionStart);
    const currentLine = value.substring(lineStart, lineEnd === -1 ? value.length : lineEnd);

    // 1. Typing '-' or '*' followed by Space converts into bullet '• '
    if (e.key === ' ' || e.code === 'Space') {
      const lineUpToCursor = value.substring(lineStart, selectionStart);
      const match = lineUpToCursor.match(/^(\s*)([-*])$/);
      if (match) {
        e.preventDefault();
        const indent = match[1];
        const replacement = `${indent}• `;
        const newValue = value.substring(0, lineStart) + replacement + value.substring(selectionEnd);
        setContent(newValue);
        setIsSaved(false);
        onUpdateJournal(dateStr, newValue);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const pos = lineStart + replacement.length;
            textareaRef.current.setSelectionRange(pos, pos);
            setIsSaved(true);
          }
        });
        return;
      }
    }

    // 2. Hitting Enter on a bulleted line
    if (e.key === 'Enter') {
      const bulletMatch = currentLine.match(/^(\s*)([•\-*])\s*(.*)$/);
      if (bulletMatch) {
        e.preventDefault();
        const indent = bulletMatch[1];
        const bulletText = bulletMatch[3].trim();

        // If bullet has no text (empty bullet), exit bullet list
        if (!bulletText) {
          const newValue = value.substring(0, lineStart) + value.substring(selectionStart);
          setContent(newValue);
          setIsSaved(false);
          onUpdateJournal(dateStr, newValue);
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.focus();
              textareaRef.current.setSelectionRange(lineStart, lineStart);
              setIsSaved(true);
            }
          });
          return;
        }

        // Auto-continue to next bullet
        const nextBullet = `\n${indent}• `;
        const newValue = value.substring(0, selectionStart) + nextBullet + value.substring(selectionEnd);
        setContent(newValue);
        setIsSaved(false);
        onUpdateJournal(dateStr, newValue);

        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const nextPos = selectionStart + nextBullet.length;
            textareaRef.current.setSelectionRange(nextPos, nextPos);
            setIsSaved(true);
          }
        });
        return;
      }
    }

    // 3. Hitting Backspace on an empty bullet removes it
    if (e.key === 'Backspace') {
      const lineUpToCursor = value.substring(lineStart, selectionStart);
      if (/^(\s*)([•\-*])\s*$/.test(lineUpToCursor)) {
        e.preventDefault();
        const newValue = value.substring(0, lineStart) + value.substring(selectionEnd);
        setContent(newValue);
        setIsSaved(false);
        onUpdateJournal(dateStr, newValue);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(lineStart, lineStart);
            setIsSaved(true);
          }
        });
      }
    }
  };

  /**
   * Insert a bullet point at current cursor or on a new line
   */
  const handleInsertBullet = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;
    const isStartOfLine = selectionStart === 0 || value[selectionStart - 1] === '\n';
    const bulletToInsert = isStartOfLine ? '• ' : '\n• ';

    const newValue = value.substring(0, selectionStart) + bulletToInsert + value.substring(selectionEnd);
    setContent(newValue);
    setIsSaved(false);
    onUpdateJournal(dateStr, newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = selectionStart + bulletToInsert.length;
      setIsSaved(true);
    }, 0);
  };

  /**
   * Converts existing lines of text into bullet points
   */
  const handleFormatAllAsBullets = () => {
    if (!content.trim()) {
      handleInsertBullet();
      return;
    }
    const lines = content.split('\n');
    const bulleted = lines
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
          return line.replace(/^(\s*)(•|-|\*)\s*/, '$1• ');
        }
        return `• ${line}`;
      })
      .join('\n');

    setContent(bulleted);
    setIsSaved(false);
    onUpdateJournal(dateStr, bulleted);
    setTimeout(() => setIsSaved(true), 300);
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const bulletCount = (content.match(/•/g) || []).length;

  return (
    <div
      className="glass-panel"
      style={{
        padding: isCompact ? '12px' : '16px',
        backgroundColor: 'rgba(18, 22, 30, 0.7)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* Header with Title and Bullet Tools */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '5px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
            }}
          >
            <BookOpen size={12} />
          </div>
          <span
            style={{
              fontSize: '0.825rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
            }}
          >
            Daily Reflection & Notes
          </span>
        </div>

        {/* Quick Bullet Toolbar & Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Add Bullet Button */}
          <button
            type="button"
            onClick={handleInsertBullet}
            className="btn-secondary"
            style={{
              fontSize: '0.725rem',
              padding: '2px 8px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderColor: 'rgba(99, 102, 241, 0.3)',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              color: '#a5b4fc',
            }}
            title="Insert bullet point (Enter will automatically continue bullets)"
          >
            <List size={12} />
            <span>• Bullet</span>
          </button>

          {/* Convert lines to bullets */}
          {content.trim() && bulletCount === 0 && (
            <button
              type="button"
              onClick={handleFormatAllAsBullets}
              className="btn-icon"
              style={{ fontSize: '0.7rem', padding: '2px 6px', color: 'var(--text-secondary)' }}
              title="Convert lines to bullet points"
            >
              Format as List
            </button>
          )}

          {/* Word count & Saved indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.725rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
            <span>{wordCount} words</span>
            {isSaved ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#10b981' }}>
                <Check size={11} /> Saved
              </span>
            ) : (
              <span style={{ color: '#f59e0b' }}>Saving...</span>
            )}
          </div>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={`• Reflect on today's wins\n• Obstacles overcome\n• Ideas for tomorrow... (Press Enter to continue bullets)`}
        rows={isCompact ? 4 : 8}
        style={{
          width: '100%',
          backgroundColor: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          fontSize: '0.85rem',
          lineHeight: '1.7',
          resize: 'vertical',
          minHeight: isCompact ? '85px' : '150px',
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
    </div>
  );
};
