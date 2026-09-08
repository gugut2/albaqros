import React, { useState } from 'react';
import {
  Target,
  Plus,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Check,
  Sparkles,
  Calendar,
  Image as ImageIcon,
  Box,
  Music,
  FileText,
  Layers,
  CheckSquare,
} from 'lucide-react';
import { MajorTask, Task, ProjectArtifact } from '../types';
import { calculateMajorTaskProgress, calculateCadenceStatus, formatFileSize } from '../services/majorTasks';
import { formatDateLabel, getTodayString } from '../services/storage';
import { EvolutionGallery } from './EvolutionGallery';

interface MajorTasksViewProps {
  majorTasks: MajorTask[];
  allTasks: Task[];
  themes: string[];
  onOpenCreateMajorTask: () => void;
  onEditMajorTask: (majorTask: MajorTask) => void;
  onDeleteMajorTask: (majorTaskId: string) => void;
  onToggleCompleteMajorTask: (majorTaskId: string) => void;
  onToggleCompleteTask: (taskId: string) => void;
  onAddTaskToMajor: (majorTaskId: string, title: string, theme: string) => void;
  onOpenAddArtifact: (majorTaskId: string) => void;
  onEditArtifact: (majorTaskId: string, artifact: ProjectArtifact) => void;
  onDeleteArtifact: (majorTaskId: string, artifactId: string) => void;
}

export const MajorTasksView: React.FC<MajorTasksViewProps> = ({
  majorTasks,
  allTasks,
  themes,
  onOpenCreateMajorTask,
  onEditMajorTask,
  onDeleteMajorTask,
  onToggleCompleteMajorTask,
  onToggleCompleteTask,
  onAddTaskToMajor,
  onOpenAddArtifact,
  onEditArtifact,
  onDeleteArtifact,
}) => {
  const [expandedMajorId, setExpandedMajorId] = useState<string | null>(majorTasks[0]?.id || null);
  const [activeSubTab, setActiveSubTab] = useState<{ [majorId: string]: 'tasks' | 'evolution' }>({});
  const [newTaskTitle, setNewTaskTitle] = useState<{ [majorId: string]: string }>({});

  const handleQuickAddTask = (majorTask: MajorTask) => {
    const text = (newTaskTitle[majorTask.id] || '').trim();
    if (!text) return;
    onAddTaskToMajor(majorTask.id, text, majorTask.theme);
    setNewTaskTitle((prev) => ({ ...prev, [majorTask.id]: '' }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
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
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Major Projects & Key Milestones
            </h1>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Macro-goals with live percentage progress bars calculated from your daily task execution.
          </p>
        </div>

        <button type="button" onClick={onOpenCreateMajorTask} className="btn-primary">
          <Plus size={15} /> New Major Task
        </button>
      </div>

      {/* Grid / List of Major Tasks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {majorTasks.map((major) => {
          const progress = calculateMajorTaskProgress(major, allTasks);
          const cadence = calculateCadenceStatus(major);
          const currentTab = activeSubTab[major.id] || 'tasks';
          const isExpanded = expandedMajorId === major.id;
          const isFinished = major.completed || progress.percentage === 100;

          return (
            <div
              key={major.id}
              className="glass-panel"
              style={{
                padding: '20px',
                backgroundColor: 'rgba(18, 22, 30, 0.75)',
                border: isFinished ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-medium)',
                boxShadow: isFinished ? '0 0 20px rgba(16, 185, 129, 0.1)' : 'var(--shadow-card)',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Top Row: Theme badge, Target Date, Actions */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.725rem',
                      fontWeight: 600,
                      color: '#818cf8',
                      backgroundColor: 'rgba(99, 102, 241, 0.12)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    #{major.theme}
                  </span>

                  {major.targetDate && (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.725rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Calendar size={12} /> Target: {formatDateLabel(major.targetDate)}
                    </span>
                  )}

                  {cadence.hasCadence && (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.725rem',
                        fontWeight: 600,
                        color:
                          cadence.status === 'due_today'
                            ? '#fbbf24'
                            : cadence.status === 'overdue'
                            ? '#f87171'
                            : '#818cf8',
                        backgroundColor:
                          cadence.status === 'due_today'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : cadence.status === 'overdue'
                            ? 'rgba(248, 113, 113, 0.15)'
                            : 'rgba(99, 102, 241, 0.12)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      <Clock size={11} /> {cadence.badgeText}
                    </span>
                  )}

                  {isFinished && (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.725rem',
                        fontWeight: 600,
                        color: '#34d399',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      <CheckCircle2 size={12} /> Goal Achieved
                    </span>
                  )}
                </div>

                {/* Edit / Delete / Complete Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => onToggleCompleteMajorTask(major.id)}
                    className={`btn-icon ${major.completed ? 'active' : ''}`}
                    title={major.completed ? 'Mark Incomplete' : 'Mark Completed'}
                    style={{ color: major.completed ? '#10b981' : 'var(--text-muted)' }}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditMajorTask(major)}
                    className="btn-icon"
                    title="Edit Major Goal"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMajorTask(major.id)}
                    className="btn-icon"
                    title="Delete Major Goal"
                    style={{ color: '#f87171' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Title & Description */}
              <div style={{ marginTop: '8px' }}>
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: isFinished ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: major.completed ? 'line-through' : 'none',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {major.title}
                </h3>
                {major.description && (
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                    {major.description}
                  </p>
                )}
              </div>

              {/* Progress Bar & Percentage Section */}
              <div style={{ marginTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {progress.label}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span
                      style={{
                        fontSize: '1.35rem',
                        fontWeight: 800,
                        color: progress.percentage === 100 ? '#10b981' : '#6366f1',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {progress.percentage}%
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>progress</span>
                  </div>
                </div>

                {/* Progress Track */}
                <div
                  style={{
                    height: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${progress.percentage}%`,
                      background: progress.percentage === 100
                        ? '#10b981'
                        : 'linear-gradient(90deg, #6366f1 0%, #06b6d4 100%)',
                      borderRadius: '999px',
                      transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: progress.percentage > 0 ? '0 0 12px rgba(99, 102, 241, 0.4)' : 'none',
                    }}
                  />
                </div>
              </div>

              {/* Evolution Deliverable Preview Strip (if artifacts exist or cadence is set) */}
              <div
                style={{
                  marginTop: '14px',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Thumbnails of up to 4 recent artifacts */}
                  {major.artifacts && major.artifacts.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {major.artifacts.slice(-4).map((art) => (
                        <div
                          key={art.id}
                          onClick={() => {
                            setExpandedMajorId(major.id);
                            setActiveSubTab((prev) => ({ ...prev, [major.id]: 'evolution' }));
                          }}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            backgroundColor: '#0a0d13',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                          title={`Piece #${art.milestoneNumber || 1}: ${art.title}`}
                        >
                          {art.type === 'image' && art.dataUrl ? (
                            <img src={art.dataUrl} alt={art.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : art.type === '3d' && art.thumbnailUrl ? (
                            <img src={art.thumbnailUrl} alt={art.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : art.type === '3d' ? (
                            <Box size={14} color="#c084fc" />
                          ) : art.type === 'audio' ? (
                            <Music size={14} color="#fbbf24" />
                          ) : (
                            <FileText size={14} color="#818cf8" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={13} color="#818cf8" />
                      <span>{major.artifacts?.length ? `${major.artifacts.length} Milestones Logged` : 'Creative Evolution Tracker'}</span>
                      {major.cadenceDays && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          • Every {major.cadenceDays}d
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {major.artifacts?.length
                        ? 'Click to view progression timeline & project files'
                        : 'Track finished concept art, 3D files, & audio over time'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => onOpenAddArtifact(major.id)}
                    className="btn-secondary"
                    style={{ fontSize: '0.725rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={12} /> Log Piece
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isExpanded) {
                        setExpandedMajorId(major.id);
                        setActiveSubTab((prev) => ({ ...prev, [major.id]: 'evolution' }));
                      } else {
                        setActiveSubTab((prev) => ({
                          ...prev,
                          [major.id]: currentTab === 'evolution' ? 'tasks' : 'evolution',
                        }));
                      }
                    }}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#818cf8',
                      fontSize: '0.725rem',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {isExpanded && currentTab === 'evolution' ? 'Show Study Tasks' : 'Open Evolution Studio'}
                  </button>
                </div>
              </div>

              {/* Collapsible Section: Study Tasks vs Evolution Hub */}
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  {/* Subtab Toggle Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedMajorId(major.id);
                        setActiveSubTab((prev) => ({ ...prev, [major.id]: 'tasks' }));
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.775rem',
                        fontWeight: currentTab === 'tasks' && isExpanded ? 600 : 500,
                        backgroundColor: currentTab === 'tasks' && isExpanded ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                        color: currentTab === 'tasks' && isExpanded ? '#ffffff' : 'var(--text-secondary)',
                        border: currentTab === 'tasks' && isExpanded ? '1px solid var(--accent-indigo)' : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <CheckSquare size={13} />
                      <span>Daily Study & Action Tasks ({progress.total})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setExpandedMajorId(major.id);
                        setActiveSubTab((prev) => ({ ...prev, [major.id]: 'evolution' }));
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.775rem',
                        fontWeight: currentTab === 'evolution' && isExpanded ? 600 : 500,
                        backgroundColor: currentTab === 'evolution' && isExpanded ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                        color: currentTab === 'evolution' && isExpanded ? '#ffffff' : 'var(--text-secondary)',
                        border: currentTab === 'evolution' && isExpanded ? '1px solid var(--accent-indigo)' : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Layers size={13} />
                      <span>Evolution Gallery & Files ({major.artifacts?.length || 0})</span>
                    </button>
                  </div>

                  {/* Collapse / Expand chevron */}
                  <button
                    type="button"
                    onClick={() => setExpandedMajorId(isExpanded ? null : major.id)}
                    className="btn-icon"
                    style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}
                    title={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Expanded Content Area */}
                {isExpanded && (
                  <div style={{ marginTop: '14px' }}>
                    {/* TAB 1: Daily Study Tasks Checklist */}
                    {currentTab === 'tasks' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Quick Add Daily Task directly linked to this Major Task */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                          <input
                            type="text"
                            placeholder="Add next actionable study/practice task (e.g. 30m anatomy study)..."
                            value={newTaskTitle[major.id] || ''}
                            onChange={(e) =>
                              setNewTaskTitle((prev) => ({ ...prev, [major.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleQuickAddTask(major);
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
                            onClick={() => handleQuickAddTask(major)}
                            disabled={!(newTaskTitle[major.id] || '').trim()}
                            className="btn-primary"
                            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            <Plus size={13} /> Add Task
                          </button>
                        </div>

                        {/* Associated tasks list */}
                        {progress.associatedTasks.map((t) => (
                          <div
                            key={t.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                              <button
                                type="button"
                                onClick={() => onToggleCompleteTask(t.id)}
                                style={{
                                  width: '16px',
                                  height: '16px',
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
                                {t.completed && <Check size={11} strokeWidth={3} />}
                              </button>
                              <span
                                style={{
                                  fontSize: '0.825rem',
                                  color: t.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                                  textDecoration: t.completed ? 'line-through' : 'none',
                                }}
                              >
                                {t.title}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {t.subtasks && t.subtasks.length > 0 && (
                                <span
                                  style={{
                                    color: '#818cf8',
                                    fontWeight: 600,
                                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                  }}
                                >
                                  {t.subtasks.filter((s) => s.completed).length}/{t.subtasks.length} subtasks
                                </span>
                              )}
                              <span>{formatDateLabel(t.date)}</span>
                              {t.energy === 'high' && <span style={{ color: '#f87171' }}>⚡</span>}
                              {t.energy === 'low' && <span style={{ color: '#34d399' }}>☕</span>}
                            </div>
                          </div>
                        ))}

                        {progress.associatedTasks.length === 0 && (
                          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', padding: '8px' }}>
                            No daily study tasks linked yet. Type an actionable task above to start practicing!
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 2: Evolution Gallery & Creative Files */}
                    {currentTab === 'evolution' && (
                      <EvolutionGallery
                        majorTask={major}
                        onOpenAddArtifact={() => onOpenAddArtifact(major.id)}
                        onEditArtifact={(art) => onEditArtifact(major.id, art)}
                        onDeleteArtifact={(artId) => onDeleteArtifact(major.id, artId)}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {majorTasks.length === 0 && (
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
            No major tasks or milestones created yet.
            <div style={{ marginTop: '10px' }}>
              <button type="button" onClick={onOpenCreateMajorTask} className="btn-secondary">
                <Plus size={14} /> Create your first Major Goal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
