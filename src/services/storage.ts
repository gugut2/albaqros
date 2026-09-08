import { AppData, AppSettings, DayEntry, Task } from '../types';

const STORAGE_KEY = 'visual_productivity_data_v1';

export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateLabel(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const defaultSettings: AppSettings = {
  storagePath: '',
  runOnStartup: true,
  alwaysOnTop: false,
  compactMode: false,
  defaultEnergyFilter: 'all',
};

// Realistic initial sample data to wow the user immediately on first launch
function createInitialData(): AppData {
  const today = getTodayString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoStr = `${twoDaysAgo.getFullYear()}-${String(twoDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(twoDaysAgo.getDate()).padStart(2, '0')}`;

  const initialTasks: Task[] = [
    {
      id: 'task-north-star',
      title: 'Finalize the Q3 core roadmap & project spec',
      theme: 'Work',
      energy: 'high',
      isTopFocus: true,
      completed: false,
      date: today,
      createdAt: new Date().toISOString(),
      daysMissed: 0,
      majorTaskId: 'major-1',
      notes: 'Main deliverable of the day — lock in scope.',
    },
    {
      id: 'task-workout',
      title: 'Morning 30-minute interval run & stretch',
      theme: 'Health',
      energy: 'high',
      isTopFocus: false,
      completed: true,
      completedAt: new Date().toISOString(),
      date: today,
      createdAt: new Date().toISOString(),
      daysMissed: 0,
      majorTaskId: 'major-2',
      recurrence: {
        isRecurring: true,
        type: 'weekly_days',
        daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      },
    },
    {
      id: 'task-chore-stale',
      title: 'Deep clean & descale espresso machine',
      theme: 'Chores',
      energy: 'low',
      isTopFocus: false,
      completed: false,
      date: today,
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      daysMissed: 3, // Stale demonstration
      recurrence: {
        isRecurring: true,
        type: 'interval_days',
        intervalDays: 14,
      },
      notes: 'Carried over from earlier this week.',
    },
    {
      id: 'task-meditate',
      title: 'Evening 10m mindful breathing & posture check',
      theme: 'Health',
      energy: 'low',
      isTopFocus: false,
      completed: false,
      date: today,
      createdAt: new Date().toISOString(),
      daysMissed: 0,
      recurrence: {
        isRecurring: true,
        type: 'daily',
      },
    },
    {
      id: 'task-plants',
      title: 'Water balcony ferns & indoor monstera',
      theme: 'Chores',
      energy: 'low',
      isTopFocus: false,
      completed: false,
      date: today,
      createdAt: new Date().toISOString(),
      daysMissed: 1,
      recurrence: {
        isRecurring: true,
        type: 'interval_days',
        intervalDays: 4,
      },
    },
    // Past tasks for analytics demo
    {
      id: 'past-1',
      title: 'Review engineering pull requests & deploy to staging',
      theme: 'Work',
      energy: 'high',
      isTopFocus: true,
      completed: true,
      completedAt: new Date(Date.now() - 86400000).toISOString(),
      date: yesterdayStr,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      daysMissed: 0,
    },
    {
      id: 'past-2',
      title: 'Cook balanced meal & prep lunch boxes',
      theme: 'Health',
      energy: 'low',
      isTopFocus: false,
      completed: true,
      completedAt: new Date(Date.now() - 86400000).toISOString(),
      date: yesterdayStr,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      daysMissed: 0,
    },
    {
      id: 'past-3',
      title: 'Organize workspace desk & wipe monitors',
      theme: 'Chores',
      energy: 'low',
      isTopFocus: false,
      completed: true,
      completedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      date: twoDaysAgoStr,
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      daysMissed: 0,
    },
  ];

  const initialEntries: Record<string, DayEntry> = {
    [today]: {
      date: today,
      journal: 'Starting the week with clear focus. Prioritizing deep work in the morning before tackling inbox triage. Energy feels solid.',
      energyLevel: 4,
      updatedAt: new Date().toISOString(),
    },
    [yesterdayStr]: {
      date: yesterdayStr,
      journal: 'Solid progress on the roadmap. Kept phone away during focus blocks which helped tremendously.',
      energyLevel: 5,
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  };

  const initialMajorTasks = [
    {
      id: 'major-1',
      title: 'Q3 Product Launch & Architecture Overhaul',
      description: 'Ship core features, optimize cloud sync performance, and refine dark mode UX.',
      theme: 'Work',
      completed: false,
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      targetDate: '2026-10-15',
      color: '#3B82F6',
    },
    {
      id: 'major-2',
      title: 'Half-Marathon Readiness & Cardio Endurance',
      description: 'Build weekly mileage base, improve recovery routines, and hit 15km threshold.',
      theme: 'Health',
      completed: false,
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      targetDate: '2026-11-20',
      color: '#10B981',
    },
  ];

  return {
    version: 1,
    tasks: initialTasks,
    entries: initialEntries,
    recurringTemplates: [],
    majorTasks: initialMajorTasks,
    customThemes: ['Work', 'Health', 'Chores', 'Personal'],
    settings: defaultSettings,
    lastOpenedDate: today,
  };
}

export const StorageService = {
  async load(): Promise<AppData> {
    try {
      let data: AppData | null = null;
      // Check if Electron native IPC is present
      if (typeof window !== 'undefined' && (window as any).electronAPI?.loadData) {
        data = await (window as any).electronAPI.loadData();
      }

      // Fallback to localStorage
      if (!data) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          data = JSON.parse(saved);
        }
      }

      if (data) {
        // Ensure customThemes exists even from previous saves
        if (!data.customThemes || !Array.isArray(data.customThemes) || data.customThemes.length === 0) {
          data.customThemes = ['Work', 'Health', 'Chores', 'Personal'];
        }
        // Ensure majorTasks exists even from previous saves
        if (!data.majorTasks || !Array.isArray(data.majorTasks)) {
          data.majorTasks = [];
        }
        return data;
      }
    } catch (err) {
      console.warn('Failed to load saved data, initializing default:', err);
    }

    const fresh = createInitialData();
    await this.save(fresh);
    return fresh;
  },

  async save(data: AppData): Promise<void> {
    try {
      // If Electron native IPC is present, save to local file
      if (typeof window !== 'undefined' && (window as any).electronAPI?.saveData) {
        await (window as any).electronAPI.saveData(data);
      }

      // Also persist to localStorage for instant web resilience
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save data:', err);
    }
  },

  exportBackupJson(data: AppData): string {
    return JSON.stringify(data, null, 2);
  },

  downloadBackup(data: AppData): void {
    const json = this.exportBackupJson(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visual-productivity-backup-${getTodayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
