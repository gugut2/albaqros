import React, { useState } from 'react';
import {
  CheckSquare,
  BarChart2,
  Calendar,
  RotateCcw,
  Settings,
  Plus,
  Filter,
  Zap,
  Coffee,
  CheckCircle2,
  Sparkles,
  Target,
} from 'lucide-react';
import { AppData, DayEntry, MajorTask, Task } from '../types';
import { TaskItem } from './TaskItem';
import { JournalSection } from './JournalSection';
import { AnalyticsView } from './AnalyticsView';
import { HistoryView } from './HistoryView';
import { MajorTasksView } from './MajorTasksView';
import { formatDateLabel, getTodayString } from '../services/storage';
import { getRecurrenceDescription, getCycleStatus } from '../services/recurrence';

interface MaximizedViewProps {
  currentDate: string;
  data: AppData;
  entry?: DayEntry;
  onPrevDay: () => void;
  onNextDay: () => void;
  onSelectDate: (d: string) => void;
  onToggleComplete: (taskId: string) => void;
  onToggleTopFocus: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskTitle: (taskId: string, newTitle: string) => void;
  onAddTaskToDate: (dateStr: string, title: string, theme: string) => void;
  onDeleteDay: (dateStr: string) => void;
  onRescueStaleTask: (task: Task) => void;
  onOpenCreateTask: () => void;
  onUpdateJournal: (dateStr: string, text: string) => void;
  onUpdateEnergy: (dateStr: string, level: number) => void;
  onOpenSettings: () => void;
  onOpenCreateMajorTask?: () => void;
  onEditMajorTask?: (majorTask: MajorTask) => void;
  onDeleteMajorTask?: (majorTaskId: string) => void;
  onToggleCompleteMajorTask?: (majorTaskId: string) => void;
  onAddTaskToMajor?: (majorTaskId: string, title: string, theme: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onAddSubtask?: (taskId: string, title: string) => void;
  onDeleteSubtask?: (taskId: string, subtaskId: string) => void;
}

type StudioTab = 'today' | 'major' | 'analytics' | 'history' | 'recurring';

export const MaximizedView: React.FC<MaximizedViewProps> = ({
  currentDate,
  data,
  entry,
  onPrevDay,
  onNextDay,
  onSelectDate,
  onToggleComplete,
  onToggleTopFocus,
  onDeleteTask,
  onUpdateTaskTitle,
  onAddTaskToDate,
  onDeleteDay,
  onRescueStaleTask,
  onOpenCreateTask,
  onUpdateJournal,
  onUpdateEnergy,
  onOpenSettings,
  onOpenCreateMajorTask,
  onEditMajorTask,
  onDeleteMajorTask,
  onToggleCompleteMajorTask,
  onAddTaskToMajor,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('today');
  const [selectedTheme, setSelectedTheme] = useState<string>('All');

  const isToday = currentDate === getTodayString();
  const dateLabel = formatDateLabel(currentDate);

  // Filter tasks for current date
  const dayTasks = data.tasks.filter((t: Task) => t.date === currentDate && !t.archived);
  const themes = [
    'All',
    ...Array.from(new Set([...(data.customThemes || ['Work', 'Health', 'Chores', 'Personal']), ...dayTasks.map((t: Task) => t.theme)].filter(Boolean))),
  ];

  const filteredTasks = selectedTheme === 'All' ? dayTasks : dayTasks.filter((t) => t.theme === selectedTheme);

  const topFocusTask = filteredTasks.find((t) => t.isTopFocus);
  const regularTasks = filteredTasks.filter((t) => !t.isTopFocus);

  const completedCount = dayTasks.filter((t) => t.completed).length;
  const totalCount = dayTasks.length;

  // Recurring tasks list for the recurrence manager tab
  const recurringTasks = data.tasks.filter((t) => t.recurrence?.isRecurring && !t.archived);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left Navigation Sidebar */}
      <aside
        style={{
          width: '240px',
          backgroundColor: '#0e1117',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '16px 12px',
          flexShrink: 0,
        }}
      >
        {/* Nav Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.06em',
              padding: '6px 10px',
            }}
          >
            STUDIO WORKSPACE
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('today')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: activeTab === 'today' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'today' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: activeTab === 'today' ? 600 : 500,
              fontSize: '0.85rem',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <CheckSquare size={16} color={activeTab === 'today' ? '#818cf8' : 'currentColor'} />
            Today's Focus
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('major')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: activeTab === 'major' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'major' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: activeTab === 'major' ? 600 : 500,
              fontSize: '0.85rem',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <Target size={16} color={activeTab === 'major' ? '#818cf8' : 'currentColor'} />
            Major Goals & Projects
            {(data.majorTasks?.length || 0) > 0 && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.675rem',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(99, 102, 241, 0.25)',
                  color: '#c7d2fe',
                  fontWeight: 700,
                }}
              >
                {data.majorTasks?.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: activeTab === 'analytics' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'analytics' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: activeTab === 'analytics' ? 600 : 500,
              fontSize: '0.85rem',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <BarChart2 size={16} color={activeTab === 'analytics' ? '#818cf8' : 'currentColor'} />
            Analytics & Graphs
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: activeTab === 'history' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'history' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: activeTab === 'history' ? 600 : 500,
              fontSize: '0.85rem',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <Calendar size={16} color={activeTab === 'history' ? '#818cf8' : 'currentColor'} />
            Past Days Archive
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recurring')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: activeTab === 'recurring' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeTab === 'recurring' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: activeTab === 'recurring' ? 600 : 500,
              fontSize: '0.85rem',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <RotateCcw size={16} color={activeTab === 'recurring' ? '#818cf8' : 'currentColor'} />
            Recurring Chores
          </button>
        </div>

        {/* Bottom Sync / Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.825rem',
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
          >
            <Settings size={15} />
            Settings & Cloud Sync
          </button>
        </div>
      </aside>

      {/* Main Studio Content Area */}
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: '#0b0d11' }}>
        {/* Tab 1: Today's Focus & Journal Split View */}
        {activeTab === 'today' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
            {/* Top Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  {isToday ? "Today's Agenda" : formatDateLabel(currentDate)}
                </h1>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {completedCount} of {totalCount} tasks completed today
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Theme filter chips */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {themes.map((th) => (
                    <button
                      key={th}
                      type="button"
                      onClick={() => setSelectedTheme(th)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: selectedTheme === th ? '1px solid var(--accent-indigo)' : '1px solid var(--border-subtle)',
                        backgroundColor: selectedTheme === th ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        color: selectedTheme === th ? '#a5b4fc' : 'var(--text-muted)',
                      }}
                    >
                      {th === 'All' ? 'All' : `#${th.toLowerCase()}`}
                    </button>
                  ))}
                </div>

                <button type="button" onClick={onOpenCreateTask} className="btn-primary">
                  <Plus size={15} /> Add Task
                </button>
              </div>
            </div>

            {/* Two-Column Studio Layout: Checklist (Left) & Journal (Right) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '24px', flex: 1, minHeight: 0 }}>
              {/* Left Column: Tasks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                {/* North Star Focus */}
                {topFocusTask && (
                  <div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#facc15',
                        letterSpacing: '0.05em',
                        marginBottom: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Sparkles size={13} />
                      TODAY'S #1 PRIORITY (NORTH STAR)
                    </div>
                    <TaskItem
                      task={topFocusTask}
                      majorTasks={data.majorTasks}
                      allTasks={data.tasks}
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

                {/* Regular tasks */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {regularTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      majorTasks={data.majorTasks}
                      allTasks={data.tasks}
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
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px dashed var(--border-subtle)',
                      }}
                    >
                      No tasks scheduled for this view.
                      <div style={{ marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={onOpenCreateTask}
                          className="btn-secondary"
                          style={{ fontSize: '0.8rem' }}
                        >
                          <Plus size={13} /> Create your first task
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Freeform Journal Section */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <JournalSection
                  entry={entry}
                  dateStr={currentDate}
                  onUpdateJournal={onUpdateJournal}
                  onUpdateEnergy={onUpdateEnergy}
                  isCompact={false}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab: Major Goals & Projects */}
        {activeTab === 'major' && (
          <MajorTasksView
            majorTasks={data.majorTasks || []}
            allTasks={data.tasks}
            themes={themes.filter((t) => t !== 'All')}
            onOpenCreateMajorTask={onOpenCreateMajorTask || (() => {})}
            onEditMajorTask={onEditMajorTask || (() => {})}
            onDeleteMajorTask={onDeleteMajorTask || (() => {})}
            onToggleCompleteMajorTask={onToggleCompleteMajorTask || (() => {})}
            onToggleCompleteTask={onToggleComplete}
            onAddTaskToMajor={onAddTaskToMajor || (() => {})}
          />
        )}

        {/* Tab 2: Analytics & Graphs */}
        {activeTab === 'analytics' && <AnalyticsView data={data} />}

        {/* Tab 3: History & Past Archive */}
        {activeTab === 'history' && (
          <HistoryView
            data={data}
            onSelectDate={onSelectDate}
            onUpdateJournal={onUpdateJournal}
            onUpdateEnergy={onUpdateEnergy}
            onToggleComplete={onToggleComplete}
            onDeleteTask={onDeleteTask}
            onUpdateTaskTitle={onUpdateTaskTitle}
            onAddTaskToDate={onAddTaskToDate}
            onDeleteDay={onDeleteDay}
            onOpenInStudio={(dateStr) => {
              onSelectDate(dateStr);
              setActiveTab('today');
            }}
          />
        )}

        {/* Tab 4: Recurring Chores Manager */}
        {activeTab === 'recurring' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                  Recurring Chores & Habits
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  These automated chores check your cadence daily and only surface on your active list when due.
                </p>
              </div>

              <button type="button" onClick={onOpenCreateTask} className="btn-primary">
                <Plus size={14} /> New Recurring Chore
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recurringTasks.map((t) => (
                <div
                  key={t.id}
                  className="glass-panel"
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)', alignItems: 'center' }}>
                      <span style={{ color: '#818cf8', fontWeight: 600 }}>#{t.theme}</span>
                      <span>•</span>
                      <span>
                        Rule: <strong>{getRecurrenceDescription(t.recurrence)}</strong>
                      </span>
                      {t.recurrence?.type === 'cycle' && (
                        <>
                          <span>•</span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              backgroundColor: getCycleStatus(t.recurrence)?.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: getCycleStatus(t.recurrence)?.isActive ? '#34d399' : '#fbbf24',
                              border: `1px solid ${getCycleStatus(t.recurrence)?.isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                            }}
                          >
                            {getCycleStatus(t.recurrence)?.label}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge badge-energy-low">
                      {t.energy === 'high' ? '⚡ High Focus' : '☕ Light Chore'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteTask(t.id)}
                      className="btn-icon"
                      title="Delete Recurring Chore"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {recurringTasks.length === 0 && (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>
                  No recurring chores configured yet. Click "+ New Recurring Chore" to add one!
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
