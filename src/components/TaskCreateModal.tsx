import React, { useState } from 'react';
import { Plus, X, Zap, Coffee, Star, RotateCcw, Calendar, Check, ListTree } from 'lucide-react';
import { EnergyLevel, MajorTask, RecurrenceRule, RecurrenceType, Subtask, Task } from '../types';

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (taskData: Omit<Task, 'id' | 'createdAt' | 'daysMissed'>) => void;
  currentDate: string;
  themes?: string[];
  onAddTheme?: (theme: string) => void;
  majorTasks?: MajorTask[];
}

const DEFAULT_THEMES = ['Work', 'Health', 'Chores', 'Personal'];
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  isOpen,
  onClose,
  onAddTask,
  currentDate,
  themes = DEFAULT_THEMES,
  onAddTheme,
  majorTasks = [],
}) => {
  const [title, setTitle] = useState('');
  const [selectedMajorTaskId, setSelectedMajorTaskId] = useState<string>('');
  const [theme, setTheme] = useState(themes[0] || 'Work');
  const [customThemeInput, setCustomThemeInput] = useState('');
  const [isCreatingTheme, setIsCreatingTheme] = useState(false);
  const [energy, setEnergy] = useState<EnergyLevel>('normal');
  const [isTopFocus, setIsTopFocus] = useState(false);
  const [notes, setNotes] = useState('');
  const [subtasksList, setSubtasksList] = useState<string[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');

  // Recurrence states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('cycle');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri by default
  const [intervalDays, setIntervalDays] = useState<number>(4);
  const [timesPerWeek, setTimesPerWeek] = useState<number>(3);
  const [activeDays, setActiveDays] = useState<number>(3);
  const [skipDays, setSkipDays] = useState<number>(1);
  const [cycleStartDate, setCycleStartDate] = useState<string>(currentDate);
  const [monthlyDay, setMonthlyDay] = useState<number>(1);

  if (!isOpen) return null;

  const handleAddSubtaskItem = () => {
    const trimmed = newSubtaskInput.trim();
    if (trimmed) {
      setSubtasksList((prev) => [...prev, trimmed]);
      setNewSubtaskInput('');
    }
  };

  const handleRemoveSubtaskItem = (index: number) => {
    setSubtasksList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let recurrenceRule: RecurrenceRule | undefined = undefined;
    if (isRecurring) {
      recurrenceRule = {
        isRecurring: true,
        type: recurrenceType,
        daysOfWeek: recurrenceType === 'weekly_days' ? selectedDays : undefined,
        intervalDays: recurrenceType === 'interval_days' ? intervalDays : undefined,
        timesPerWeek: recurrenceType === 'times_per_week' ? timesPerWeek : undefined,
        activeDays: recurrenceType === 'cycle' ? Math.max(1, activeDays) : undefined,
        skipDays: recurrenceType === 'cycle' ? Math.max(1, skipDays) : undefined,
        cycleStartDate: recurrenceType === 'cycle' ? cycleStartDate : undefined,
        monthlyDay: recurrenceType === 'monthly' ? monthlyDay : undefined,
      };
    }

    const generatedSubtasks: Subtask[] | undefined =
      subtasksList.length > 0
        ? subtasksList.map((stTitle, idx) => ({
            id: `sub-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
            title: stTitle,
            completed: false,
          }))
        : undefined;

    onAddTask({
      title: title.trim(),
      theme: theme.trim() || 'General',
      energy,
      isTopFocus,
      completed: false,
      date: currentDate,
      recurrence: recurrenceRule,
      majorTaskId: selectedMajorTaskId || undefined,
      subtasks: generatedSubtasks,
      notes: notes.trim() || undefined,
    });

    // Reset and close
    setTitle('');
    setSelectedMajorTaskId('');
    setNotes('');
    setSubtasksList([]);
    setNewSubtaskInput('');
    setIsTopFocus(false);
    setIsRecurring(false);
    setIsCreatingTheme(false);
    setCustomThemeInput('');
    onClose();
  };

  const handleSaveNewTheme = () => {
    const trimmed = customThemeInput.trim();
    if (trimmed) {
      const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      if (onAddTheme) {
        onAddTheme(formatted);
      }
      setTheme(formatted);
      setCustomThemeInput('');
      setIsCreatingTheme(false);
    }
  };

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
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
          maxWidth: '480px',
          padding: '24px',
          backgroundColor: '#12161f',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
              }}
            >
              <Plus size={16} />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Create New Task</h3>
          </div>
          <button type="button" onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Title Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              TASK TITLE
            </label>
            <input
              type="text"
              placeholder="e.g. Deep clean kitchen, Finish client pitch, Run 5km..."
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

          {/* Theme Selection */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                THEME / FACET
              </label>
              {!isCreatingTheme && (
                <button
                  type="button"
                  onClick={() => setIsCreatingTheme(true)}
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
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  <Plus size={12} /> New Theme
                </button>
              )}
            </div>

            {/* Inline New Theme Creator */}
            {isCreatingTheme && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '10px',
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                <input
                  type="text"
                  placeholder="e.g. Finance, Reading, Coding..."
                  value={customThemeInput}
                  onChange={(e) => setCustomThemeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveNewTheme();
                    } else if (e.key === 'Escape') {
                      setIsCreatingTheme(false);
                    }
                  }}
                  autoFocus
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '4px',
                    padding: '5px 8px',
                    fontSize: '0.8rem',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveNewTheme}
                  disabled={!customThemeInput.trim()}
                  className="btn-primary"
                  style={{ padding: '5px 10px', fontSize: '0.725rem' }}
                >
                  <Check size={12} /> Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingTheme(false)}
                  className="btn-icon"
                  style={{ padding: '4px' }}
                >
                  <X size={12} />
                </button>
              </div>
            )}

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

          {/* Link to Major Goal / Project (Optional) */}
          {majorTasks && majorTasks.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                LINK TO MAJOR PROJECT / GOAL (OPTIONAL)
              </label>
              <select
                value={selectedMajorTaskId}
                onChange={(e) => setSelectedMajorTaskId(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  color: selectedMajorTaskId ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <option value="">None (Standalone Daily Task)</option>
                {majorTasks.map((major) => (
                  <option key={major.id} value={major.id}>
                    🎯 {major.title} (#{major.theme})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Energy Intensity & Top Focus Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Energy Level */}
            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                ENERGY INTENSITY
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setEnergy(energy === 'high' ? 'normal' : 'high')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: energy === 'high' ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                    backgroundColor: energy === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                    color: energy === 'high' ? '#f87171' : 'var(--text-secondary)',
                  }}
                >
                  <Zap size={12} /> Heavy ⚡
                </button>
                <button
                  type="button"
                  onClick={() => setEnergy(energy === 'low' ? 'normal' : 'low')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: energy === 'low' ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                    backgroundColor: energy === 'low' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                    color: energy === 'low' ? '#34d399' : 'var(--text-secondary)',
                  }}
                >
                  <Coffee size={12} /> Light ☕
                </button>
              </div>
            </div>

            {/* Top Focus Toggle */}
            <div>
              <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                TODAY'S #1 FOCUS
              </label>
              <button
                type="button"
                onClick={() => setIsTopFocus(!isTopFocus)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isTopFocus ? '1px solid #facc15' : '1px solid var(--border-subtle)',
                  backgroundColor: isTopFocus ? 'rgba(250, 204, 21, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  color: isTopFocus ? '#facc15' : 'var(--text-secondary)',
                }}
              >
                <Star size={12} fill={isTopFocus ? '#facc15' : 'transparent'} />
                {isTopFocus ? 'Pinned Focus ⭐' : 'Regular Task'}
              </button>
            </div>
          </div>

          {/* Subtasks / Checklist Section (Optional) */}
          <div
            style={{
              padding: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ListTree size={14} color="#818cf8" />
                <span style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  SUBTASKS / CHECKLIST (OPTIONAL)
                </span>
              </div>
              {subtasksList.length > 0 && (
                <span style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 600 }}>
                  {subtasksList.length} subtask{subtasksList.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: subtasksList.length > 0 ? '8px' : '0' }}>
              <input
                type="text"
                placeholder="Add subtask step (press Enter)..."
                value={newSubtaskInput}
                onChange={(e) => setNewSubtaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtaskItem();
                  }
                }}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                type="button"
                onClick={handleAddSubtaskItem}
                disabled={!newSubtaskInput.trim()}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                <Plus size={12} /> Add
              </button>
            </div>

            {subtasksList.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  maxHeight: '130px',
                  overflowY: 'auto',
                  padding: '4px 6px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {subtasksList.map((st, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                      padding: '3px 6px',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{idx + 1}.</span>
                      {st}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtaskItem(idx)}
                      className="btn-icon"
                      style={{ padding: '2px', color: 'var(--text-muted)' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recurrence Config Section */}
          <div
            style={{
              padding: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isRecurring ? '12px' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={14} color="#818cf8" />
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Recurring Chore / Habit?
                </span>
              </div>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#6366f1' }}
              />
            </div>

            {isRecurring && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Recurrence Type Selector */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {[
                    { type: 'cycle', label: '🔄 On/Off Cycle' },
                    { type: 'daily', label: 'Every Day' },
                    { type: 'weekdays', label: 'Mon–Fri' },
                    { type: 'weekly_days', label: 'Custom Days' },
                    { type: 'interval_days', label: 'Interval' },
                    { type: 'monthly', label: 'Monthly' },
                  ].map((item) => {
                    const isSelected = recurrenceType === item.type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => setRecurrenceType(item.type as RecurrenceType)}
                        style={{
                          padding: '7px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.725rem',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          border: isSelected ? '1px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {/* 1. Cycle Pattern: X Days On, Y Days Off */}
                {recurrenceType === 'cycle' && (
                  <div
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'rgba(99, 102, 241, 0.06)',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                          Active for (Days on):
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={activeDays}
                            onChange={(e) => setActiveDays(Math.max(1, Number(e.target.value)))}
                            style={{
                              width: '60px',
                              backgroundColor: 'var(--bg-input)',
                              border: '1px solid var(--border-medium)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '5px 8px',
                              color: 'var(--text-primary)',
                              fontSize: '0.825rem',
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>day(s)</span>
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                          Then skip (Days off):
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={skipDays}
                            onChange={(e) => setSkipDays(Math.max(1, Number(e.target.value)))}
                            style={{
                              width: '60px',
                              backgroundColor: 'var(--bg-input)',
                              border: '1px solid var(--border-medium)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '5px 8px',
                              color: 'var(--text-primary)',
                              fontSize: '0.825rem',
                              textAlign: 'center',
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>day(s)</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px' }}>
                      <span style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                        Cycle start anchor:
                      </span>
                      <input
                        type="date"
                        value={cycleStartDate}
                        onChange={(e) => setCycleStartDate(e.target.value)}
                        style={{
                          backgroundColor: 'var(--bg-input)',
                          border: '1px solid var(--border-medium)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '3px 8px',
                          color: 'var(--text-primary)',
                          fontSize: '0.75rem',
                        }}
                      />
                    </div>

                    <div style={{ fontSize: '0.725rem', color: '#a5b4fc', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                      💡 Pattern: Active for {activeDays} days, followed by {skipDays} rest day(s). ({activeDays + skipDays}-day repeating cycle)
                    </div>
                  </div>
                )}

                {/* 2. Days of week selector */}
                {recurrenceType === 'weekly_days' && (
                  <div>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Repeat on:
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {DAYS_OF_WEEK.map((d, idx) => {
                        const isSelected = selectedDays.includes(idx);
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => toggleDay(idx)}
                            style={{
                              flex: 1,
                              padding: '5px 0',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: isSelected ? '1px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
                              backgroundColor: isSelected ? '#6366f1' : 'rgba(255, 255, 255, 0.05)',
                              color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                            }}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Interval Days Selector */}
                {recurrenceType === 'interval_days' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>Repeat every</span>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={intervalDays}
                      onChange={(e) => setIntervalDays(Math.max(1, Number(e.target.value)))}
                      style={{
                        width: '60px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 8px',
                        color: 'var(--text-primary)',
                        textAlign: 'center',
                        fontSize: '0.825rem',
                      }}
                    />
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>days (e.g. 4 for plants, 14 for sheets)</span>
                  </div>
                )}

                {/* 4. Weekdays Only */}
                {recurrenceType === 'weekdays' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '6px 8px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px' }}>
                    📅 Task will automatically activate Monday through Friday.
                  </div>
                )}

                {/* 5. Monthly Selector */}
                {recurrenceType === 'monthly' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>Repeat on day</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={monthlyDay}
                      onChange={(e) => setMonthlyDay(Math.min(31, Math.max(1, Number(e.target.value))))}
                      style={{
                        width: '60px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 8px',
                        color: 'var(--text-primary)',
                        textAlign: 'center',
                        fontSize: '0.825rem',
                      }}
                    />
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>of each month (e.g. 1st or 15th)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!title.trim()}>
              <Plus size={14} /> Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
