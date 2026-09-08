import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Check, Zap, List, Plus } from 'lucide-react';
import { DayEntry } from '../types';

interface JournalSectionProps {
  entry?: DayEntry;
  dateStr: string;
  onUpdateJournal: (dateStr: string, text: string) => void;
  onUpdateEnergy: (dateStr: string, level: number) => void;
  isCompact?: boolean;
}

export const JournalSection: React.FC<JournalSectionProps> = ({
  entry,
  dateStr,
  onUpdateJournal,
  onUpdateEnergy,
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
   * Smart Bullet Management on Enter / Backspace:
   * - Hitting Enter on a bulleted line creates a new bullet point automatically.
   * - Hitting Enter on an empty bullet line clears the bullet and creates a clean line.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart, selectionEnd, value } = textarea;
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const lineEnd = value.indexOf('\n', selectionStart);
      const currentLine = value.substring(lineStart, lineEnd === -1 ? value.length : lineEnd);

      // Check if current line starts with bullet • or - or *
      const bulletMatch = currentLine.match(/^(\s*)(•|-|\*)\s+/);
      if (bulletMatch) {
        e.preventDefault();
        const indent = bulletMatch[1];
        const trimmed = currentLine.trim();

        // If line contains ONLY the bullet symbol, exit bullet mode on Enter
        if (trimmed === '•' || trimmed === '-' || trimmed === '*') {
          const newValue = value.substring(0, lineStart) + value.substring(selectionStart);
          setContent(newValue);
          setIsSaved(false);
          onUpdateJournal(dateStr, newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = lineStart;
            setIsSaved(true);
          }, 0);
          return;
        }

        // Insert new bullet on next line
        const bulletText = `\n${indent}• `;
        const newValue = value.substring(0, selectionStart) + bulletText + value.substring(selectionEnd);
        setContent(newValue);
        setIsSaved(false);
        onUpdateJournal(dateStr, newValue);

        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + bulletText.length;
          setIsSaved(true);
        }, 0);
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

  const energyLevel = entry?.energyLevel || 3;
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const bulletCount = (content.match(/•/g) || []).length;
  const energyLabels = ['Drained', 'Low', 'Balanced', 'High Focus', 'Peak Flow'];

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

      {/* Energy Spark Slider / Dots */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <Zap size={12} color="#f59e0b" />
          Energy: <strong style={{ color: 'var(--text-primary)', marginLeft: '2px' }}>{energyLabels[energyLevel - 1]}</strong>
        </span>

        <div style={{ display: 'flex', gap: '4px' }}>
          {[1, 2, 3, 4, 5].map((lvl) => {
            const isSelected = lvl <= energyLevel;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onUpdateEnergy(dateStr, lvl)}
                title={`Level ${lvl}: ${energyLabels[lvl - 1]}`}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '3px',
                  border: 'none',
                  backgroundColor: isSelected ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: isSelected ? 1 : 0.4,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Textarea with Smart Bullet Handling */}
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
