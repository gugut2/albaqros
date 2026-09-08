import React, { useState, useEffect } from 'react';
import { Target, X, Calendar, Plus, Check } from 'lucide-react';
import { MajorTask } from '../types';

interface MajorTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMajorTask: (majorTaskData: Omit<MajorTask, 'id' | 'createdAt' | 'completed' | 'completedAt'>, existingId?: string) => void;
  editingMajorTask?: MajorTask | null;
  themes: string[];
}

export const MajorTaskModal: React.FC<MajorTaskModalProps> = ({
  isOpen,
  onClose,
  onSaveMajorTask,
  editingMajorTask,
  themes,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState(themes[0] || 'Work');
  const [targetDate, setTargetDate] = useState('');

  useEffect(() => {
    if (editingMajorTask) {
      setTitle(editingMajorTask.title);
      setDescription(editingMajorTask.description || '');
      setTheme(editingMajorTask.theme || themes[0] || 'Work');
      setTargetDate(editingMajorTask.targetDate || '');
    } else {
      setTitle('');
      setDescription('');
      setTheme(themes[0] || 'Work');
      setTargetDate('');
    }
  }, [editingMajorTask, isOpen, themes]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSaveMajorTask(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        theme,
        targetDate: targetDate || undefined,
      },
      editingMajorTask?.id
    );

    onClose();
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
          maxWidth: '500px',
          padding: '24px',
          backgroundColor: '#12161f',
          border: '1px solid rgba(99, 102, 241, 0.35)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <Target size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {editingMajorTask ? 'Edit Major Task / Milestone' : 'Create Major Task / Project'}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Large goal with live progress tracking from daily tasks
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              MAJOR GOAL / PROJECT TITLE
            </label>
            <input
              type="text"
              placeholder="e.g. Q3 Core Roadmap, Half-Marathon Training, Apartment Renovation..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              PURPOSE & SCOPE (OPTIONAL)
            </label>
            <textarea
              placeholder="Why this matters, key milestones, or definitions of done..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Theme / Facet Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              THEME / CATEGORY
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {themes.map((th) => {
                const isSelected = theme.toLowerCase() === th.toLowerCase();
                return (
                  <button
                    key={th}
                    type="button"
                    onClick={() => setTheme(th)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    #{th.toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Date */}
          <div>
            <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              TARGET COMPLETION DEADLINE (OPTIONAL)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                }}
              />
              {targetDate && (
                <button
                  type="button"
                  onClick={() => setTargetDate('')}
                  className="btn-icon"
                  style={{ padding: '6px' }}
                  title="Clear deadline"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!title.trim()}>
              <Check size={14} /> {editingMajorTask ? 'Save Changes' : 'Create Major Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
