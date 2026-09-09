import React, { useState } from 'react';
import { AlertTriangle, Scissors, Calendar, CheckSquare, X, CalendarClock } from 'lucide-react';
import { Task } from '../types';

interface StaleRescueModalProps {
  task: Task | null;
  onClose: () => void;
  onBreakDown: (taskId: string, subtasks: string[]) => void;
  onDeferToWeekend: (taskId: string) => void;
  onArchive: (taskId: string) => void;
  onResetMissed: (taskId: string) => void;
  onConvertToMultiDay?: (taskId: string) => void;
}

export const StaleRescueModal: React.FC<StaleRescueModalProps> = ({
  task,
  onClose,
  onBreakDown,
  onDeferToWeekend,
  onArchive,
  onResetMissed,
  onConvertToMultiDay,
}) => {
  const [breakdownMode, setBreakdownMode] = useState(false);
  const [substep1, setSubstep1] = useState('');
  const [substep2, setSubstep2] = useState('');
  const [substep3, setSubstep3] = useState('');

  if (!task) return null;

  const handleBreakdownSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const steps = [substep1, substep2, substep3].map((s) => s.trim()).filter(Boolean);
    if (steps.length > 0) {
      onBreakDown(task.id, steps);
    }
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
          maxWidth: '440px',
          padding: '22px',
          backgroundColor: '#12161f',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
              }}
            >
              <AlertTriangle size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Stale Task Rescue
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                Missed {task.daysMissed} {task.daysMissed === 1 ? 'day' : 'days'}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        {/* Task Title Callout */}
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            borderLeft: '3px solid #f59e0b',
            fontSize: '0.875rem',
            color: 'var(--text-primary)',
            fontWeight: 500,
          }}
        >
          "{task.title}"
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
          Procrastination is often a sign of friction or vague scope. Choose a healthy action to keep your momentum going:
        </p>

        {!breakdownMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Option 1: Break it down */}
            <button
              type="button"
              onClick={() => setBreakdownMode(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = '#6366f1')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(99, 102, 241, 0.25)')}
            >
              <Scissors size={18} color="#818cf8" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Break down into micro-steps</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Split into 2 or 3 tiny 5-minute initial actions.
                </div>
              </div>
            </button>

            {/* Option 2: Schedule for weekend */}
            <button
              type="button"
              onClick={() => onDeferToWeekend(task.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = '#10b981')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(16, 185, 129, 0.25)')}
            >
              <Calendar size={18} color="#34d399" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Schedule for the weekend</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Move off today's plate and park it on Saturday.
                </div>
              </div>
            </button>

            {/* Option 3: Convert to Multi-Day & Carry to Tomorrow */}
            {onConvertToMultiDay && (
              <button
                type="button"
                onClick={() => onConvertToMultiDay(task.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = '#818cf8')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(99, 102, 241, 0.25)')}
              >
                <CalendarClock size={18} color="#818cf8" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Convert to Multi-Day & Carry to Tomorrow</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Keep all completed progress and continue smoothly without stale warnings.
                  </div>
                </div>
              </button>
            )}

            {/* Option 3: Let it go / Archive */}
            <button
              type="button"
              onClick={() => onArchive(task.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-medium)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)')}
            >
              <CheckSquare size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Drop it guilt-free (Archive)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  If it's no longer relevant or priority, clear the mental clutter.
                </div>
              </div>
            </button>
          </div>
        ) : (
          <form onSubmit={handleBreakdownSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              Enter 2–3 easy micro-steps to replace this heavy task:
            </span>
            <input
              type="text"
              placeholder="Step 1: e.g. Open document / clean the first tray"
              value={substep1}
              onChange={(e) => setSubstep1(e.target.value)}
              autoFocus
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontSize: '0.825rem',
                color: 'var(--text-primary)',
              }}
            />
            <input
              type="text"
              placeholder="Step 2: e.g. Gather supplies or write outline"
              value={substep2}
              onChange={(e) => setSubstep2(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontSize: '0.825rem',
                color: 'var(--text-primary)',
              }}
            />
            <input
              type="text"
              placeholder="Step 3 (optional): e.g. Finish final review"
              value={substep3}
              onChange={(e) => setSubstep3(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontSize: '0.825rem',
                color: 'var(--text-primary)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button type="button" onClick={() => setBreakdownMode(false)} className="btn-secondary">
                Back
              </button>
              <button type="submit" className="btn-primary">
                Create Micro-Tasks
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
