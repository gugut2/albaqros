import React from 'react';
import { Check, Star, Zap, Coffee, RotateCcw, AlertTriangle, Trash2, Target } from 'lucide-react';
import { MajorTask, Task } from '../types';
import { getRecurrenceDescription } from '../services/recurrence';
import { calculateMajorTaskProgress } from '../services/majorTasks';

interface TaskItemProps {
  task: Task;
  majorTasks?: MajorTask[];
  allTasks?: Task[];
  onToggleComplete: (taskId: string) => void;
  onToggleTopFocus: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onRescueStaleTask: (task: Task) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  majorTasks,
  allTasks,
  onToggleComplete,
  onToggleTopFocus,
  onDeleteTask,
  onRescueStaleTask,
}) => {
  const isMissed = !task.completed && (task.daysMissed || 0) > 0;
  const isSeverelyMissed = (task.daysMissed || 0) >= 3;

  const linkedMajor = majorTasks?.find((m) => m.id === task.majorTaskId);
  const majorProgress = linkedMajor && allTasks ? calculateMajorTaskProgress(linkedMajor, allTasks) : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        backgroundColor: task.isTopFocus
          ? 'rgba(99, 102, 241, 0.08)'
          : 'var(--bg-card)',
        border: task.isTopFocus
          ? '1px solid rgba(99, 102, 241, 0.35)'
          : '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        marginBottom: '6px',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: task.isTopFocus ? '0 0 16px rgba(99, 102, 241, 0.15)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Focus Accent Glow Bar */}
      {task.isTopFocus && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '3px',
            background: 'linear-gradient(180deg, #6366f1 0%, #06b6d4 100%)',
          }}
        />
      )}

      {/* Left side: Checkbox + Content */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
        {/* Custom Checkbox */}
        <button
          type="button"
          onClick={() => onToggleComplete(task.id)}
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '5px',
            backgroundColor: task.completed ? 'var(--accent-emerald)' : 'rgba(255, 255, 255, 0.06)',
            border: task.completed
              ? '1px solid var(--accent-emerald)'
              : '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            marginTop: '2px',
            transition: 'all 0.2s ease',
            color: '#ffffff',
          }}
        >
          {task.completed && <Check size={13} strokeWidth={3} />}
        </button>

        {/* Task Title & Badges */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: '6px' }}>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: task.isTopFocus ? 600 : 400,
              color: task.completed ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: task.completed ? 'line-through' : 'none',
              wordBreak: 'break-word',
              lineHeight: 1.4,
            }}
          >
            {task.title}
          </div>

          {/* Metadata Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px',
              marginTop: '4px',
            }}
          >
            {/* Major Goal Link Badge */}
            {linkedMajor && (
              <span
                title={`Linked to Major Goal: ${linkedMajor.title}${majorProgress ? ` • ${majorProgress.label}` : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.675rem',
                  fontWeight: 600,
                  color: '#38bdf8',
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '1px 7px',
                  borderRadius: '4px',
                }}
              >
                <Target size={10} />
                <span>{linkedMajor.title}</span>
                {majorProgress && (
                  <span style={{ opacity: 0.85, fontSize: '0.625rem', marginLeft: '1px' }}>
                    ({majorProgress.percentage}%)
                  </span>
                )}
              </span>
            )}

            {/* Theme Badge */}
            {task.theme && (
              <span
                style={{
                  fontSize: '0.675rem',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 500,
                }}
              >
                #{task.theme.toLowerCase()}
              </span>
            )}

            {/* Energy Badge */}
            {task.energy === 'high' && (
              <span className="badge badge-energy-high">
                <Zap size={10} /> Focus ⚡
              </span>
            )}
            {task.energy === 'low' && (
              <span className="badge badge-energy-low">
                <Coffee size={10} /> Light ☕
              </span>
            )}

            {/* Recurrence Badge */}
            {task.recurrence?.isRecurring && (
              <span
                title={getRecurrenceDescription(task.recurrence)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.675rem',
                  color: task.recurrence.type === 'cycle' ? '#c7d2fe' : '#93c5fd',
                  backgroundColor: task.recurrence.type === 'cycle' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(59, 130, 246, 0.12)',
                  border: task.recurrence.type === 'cycle' ? '1px solid rgba(99, 102, 241, 0.35)' : 'none',
                  padding: '1px 6px',
                  borderRadius: '4px',
                }}
              >
                <RotateCcw size={9} />
                {task.recurrence.type === 'cycle'
                  ? `${task.recurrence.activeDays || 3}d on / ${task.recurrence.skipDays || 1}d off`
                  : task.recurrence.type === 'interval_days'
                  ? `${task.recurrence.intervalDays}d`
                  : task.recurrence.type === 'daily'
                  ? 'daily'
                  : task.recurrence.type === 'weekdays'
                  ? 'mon–fri'
                  : task.recurrence.type === 'weekends'
                  ? 'weekends'
                  : task.recurrence.type === 'monthly'
                  ? `m-day ${task.recurrence.monthlyDay}`
                  : 'weekly'}
              </span>
            )}

            {/* Missed Days Badge (Clickable for Stale Rescue) */}
            {isMissed && (
              <button
                type="button"
                onClick={() => onRescueStaleTask(task)}
                title="Click to resolve this stale task (Break down, Defer, or Archive)"
                className={`badge ${isSeverelyMissed ? 'badge-missed-urgent' : 'badge-missed'}`}
                style={{
                  cursor: 'pointer',
                  borderStyle: 'dashed',
                }}
              >
                <AlertTriangle size={10} />
                Missed {task.daysMissed}d
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
        {/* Star / Top Focus Toggle */}
        <button
          type="button"
          onClick={() => onToggleTopFocus(task.id)}
          title={task.isTopFocus ? 'Remove from #1 Focus' : 'Set as #1 Focus of the Day'}
          className="btn-icon"
          style={{
            color: task.isTopFocus ? '#facc15' : 'var(--text-muted)',
            padding: '5px',
          }}
        >
          <Star size={14} fill={task.isTopFocus ? '#facc15' : 'transparent'} />
        </button>

        {/* Delete Task */}
        <button
          type="button"
          onClick={() => onDeleteTask(task.id)}
          title="Delete Task"
          className="btn-icon"
          style={{ color: 'var(--text-muted)', padding: '5px' }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};
