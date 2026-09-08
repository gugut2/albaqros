import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Zap,
  Trash2,
  Edit2,
  Plus,
  ExternalLink,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import { AppData, Task } from '../types';
import { formatDateLabel } from '../services/storage';

interface HistoryViewProps {
  data: AppData;
  onSelectDate: (dateStr: string) => void;
  onUpdateJournal: (dateStr: string, text: string) => void;
  onUpdateEnergy: (dateStr: string, level: number) => void;
  onToggleComplete: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskTitle: (taskId: string, newTitle: string) => void;
  onAddTaskToDate: (dateStr: string, title: string, theme: string) => void;
  onDeleteDay: (dateStr: string) => void;
  onOpenInStudio: (dateStr: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  data,
  onSelectDate,
  onUpdateJournal,
  onUpdateEnergy,
  onToggleComplete,
  onDeleteTask,
  onUpdateTaskTitle,
  onAddTaskToDate,
  onDeleteDay,
  onOpenInStudio,
}) => {
  // Collect all unique dates from entries and tasks
  const dateSet = new Set<string>();
  Object.keys(data.entries).forEach((d) => dateSet.add(d));
  data.tasks.forEach((t) => dateSet.add(t.date));

  const sortedDates = Array.from(dateSet).sort().reverse();
  const [selectedDate, setSelectedDate] = useState<string>(sortedDates[0] || '');

  // Edit / Delete states
  const [isConfirmingDeleteDay, setIsConfirmingDeleteDay] = useState<boolean>(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState<string>('');
  const [isAddingTask, setIsAddingTask] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskTheme, setNewTaskTheme] = useState<string>('Work');

  const dayTasks = data.tasks.filter((t) => t.date === selectedDate && !t.archived);
  const dayEntry = data.entries[selectedDate];

  const completedCount = dayTasks.filter((t) => t.completed).length;
  const currentEnergy = dayEntry?.energyLevel || 3;
  const energyLabels = ['Drained', 'Low', 'Balanced', 'High Focus', 'Peak Flow'];

  const handleStartEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitleInput(task.title);
  };

  const handleSaveEditTask = (taskId: string) => {
    if (editTitleInput.trim()) {
      onUpdateTaskTitle(taskId, editTitleInput.trim());
    }
    setEditingTaskId(null);
  };

  const handleCreateTaskForDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTaskToDate(selectedDate, newTaskTitle.trim(), newTaskTheme);
    setNewTaskTitle('');
    setIsAddingTask(false);
  };

  const handleDeleteCurrentDay = () => {
    onDeleteDay(selectedDate);
    setIsConfirmingDeleteDay(false);
    const remaining = sortedDates.filter((d) => d !== selectedDate);
    if (remaining.length > 0) {
      setSelectedDate(remaining[0]);
    } else {
      setSelectedDate('');
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', height: '100%' }}>
      {/* Date List Column */}
      <div
        className="glass-panel"
        style={{
          padding: '14px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.05em',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Calendar size={13} />
          PAST ENTRIES & DAYS ({sortedDates.length})
        </div>

        {sortedDates.map((dateStr) => {
          const isSelected = dateStr === selectedDate;
          const tasksOnDay = data.tasks.filter((t) => t.date === dateStr && !t.archived);
          const done = tasksOnDay.filter((t) => t.completed).length;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => {
                setSelectedDate(dateStr);
                setIsConfirmingDeleteDay(false);
                setEditingTaskId(null);
                setIsAddingTask(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                border: isSelected ? '1px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ fontSize: '0.825rem', fontWeight: 600 }}>{formatDateLabel(dateStr)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{dateStr}</div>
              </div>
              <div style={{ fontSize: '0.725rem', fontWeight: 600, color: done > 0 ? '#10b981' : 'var(--text-muted)' }}>
                {done}/{tasksOnDay.length}
              </div>
            </button>
          );
        })}

        {sortedDates.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            No past entries recorded.
          </div>
        )}
      </div>

      {/* Detail & Edit Column */}
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {selectedDate ? (
          <>
            {/* Header with Day Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '14px',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {formatDateLabel(selectedDate)}
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selectedDate}</span>
              </div>

              {/* Day Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Open in Studio Agenda */}
                <button
                  type="button"
                  onClick={() => onOpenInStudio(selectedDate)}
                  className="btn-secondary"
                  style={{ fontSize: '0.775rem', padding: '6px 10px' }}
                  title="Open this date in Today's studio agenda"
                >
                  <ExternalLink size={13} /> Open in Studio
                </button>

                {/* Delete Entire Day */}
                {!isConfirmingDeleteDay ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDeleteDay(true)}
                    className="btn-secondary"
                    style={{
                      fontSize: '0.775rem',
                      padding: '6px 10px',
                      color: '#f87171',
                      borderColor: 'rgba(239, 68, 68, 0.3)',
                    }}
                    title="Delete this entire day and all its tasks"
                  >
                    <Trash2 size={13} /> Delete Day
                  </button>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid #ef4444',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: '#fca5a5', fontWeight: 600 }}>Confirm Delete?</span>
                    <button
                      type="button"
                      onClick={handleDeleteCurrentDay}
                      style={{
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '0.725rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDeleteDay(false)}
                      className="btn-icon"
                      style={{ padding: '2px' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Editable Tasks on this Day */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Tasks ({completedCount}/{dayTasks.length} Completed)
                </h3>

                {!isAddingTask && (
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-indigo)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={12} /> Add Task to this day
                  </button>
                )}
              </div>

              {/* Quick Add Task to Past Day Input */}
              {isAddingTask && (
                <form
                  onSubmit={handleCreateTaskForDay}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                    padding: '8px 10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Task title..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    autoFocus
                    style={{
                      flex: 1,
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      padding: '5px 8px',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <select
                    value={newTaskTheme}
                    onChange={(e) => setNewTaskTheme(e.target.value)}
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      padding: '5px 8px',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {(data.customThemes || ['Work', 'Health', 'Chores', 'Personal']).map((th) => (
                      <option key={th} value={th}>
                        #{th}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn-primary" style={{ padding: '5px 10px', fontSize: '0.725rem' }}>
                    <Check size={12} /> Add
                  </button>
                  <button type="button" onClick={() => setIsAddingTask(false)} className="btn-icon" style={{ padding: '4px' }}>
                    <X size={12} />
                  </button>
                </form>
              )}

              {/* Tasks List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {dayTasks.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-subtle)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Left: Checkbox + Title / Edit Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => onToggleComplete(t.id)}
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          backgroundColor: t.completed ? 'var(--accent-emerald)' : 'transparent',
                          border: t.completed ? '1px solid var(--accent-emerald)' : '1px solid var(--border-medium)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#ffffff',
                          flexShrink: 0,
                        }}
                      >
                        {t.completed && <Check size={12} strokeWidth={3} />}
                      </button>

                      {editingTaskId === t.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                          <input
                            type="text"
                            value={editTitleInput}
                            onChange={(e) => setEditTitleInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditTask(t.id);
                              if (e.key === 'Escape') setEditingTaskId(null);
                            }}
                            autoFocus
                            style={{
                              flex: 1,
                              backgroundColor: 'var(--bg-input)',
                              border: '1px solid var(--accent-indigo)',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '0.85rem',
                              color: 'var(--text-primary)',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditTask(t.id)}
                            className="btn-primary"
                            style={{ padding: '4px 8px', fontSize: '0.725rem' }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTaskId(null)}
                            className="btn-icon"
                            style={{ padding: '3px' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.85rem',
                            textDecoration: t.completed ? 'line-through' : 'none',
                            color: t.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                            wordBreak: 'break-word',
                          }}
                        >
                          {t.title}
                        </span>
                      )}
                    </div>

                    {/* Right: Theme + Edit & Delete buttons */}
                    {editingTaskId !== t.id && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>#{t.theme}</span>
                        <button
                          type="button"
                          onClick={() => handleStartEditTask(t)}
                          className="btn-icon"
                          title="Edit Task Title"
                          style={{ padding: '4px' }}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTask(t.id)}
                          className="btn-icon"
                          title="Delete Task"
                          style={{ padding: '4px', color: '#f87171' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {dayTasks.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '10px 0' }}>
                    No tasks logged for this day.
                  </div>
                )}
              </div>
            </div>

            {/* Editable Daily Journal Reflection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Header for Journal */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookOpen size={15} color="#818cf8" />
                    Journal Reflection (Editable)
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const currentText = dayEntry?.journal || '';
                      const isStartOfLine = currentText.length === 0 || currentText.endsWith('\n');
                      const bulletToInsert = isStartOfLine ? '• ' : '\n• ';
                      onUpdateJournal(selectedDate, currentText + bulletToInsert);
                    }}
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
                    title="Add bullet point"
                  >
                    <span>• Bullet</span>
                  </button>
                </div>

                {/* Interactive Energy Level */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Energy: <strong style={{ color: '#f59e0b' }}>{energyLabels[currentEnergy - 1]}</strong>
                  </span>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => onUpdateEnergy(selectedDate, lvl)}
                        title={`Energy ${lvl}/5`}
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '3px',
                          border: 'none',
                          backgroundColor: lvl <= currentEnergy ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)',
                          cursor: 'pointer',
                          opacity: lvl <= currentEnergy ? 1 : 0.4,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Direct Textarea for editing journal reflection with bullet Enter handling */}
              <textarea
                value={dayEntry?.journal || ''}
                onChange={(e) => onUpdateJournal(selectedDate, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const textarea = e.currentTarget;
                    const { selectionStart, selectionEnd, value } = textarea;
                    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
                    const lineEnd = value.indexOf('\n', selectionStart);
                    const currentLine = value.substring(lineStart, lineEnd === -1 ? value.length : lineEnd);
                    const bulletMatch = currentLine.match(/^(\s*)(•|-|\*)\s+/);
                    if (bulletMatch) {
                      e.preventDefault();
                      const indent = bulletMatch[1];
                      if (currentLine.trim() === '•' || currentLine.trim() === '-' || currentLine.trim() === '*') {
                        const newValue = value.substring(0, lineStart) + value.substring(selectionStart);
                        onUpdateJournal(selectedDate, newValue);
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd = lineStart;
                        }, 0);
                        return;
                      }
                      const bulletText = `\n${indent}• `;
                      const newValue = value.substring(0, selectionStart) + bulletText + value.substring(selectionEnd);
                      onUpdateJournal(selectedDate, newValue);
                      setTimeout(() => {
                        textarea.selectionStart = textarea.selectionEnd = selectionStart + bulletText.length;
                      }, 0);
                    }
                  }
                }}
                placeholder={`• Freeform reflection or bullet points...\n• Press Enter to continue bullets`}
                rows={6}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  fontSize: '0.85rem',
                  lineHeight: '1.7',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>
            Select a date on the left to view and edit history.
          </div>
        )}
      </div>
    </div>
  );
};
