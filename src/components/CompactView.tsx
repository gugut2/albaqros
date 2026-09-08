import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Filter, Zap, Coffee, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DayEntry, EnergyLevel, MajorTask, Task } from '../types';
import { TaskItem } from './TaskItem';
import { JournalSection } from './JournalSection';
import { formatDateLabel, getTodayString } from '../services/storage';

interface CompactViewProps {
  currentDate: string;
  tasks: Task[];
  entry?: DayEntry;
  majorTasks?: MajorTask[];
  onPrevDay: () => void;
  onNextDay: () => void;
  onToggleComplete: (taskId: string) => void;
  onToggleTopFocus: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onRescueStaleTask: (task: Task) => void;
  onOpenCreateTask: () => void;
  onUpdateJournal: (dateStr: string, text: string) => void;
  onUpdateEnergy: (dateStr: string, level: number) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onAddSubtask?: (taskId: string, title: string) => void;
  onDeleteSubtask?: (taskId: string, subtaskId: string) => void;
}

export const CompactView: React.FC<CompactViewProps> = ({
  currentDate,
  tasks,
  entry,
  majorTasks,
  onPrevDay,
  onNextDay,
  onToggleComplete,
  onToggleTopFocus,
  onDeleteTask,
  onRescueStaleTask,
  onOpenCreateTask,
  onUpdateJournal,
  onUpdateEnergy,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
}) => {
  const [energyFilter, setEnergyFilter] = useState<'all' | 'high' | 'low'>('all');

  const isToday = currentDate === getTodayString();
  const dateLabel = formatDateLabel(currentDate);

  // Filter tasks for current date and energy filter
  const dayTasks = tasks.filter((t) => t.date === currentDate && !t.archived);
  const filteredTasks = dayTasks.filter((t) => {
    if (energyFilter === 'high') return t.energy === 'high';
    if (energyFilter === 'low') return t.energy === 'low';
    return true;
  });

  const totalTasks = dayTasks.length;
  const completedTasks = dayTasks.filter((t) => t.completed).length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Split top focus vs standard
  const topFocusTask = filteredTasks.find((t) => t.isTopFocus);
  const otherTasks = filteredTasks.filter((t) => !t.isTopFocus);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '12px',
        gap: '12px',
        overflowY: 'auto',
      }}
    >
      {/* Date Header & Progress Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button type="button" onClick={onPrevDay} className="btn-icon" style={{ padding: '3px' }}>
              <ChevronLeft size={14} />
            </button>
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: isToday ? 'var(--text-primary)' : 'var(--accent-indigo)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {isToday ? 'Today, ' : ''}
              {dateLabel}
            </span>
            <button type="button" onClick={onNextDay} className="btn-icon" style={{ padding: '3px' }}>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Quick Counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <CheckCircle2 size={13} color="#10b981" />
            <span>
              <strong>{completedTasks}</strong>/{totalTasks} done ({progressPct}%)
            </span>
          </div>
        </div>

        {/* Minimal Progress Bar */}
        <div
          style={{
            height: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: progressPct === 100 ? '#10b981' : 'linear-gradient(90deg, #6366f1 0%, #06b6d4 100%)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Energy Quick Filters & Add Task Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setEnergyFilter('all')}
            className={`badge ${energyFilter === 'all' ? 'badge-energy-high' : ''}`}
            style={{
              cursor: 'pointer',
              border: energyFilter === 'all' ? '1px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
              backgroundColor: energyFilter === 'all' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: energyFilter === 'all' ? '#a5b4fc' : 'var(--text-muted)',
              fontSize: '0.7rem',
              padding: '2px 8px',
            }}
          >
            All ({dayTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setEnergyFilter('high')}
            style={{
              cursor: 'pointer',
              border: energyFilter === 'high' ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
              backgroundColor: energyFilter === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              color: energyFilter === 'high' ? '#f87171' : 'var(--text-muted)',
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <Zap size={10} /> Focus ⚡
          </button>
          <button
            type="button"
            onClick={() => setEnergyFilter('low')}
            style={{
              cursor: 'pointer',
              border: energyFilter === 'low' ? '1px solid #10b981' : '1px solid var(--border-subtle)',
              backgroundColor: energyFilter === 'low' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: energyFilter === 'low' ? '#34d399' : 'var(--text-muted)',
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <Coffee size={10} /> Light ☕
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenCreateTask}
          className="btn-primary"
          style={{ fontSize: '0.775rem', padding: '4px 10px' }}
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Top Focus Pinned Section */}
        {topFocusTask && (
          <div style={{ marginBottom: '6px' }}>
            <div
              style={{
                fontSize: '0.675rem',
                fontWeight: 700,
                color: '#facc15',
                letterSpacing: '0.05em',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>⭐ TODAY'S #1 FOCUS</span>
            </div>
            <TaskItem
              task={topFocusTask}
              majorTasks={majorTasks}
              allTasks={tasks}
              onToggleComplete={onToggleComplete}
              onToggleTopFocus={onToggleTopFocus}
              onDeleteTask={onDeleteTask}
              onRescueStaleTask={onRescueStaleTask}
              onToggleSubtask={onToggleSubtask}
              onAddSubtask={onAddSubtask}
              onDeleteSubtask={onDeleteSubtask}
            />
          </div>
        )}

        {/* Regular Tasks */}
        {otherTasks.map((t) => (
          <TaskItem
            key={t.id}
            task={t}
            majorTasks={majorTasks}
            allTasks={tasks}
            onToggleComplete={onToggleComplete}
            onToggleTopFocus={onToggleTopFocus}
            onDeleteTask={onDeleteTask}
            onRescueStaleTask={onRescueStaleTask}
            onToggleSubtask={onToggleSubtask}
            onAddSubtask={onAddSubtask}
            onDeleteSubtask={onDeleteSubtask}
          />
        ))}

        {filteredTasks.length === 0 && (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.825rem',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-subtle)',
              marginBottom: '10px',
            }}
          >
            No tasks found for this filter.
            <div style={{ marginTop: '6px' }}>
              <button
                type="button"
                onClick={onOpenCreateTask}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-indigo)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                + Create a task
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Journaling Underneath Checklist */}
      <JournalSection
        entry={entry}
        dateStr={currentDate}
        onUpdateJournal={onUpdateJournal}
        onUpdateEnergy={onUpdateEnergy}
        isCompact={true}
      />
    </div>
  );
};
