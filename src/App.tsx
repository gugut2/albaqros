import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { AppData, AppSettings, DailyPropertyDefinition, DailyReminder, DayEntry, MajorTask, Subtask, Task, ProjectArtifact, VaultInfo } from './types';
import { StorageService, getTodayString } from './services/storage';
import { processDayRollover } from './services/recurrence';
import { TitleBar } from './components/TitleBar';
import { CompactView } from './components/CompactView';
import { MaximizedView } from './components/MaximizedView';
import { TaskCreateModal } from './components/TaskCreateModal';
import { StaleRescueModal } from './components/StaleRescueModal';
import { SettingsModal } from './components/SettingsModal';
import { MajorTaskModal } from './components/MajorTaskModal';
import { ProjectArtifactModal } from './components/ProjectArtifactModal';
import { DailyPropertiesModal } from './components/DailyPropertiesModal';
import { VaultModal } from './components/VaultModal';

export const App: React.FC = () => {
  const [data, setData] = useState<AppData | null>(null);
  const [currentDate, setCurrentDate] = useState<string>(getTodayString());
  const [isCompact, setIsCompact] = useState<boolean>(true);
  const [alwaysOnTop, setAlwaysOnTop] = useState<boolean>(false);
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [rescueTask, setRescueTask] = useState<Task | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isMajorModalOpen, setIsMajorModalOpen] = useState<boolean>(false);
  const [editingMajorTask, setEditingMajorTask] = useState<MajorTask | null>(null);
  const [isArtifactModalOpen, setIsArtifactModalOpen] = useState<boolean>(false);
  const [artifactModalMajorTaskId, setArtifactModalMajorTaskId] = useState<string | null>(null);
  const [editingArtifact, setEditingArtifact] = useState<ProjectArtifact | null>(null);
  const [isPropertiesModalOpen, setIsPropertiesModalOpen] = useState<boolean>(false);
  const [propertiesModalTab, setPropertiesModalTab] = useState<'properties' | 'reminders'>('reminders');
  const [updateReady, setUpdateReady] = useState<boolean>(false);

  // Load data on startup and process day rollover
  useEffect(() => {
    async function init() {
      const loaded = await StorageService.load();
      const today = getTodayString();

      // Check day rollover and increment daysMissed for carried over tasks
      const updatedTasks = processDayRollover(loaded.tasks, loaded.lastOpenedDate || today);
      const updatedData: AppData = {
        ...loaded,
        tasks: updatedTasks,
        lastOpenedDate: today,
      };

      setData(updatedData);
      setAlwaysOnTop(loaded.settings?.alwaysOnTop || false);
      setIsCompact(loaded.settings?.compactMode ?? true);

      // Load active vault metadata
      const vInfo = await StorageService.getVaultInfo();
      if (vInfo) setVaultInfo(vInfo);

      // Save updated state
      await StorageService.save(updatedData);
    }
    init();

    // Listen to external cloud sync changes (Google Drive / OneDrive)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.onExternalDataChange) {
      (window as any).electronAPI.onExternalDataChange(async () => {
        const refreshed = await StorageService.load();
        setData(refreshed);
        const vInfo = await StorageService.getVaultInfo();
        if (vInfo) setVaultInfo(vInfo);
        setSyncNotice('☁️ Vault updated from drive');
        setTimeout(() => setSyncNotice(null), 3000);
      });
    }

    // Listen to auto-updater status for restart badge
    const unsubUpdater = StorageService.onUpdaterStatus((info) => {
      if (info.state === 'downloaded') {
        setUpdateReady(true);
      }
    });

    return () => {
      if (unsubUpdater) unsubUpdater();
    };
  }, []);

  // Save changes to storage whenever data changes
  const updateData = (updater: (prev: AppData) => AppData) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      StorageService.save(next);
      return next;
    });
  };

  if (!data) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-main)',
        }}
      >
        Loading Albaqros...
      </div>
    );
  }

  // --- Task Handlers ---

  const handleToggleComplete = (taskId: string) => {
    updateData((prev) => {
      const updatedTasks = prev.tasks.map((t) => {
        if (t.id === taskId) {
          const nextCompleted = !t.completed;
          if (nextCompleted) {
            // Delightful subtle micro-celebration
            try {
              confetti({
                particleCount: 28,
                spread: 50,
                origin: { y: 0.8 },
                colors: ['#6366f1', '#10b981', '#38bdf8', '#facc15'],
              });
            } catch (err) {
              // Ignore if canvas unavailable
            }
          }

          // If task has subtasks, update all subtasks to match parent
          const updatedSubtasks = t.subtasks?.map((s) => ({
            ...s,
            completed: nextCompleted,
          }));

          return {
            ...t,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
            subtasks: updatedSubtasks,
          };
        }
        return t;
      });
      return { ...prev, tasks: updatedTasks };
    });
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    updateData((prev) => {
      let shouldCelebrate = false;
      const updatedTasks = prev.tasks.map((t) => {
        if (t.id === taskId && t.subtasks) {
          const nextSubtasks = t.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, completed: !s.completed } : s
          );

          const allDone = nextSubtasks.length > 0 && nextSubtasks.every((s) => s.completed);
          const wasAllDone = t.subtasks.every((s) => s.completed);

          if (allDone && !wasAllDone) {
            shouldCelebrate = true;
          }

          return {
            ...t,
            subtasks: nextSubtasks,
            completed: allDone ? true : (t.completed && nextSubtasks.some((s) => !s.completed) ? false : t.completed),
            completedAt: allDone ? new Date().toISOString() : t.completedAt,
          };
        }
        return t;
      });

      if (shouldCelebrate) {
        try {
          confetti({
            particleCount: 30,
            spread: 50,
            origin: { y: 0.8 },
            colors: ['#6366f1', '#10b981', '#38bdf8', '#facc15'],
          });
        } catch (e) {}
      }

      return { ...prev, tasks: updatedTasks };
    });
  };

  const handleAddSubtask = (taskId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    updateData((prev) => {
      const updatedTasks = prev.tasks.map((t) => {
        if (t.id === taskId) {
          const newSubtask: Subtask = {
            id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: trimmed,
            completed: false,
          };
          const currentSubtasks = t.subtasks || [];
          return {
            ...t,
            subtasks: [...currentSubtasks, newSubtask],
            // Adding a new incomplete subtask reopens the task
            completed: false,
          };
        }
        return t;
      });
      return { ...prev, tasks: updatedTasks };
    });
  };

  const handleDeleteSubtask = (taskId: string, subtaskId: string) => {
    updateData((prev) => {
      const updatedTasks = prev.tasks.map((t) => {
        if (t.id === taskId && t.subtasks) {
          const nextSubtasks = t.subtasks.filter((s) => s.id !== subtaskId);
          const allDone = nextSubtasks.length > 0 && nextSubtasks.every((s) => s.completed);
          return {
            ...t,
            subtasks: nextSubtasks,
            completed: allDone ? true : t.completed,
          };
        }
        return t;
      });
      return { ...prev, tasks: updatedTasks };
    });
  };

  const handleToggleTopFocus = (taskId: string) => {
    updateData((prev) => {
      const target = prev.tasks.find((t) => t.id === taskId);
      const willBeTop = !target?.isTopFocus;

      // Only one task can be #1 Top Focus at a time for today
      const updatedTasks = prev.tasks.map((t) => {
        if (t.id === taskId) {
          return { ...t, isTopFocus: willBeTop };
        }
        if (willBeTop && t.date === currentDate) {
          return { ...t, isTopFocus: false };
        }
        return t;
      });
      return { ...prev, tasks: updatedTasks };
    });
  };

  const handleDeleteTask = (taskId: string) => {
    updateData((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
  };

  const handleAddTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'daysMissed'>) => {
    const newTask: Task = {
      ...taskData,
      id: `task-${Date.now()}`,
      createdAt: new Date().toISOString(),
      daysMissed: 0,
    };

    updateData((prev) => {
      // If new task is top focus, unpin others for this day
      const existing = prev.tasks.map((t) =>
        newTask.isTopFocus && t.date === newTask.date ? { ...t, isTopFocus: false } : t
      );
      return {
        ...prev,
        tasks: [newTask, ...existing],
      };
    });
  };

  const handleAddTheme = (newTheme: string) => {
    const trimmed = newTheme.trim();
    if (!trimmed) return;
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    updateData((prev) => {
      const currentThemes = prev.customThemes || ['Work', 'Health', 'Chores', 'Personal'];
      if (currentThemes.some((th) => th.toLowerCase() === formatted.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        customThemes: [...currentThemes, formatted],
      };
    });
  };

  const handleUpdateTaskTitle = (taskId: string, newTitle: string) => {
    updateData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, title: newTitle.trim() } : t)),
    }));
  };

  const handleDeleteDay = (dateStr: string) => {
    updateData((prev) => {
      const nextTasks = prev.tasks.filter((t) => t.date !== dateStr);
      const nextEntries = { ...prev.entries };
      delete nextEntries[dateStr];
      return {
        ...prev,
        tasks: nextTasks,
        entries: nextEntries,
      };
    });
  };

  const handleAddTaskToDate = (dateStr: string, title: string, theme: string) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      theme: theme || 'General',
      energy: 'normal',
      isTopFocus: false,
      completed: false,
      date: dateStr,
      createdAt: new Date().toISOString(),
      daysMissed: 0,
    };
    updateData((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
  };

  // --- Major Goal / Project Handlers ---

  const handleSaveMajorTask = (
    majorData: Omit<MajorTask, 'id' | 'createdAt' | 'completed' | 'completedAt'>,
    existingId?: string
  ) => {
    updateData((prev) => {
      if (existingId) {
        const updated = (prev.majorTasks || []).map((m) =>
          m.id === existingId
            ? {
                ...m,
                ...majorData,
                updatedAt: new Date().toISOString(),
              }
            : m
        );
        return { ...prev, majorTasks: updated };
      } else {
        const newMajor: MajorTask = {
          ...majorData,
          id: `major-${Date.now()}`,
          completed: false,
          createdAt: new Date().toISOString(),
        };
        return {
          ...prev,
          majorTasks: [newMajor, ...(prev.majorTasks || [])],
        };
      }
    });
    setIsMajorModalOpen(false);
    setEditingMajorTask(null);
  };

  const handleDeleteMajorTask = (majorTaskId: string) => {
    updateData((prev) => {
      // Unlink any tasks that were associated with this major task
      const updatedTasks = prev.tasks.map((t) =>
        t.majorTaskId === majorTaskId ? { ...t, majorTaskId: undefined } : t
      );
      const updatedMajorTasks = (prev.majorTasks || []).filter((m) => m.id !== majorTaskId);
      return {
        ...prev,
        tasks: updatedTasks,
        majorTasks: updatedMajorTasks,
      };
    });
  };

  const handleToggleCompleteMajorTask = (majorTaskId: string) => {
    updateData((prev) => {
      const updatedMajorTasks = (prev.majorTasks || []).map((m) => {
        if (m.id === majorTaskId) {
          const nextCompleted = !m.completed;
          if (nextCompleted) {
            try {
              confetti({
                particleCount: 50,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#6366f1', '#10b981', '#38bdf8', '#facc15', '#ec4899'],
              });
            } catch (e) {}
          }
          return {
            ...m,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
          };
        }
        return m;
      });
      return { ...prev, majorTasks: updatedMajorTasks };
    });
  };

  const handleAddTaskToMajor = (majorTaskId: string, title: string, theme: string) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      theme: theme || 'General',
      energy: 'normal',
      isTopFocus: false,
      completed: false,
      date: currentDate,
      createdAt: new Date().toISOString(),
      daysMissed: 0,
      majorTaskId,
    };
    updateData((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
    }));
  };

  // --- Project Milestone Deliverables & Creative Files Handlers ---

  const handleOpenAddArtifact = (majorTaskId: string) => {
    setArtifactModalMajorTaskId(majorTaskId);
    setEditingArtifact(null);
    setIsArtifactModalOpen(true);
  };

  const handleEditArtifact = (majorTaskId: string, artifact: ProjectArtifact) => {
    setArtifactModalMajorTaskId(majorTaskId);
    setEditingArtifact(artifact);
    setIsArtifactModalOpen(true);
  };

  const handleSaveArtifact = (artifactData: Omit<ProjectArtifact, 'id'>, existingId?: string) => {
    updateData((prev) => {
      const targetMajorId = artifactData.majorTaskId;
      const updatedMajorTasks = (prev.majorTasks || []).map((m) => {
        if (m.id === targetMajorId) {
          const currentArtifacts = m.artifacts || [];
          if (existingId) {
            const nextArtifacts = currentArtifacts.map((a) =>
              a.id === existingId ? { ...artifactData, id: existingId } : a
            );
            return { ...m, artifacts: nextArtifacts };
          } else {
            const newArtifact: ProjectArtifact = {
              ...artifactData,
              id: `art-${Date.now()}`,
            };
            try {
              confetti({
                particleCount: 45,
                spread: 70,
                origin: { y: 0.65 },
                colors: ['#6366f1', '#10b981', '#ec4899', '#facc15', '#38bdf8'],
              });
            } catch (e) {}
            return { ...m, artifacts: [...currentArtifacts, newArtifact] };
          }
        }
        return m;
      });
      return { ...prev, majorTasks: updatedMajorTasks };
    });
    setIsArtifactModalOpen(false);
    setEditingArtifact(null);
    setArtifactModalMajorTaskId(null);
  };

  const handleDeleteArtifact = (majorTaskId: string, artifactId: string) => {
    updateData((prev) => {
      const updatedMajorTasks = (prev.majorTasks || []).map((m) => {
        if (m.id === majorTaskId && m.artifacts) {
          return {
            ...m,
            artifacts: m.artifacts.filter((a) => a.id !== artifactId),
          };
        }
        return m;
      });
      return { ...prev, majorTasks: updatedMajorTasks };
    });
  };

  // --- Stale Rescue Actions ---

  const handleBreakDownTask = (taskId: string, steps: string[]) => {
    updateData((prev) => {
      const original = prev.tasks.find((t) => t.id === taskId);
      if (!original) return prev;

      const newMicroTasks: Task[] = steps.map((step, idx) => ({
        id: `micro-${Date.now()}-${idx}`,
        title: step,
        theme: original.theme,
        energy: 'low', // micro steps are made to be low energy!
        isTopFocus: idx === 0,
        completed: false,
        date: currentDate,
        createdAt: new Date().toISOString(),
        daysMissed: 0,
      }));

      // Archive original task
      const updatedTasks = prev.tasks.map((t) => (t.id === taskId ? { ...t, archived: true } : t));
      return {
        ...prev,
        tasks: [...newMicroTasks, ...updatedTasks],
      };
    });
    setRescueTask(null);
  };

  const handleDeferToWeekend = (taskId: string) => {
    const now = new Date();
    const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
    const sat = new Date(now);
    sat.setDate(sat.getDate() + daysUntilSaturday);
    const satStr = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, '0')}-${String(sat.getDate()).padStart(2, '0')}`;

    updateData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, date: satStr, daysMissed: 0 } : t)),
    }));
    setRescueTask(null);
  };

  const handleArchiveTask = (taskId: string) => {
    updateData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, archived: true } : t)),
    }));
    setRescueTask(null);
  };

  const handleResetMissed = (taskId: string) => {
    updateData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, daysMissed: 0 } : t)),
    }));
    setRescueTask(null);
  };

  // --- Journal & Energy Handlers ---

  const handleUpdateJournal = (dateStr: string, text: string) => {
    updateData((prev) => {
      const existing = prev.entries[dateStr] || {
        date: dateStr,
        journal: '',
        energyLevel: 3,
        updatedAt: new Date().toISOString(),
      };

      return {
        ...prev,
        entries: {
          ...prev.entries,
          [dateStr]: {
            ...existing,
            journal: text,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  };

  const handleUpdateEnergy = (dateStr: string, level: number) => {
    updateData((prev) => {
      const existing = prev.entries[dateStr] || {
        date: dateStr,
        journal: '',
        energyLevel: level,
        updatedAt: new Date().toISOString(),
      };

      return {
        ...prev,
        entries: {
          ...prev.entries,
          [dateStr]: {
            ...existing,
            energyLevel: level,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  };

  // --- Daily Tracked Properties & Medication / Reminders Handlers ---

  const handleUpdateProperty = (
    dateStr: string,
    propertyId: string,
    value: number | string | boolean
  ) => {
    updateData((prev) => {
      const currentEntry = prev.entries[dateStr] || {
        date: dateStr,
        journal: '',
        energyLevel: 3,
        updatedAt: new Date().toISOString(),
      };
      const currentProps = currentEntry.properties || {};
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [dateStr]: {
            ...currentEntry,
            properties: {
              ...currentProps,
              [propertyId]: value,
            },
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  };

  const handleUpdateSubproperty = (
    dateStr: string,
    propertyId: string,
    subpropertyId: string,
    value: number
  ) => {
    updateData((prev) => {
      const currentEntry = prev.entries[dateStr] || {
        date: dateStr,
        journal: '',
        energyLevel: 3,
        updatedAt: new Date().toISOString(),
      };
      const currentSubpropValues = { ...(currentEntry.subpropertyValues || {}) };
      const currentPropSubValues = { ...(currentSubpropValues[propertyId] || {}) };

      currentPropSubValues[subpropertyId] = value;
      currentSubpropValues[propertyId] = currentPropSubValues;

      // Automatically recompute total sum across all subproperties
      const computedSum = Object.values(currentPropSubValues).reduce(
        (acc, v) => acc + (typeof v === 'number' && !isNaN(v) ? v : 0),
        0
      );

      const currentProps = { ...(currentEntry.properties || {}) };
      currentProps[propertyId] = computedSum;

      return {
        ...prev,
        entries: {
          ...prev.entries,
          [dateStr]: {
            ...currentEntry,
            properties: currentProps,
            subpropertyValues: currentSubpropValues,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  };

  const handleAddSubproperty = (propertyId: string, name: string, unit?: string) => {
    updateData((prev) => {
      const existingList = prev.dailyProperties || [];
      const updatedList = existingList.map((prop) => {
        if (prop.id !== propertyId) return prop;
        const newSubId = `sub-${Date.now()}`;
        const existingSubs = prop.subproperties || [];
        return {
          ...prop,
          subproperties: [...existingSubs, { id: newSubId, name, unit: unit || prop.unit }],
        };
      });
      return {
        ...prev,
        dailyProperties: updatedList,
      };
    });
  };

  const handleDeleteSubproperty = (propertyId: string, subpropertyId: string) => {
    updateData((prev) => {
      const existingList = prev.dailyProperties || [];
      const updatedList = existingList.map((prop) => {
        if (prop.id !== propertyId) return prop;
        return {
          ...prop,
          subproperties: (prop.subproperties || []).filter((s) => s.id !== subpropertyId),
        };
      });

      // Recalculate sum across entries if removing a subproperty
      const updatedEntries = { ...prev.entries };
      for (const [dateKey, entry] of Object.entries(updatedEntries)) {
        if (entry.subpropertyValues?.[propertyId]?.[subpropertyId] !== undefined) {
          const updatedSubprops = { ...entry.subpropertyValues[propertyId] };
          delete updatedSubprops[subpropertyId];
          const newSum = Object.values(updatedSubprops).reduce(
            (acc, v) => acc + (typeof v === 'number' && !isNaN(v) ? v : 0),
            0
          );
          updatedEntries[dateKey] = {
            ...entry,
            properties: {
              ...(entry.properties || {}),
              [propertyId]: newSum,
            },
            subpropertyValues: {
              ...(entry.subpropertyValues || {}),
              [propertyId]: updatedSubprops,
            },
            updatedAt: new Date().toISOString(),
          };
        }
      }

      return {
        ...prev,
        dailyProperties: updatedList,
        entries: updatedEntries,
      };
    });
  };

  const handleSavePropertyDefinition = (propDef: DailyPropertyDefinition) => {
    updateData((prev) => {
      const existingList = prev.dailyProperties || [];
      const exists = existingList.some((p) => p.id === propDef.id);
      const updatedList = exists
        ? existingList.map((p) => (p.id === propDef.id ? propDef : p))
        : [...existingList, propDef];
      return {
        ...prev,
        dailyProperties: updatedList,
      };
    });
  };

  const handleDeletePropertyDefinition = (propId: string) => {
    updateData((prev) => ({
      ...prev,
      dailyProperties: (prev.dailyProperties || []).filter((p) => p.id !== propId),
    }));
  };

  const handleToggleReminder = (dateStr: string, reminderId: string) => {
    updateData((prev) => {
      const currentEntry = prev.entries[dateStr] || {
        date: dateStr,
        journal: '',
        energyLevel: 3,
        updatedAt: new Date().toISOString(),
      };
      const currentReminders = currentEntry.remindersCompleted || {};
      const nextState = !currentReminders[reminderId];

      if (nextState) {
        try {
          confetti({
            particleCount: 22,
            spread: 45,
            origin: { y: 0.8 },
            colors: ['#06b6d4', '#10b981', '#a855f7', '#38bdf8'],
          });
        } catch (e) {}
      }

      return {
        ...prev,
        entries: {
          ...prev.entries,
          [dateStr]: {
            ...currentEntry,
            remindersCompleted: {
              ...currentReminders,
              [reminderId]: nextState,
            },
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  };

  const handleSaveReminder = (
    reminderData: Omit<DailyReminder, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    updateData((prev) => {
      const existingList = prev.dailyReminders || [];
      if (existingId) {
        const updatedList = existingList.map((r) =>
          r.id === existingId ? { ...r, ...reminderData } : r
        );
        return { ...prev, dailyReminders: updatedList };
      } else {
        const newReminder: DailyReminder = {
          ...reminderData,
          id: `rem-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        return {
          ...prev,
          dailyReminders: [...existingList, newReminder],
        };
      }
    });
  };

  const handleDeleteReminder = (reminderId: string) => {
    updateData((prev) => ({
      ...prev,
      dailyReminders: (prev.dailyReminders || []).filter((r) => r.id !== reminderId),
    }));
  };

  // --- Vault Handlers ---

  const handleVaultChanged = (newVaultInfo: VaultInfo, newData?: AppData) => {
    setVaultInfo(newVaultInfo);
    if (newData) {
      setData(newData);
    }
    updateData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        storagePath: newVaultInfo.path,
        activeVault: newVaultInfo.path,
      },
    }));
  };

  // --- Window Handlers ---

  const handleToggleMode = async () => {
    const nextMode = !isCompact;
    setIsCompact(nextMode);

    if (typeof window !== 'undefined' && (window as any).electronAPI?.toggleWindowMode) {
      await (window as any).electronAPI.toggleWindowMode(nextMode ? 'compact' : 'maximized');
    }

    updateData((prev) => ({
      ...prev,
      settings: { ...prev.settings, compactMode: nextMode },
    }));
  };

  const handleToggleAlwaysOnTop = async () => {
    const nextVal = !alwaysOnTop;
    setAlwaysOnTop(nextVal);

    if (typeof window !== 'undefined' && (window as any).electronAPI?.setAlwaysOnTop) {
      await (window as any).electronAPI.setAlwaysOnTop(nextVal);
    }

    updateData((prev) => ({
      ...prev,
      settings: { ...prev.settings, alwaysOnTop: nextVal },
    }));
  };

  const handleMinimizeWindow = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.minimize) {
      (window as any).electronAPI.minimize();
    }
  };

  const handleCloseWindow = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.close) {
      (window as any).electronAPI.close();
    }
  };

  // --- Date Navigation ---
  const handlePrevDay = () => {
    const [y, m, d] = currentDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 1);
    setCurrentDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
  };

  const handleNextDay = () => {
    const [y, m, d] = currentDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 1);
    setCurrentDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
  };

  const currentDayEntry = data.entries[currentDate];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg-app)',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Title Bar with Frameless Drag and Window Controls */}
      <TitleBar
        isCompact={isCompact}
        alwaysOnTop={alwaysOnTop}
        onToggleMode={handleToggleMode}
        onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
        onMinimize={handleMinimizeWindow}
        onClose={handleCloseWindow}
        vaultName={vaultInfo?.name}
        vaultPath={vaultInfo?.path}
        onOpenVault={() => setIsVaultModalOpen(true)}
        updateReady={updateReady}
        onApplyUpdate={() => StorageService.installUpdate()}
      />

      {/* Main View: Compact Floating Widget vs Maximized Studio */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {isCompact ? (
          <CompactView
            currentDate={currentDate}
            tasks={data.tasks}
            entry={currentDayEntry}
            majorTasks={data.majorTasks}
            properties={data.dailyProperties || []}
            reminders={data.dailyReminders || []}
            allEntries={data.entries || {}}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
            onToggleComplete={handleToggleComplete}
            onToggleTopFocus={handleToggleTopFocus}
            onDeleteTask={handleDeleteTask}
            onRescueStaleTask={(task) => setRescueTask(task)}
            onOpenCreateTask={() => setIsCreateOpen(true)}
            onUpdateJournal={handleUpdateJournal}
            onUpdateEnergy={handleUpdateEnergy}
            onToggleSubtask={handleToggleSubtask}
            onAddSubtask={handleAddSubtask}
            onDeleteSubtask={handleDeleteSubtask}
            onToggleReminder={handleToggleReminder}
            onUpdateProperty={handleUpdateProperty}
            onUpdateSubproperty={handleUpdateSubproperty}
            onAddSubproperty={handleAddSubproperty}
            onDeleteSubproperty={handleDeleteSubproperty}
            onOpenManageProperties={() => {
              setPropertiesModalTab('properties');
              setIsPropertiesModalOpen(true);
            }}
            onOpenManageReminders={() => {
              setPropertiesModalTab('reminders');
              setIsPropertiesModalOpen(true);
            }}
            onViewAnalytics={() => {
              setIsCompact(false);
            }}
          />
        ) : (
          <MaximizedView
            currentDate={currentDate}
            data={data}
            entry={currentDayEntry}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
            onSelectDate={(d) => setCurrentDate(d)}
            onToggleComplete={handleToggleComplete}
            onToggleTopFocus={handleToggleTopFocus}
            onDeleteTask={handleDeleteTask}
            onUpdateTaskTitle={handleUpdateTaskTitle}
            onAddTaskToDate={handleAddTaskToDate}
            onDeleteDay={handleDeleteDay}
            onRescueStaleTask={(task) => setRescueTask(task)}
            onOpenCreateTask={() => setIsCreateOpen(true)}
            onUpdateJournal={handleUpdateJournal}
            onUpdateEnergy={handleUpdateEnergy}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenCreateMajorTask={() => {
              setEditingMajorTask(null);
              setIsMajorModalOpen(true);
            }}
            onEditMajorTask={(major) => {
              setEditingMajorTask(major);
              setIsMajorModalOpen(true);
            }}
            onDeleteMajorTask={handleDeleteMajorTask}
            onToggleCompleteMajorTask={handleToggleCompleteMajorTask}
            onAddTaskToMajor={handleAddTaskToMajor}
            onToggleSubtask={handleToggleSubtask}
            onAddSubtask={handleAddSubtask}
            onDeleteSubtask={handleDeleteSubtask}
            onOpenAddArtifact={handleOpenAddArtifact}
            onEditArtifact={handleEditArtifact}
            onDeleteArtifact={handleDeleteArtifact}
            onToggleReminder={handleToggleReminder}
            onUpdateProperty={handleUpdateProperty}
            onUpdateSubproperty={handleUpdateSubproperty}
            onAddSubproperty={handleAddSubproperty}
            onDeleteSubproperty={handleDeleteSubproperty}
            onOpenManageProperties={() => {
              setPropertiesModalTab('properties');
              setIsPropertiesModalOpen(true);
            }}
            onOpenManageReminders={() => {
              setPropertiesModalTab('reminders');
              setIsPropertiesModalOpen(true);
            }}
          />
        )}
      </div>

      {/* Task Creation Modal */}
      <TaskCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onAddTask={handleAddTask}
        currentDate={currentDate}
        themes={data.customThemes || ['Work', 'Health', 'Chores', 'Personal']}
        onAddTheme={handleAddTheme}
        majorTasks={data.majorTasks || []}
      />

      {/* Major Task / Milestone Modal */}
      <MajorTaskModal
        isOpen={isMajorModalOpen}
        onClose={() => {
          setIsMajorModalOpen(false);
          setEditingMajorTask(null);
        }}
        onSaveMajorTask={handleSaveMajorTask}
        editingMajorTask={editingMajorTask}
        themes={data.customThemes || ['Work', 'Health', 'Chores', 'Personal']}
      />

      {/* Project Milestone Deliverable / Creative File Modal */}
      {isArtifactModalOpen && artifactModalMajorTaskId && (
        <ProjectArtifactModal
          isOpen={isArtifactModalOpen}
          onClose={() => {
            setIsArtifactModalOpen(false);
            setEditingArtifact(null);
            setArtifactModalMajorTaskId(null);
          }}
          onSaveArtifact={handleSaveArtifact}
          majorTaskId={artifactModalMajorTaskId}
          majorTaskTitle={
            data.majorTasks?.find((m) => m.id === artifactModalMajorTaskId)?.title || 'Major Goal'
          }
          existingArtifact={editingArtifact}
          defaultMilestoneNumber={
            (data.majorTasks?.find((m) => m.id === artifactModalMajorTaskId)?.artifacts?.length || 0) + 1
          }
        />
      )}

      {/* Stale Task Rescue Modal */}
      <StaleRescueModal
        task={rescueTask}
        onClose={() => setRescueTask(null)}
        onBreakDown={handleBreakDownTask}
        onDeferToWeekend={handleDeferToWeekend}
        onArchive={handleArchiveTask}
        onResetMissed={handleResetMissed}
      />

      {/* Settings & Cloud Sync Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={data.settings}
        onUpdateSettings={(newSettings) =>
          updateData((prev) => ({ ...prev, settings: newSettings }))
        }
        data={data}
        vaultInfo={vaultInfo}
        onOpenVaultModal={() => {
          setIsSettingsOpen(false);
          setIsVaultModalOpen(true);
        }}
      />

      {/* Daily Properties & Medication / Reminders Modal */}
      <DailyPropertiesModal
        isOpen={isPropertiesModalOpen}
        onClose={() => setIsPropertiesModalOpen(false)}
        properties={data.dailyProperties || []}
        reminders={data.dailyReminders || []}
        onSaveProperty={handleSavePropertyDefinition}
        onDeleteProperty={handleDeletePropertyDefinition}
        onSaveReminder={handleSaveReminder}
        onDeleteReminder={handleDeleteReminder}
        onAddSubproperty={handleAddSubproperty}
        onDeleteSubproperty={handleDeleteSubproperty}
        initialTab={propertiesModalTab}
      />

      {/* Vault Management & Drive Sync Modal */}
      <VaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        vaultInfo={vaultInfo}
        onVaultChanged={handleVaultChanged}
        currentData={data}
      />

      {/* Cloud Sync Toast Notification */}
      {syncNotice && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#10b981',
            color: '#ffffff',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {syncNotice}
        </div>
      )}
    </div>
  );
};
