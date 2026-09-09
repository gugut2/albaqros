import { AppData, AppSettings, DailyPropertyDefinition, DailyReminder, DayEntry, Task, VaultInfo } from '../types';

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
  compactMode: true, // Opens in Widget Mode by default on first launch
  defaultEnergyFilter: 'all',
};

export const DEFAULT_DAILY_PROPERTIES: DailyPropertyDefinition[] = [
  { id: 'prop-weight', name: 'Weight', unit: 'kg', type: 'number', icon: 'scale' },
  {
    id: 'prop-investments',
    name: 'Investments',
    unit: '$',
    type: 'number',
    icon: 'trending-up',
    subproperties: [
      { id: 'subprop-stocks', name: 'Stocks', unit: '$' },
      { id: 'subprop-etf', name: 'ETF', unit: '$' },
      { id: 'subprop-crypto', name: 'Crypto', unit: '$' },
    ],
  },
];

export const DEFAULT_DAILY_REMINDERS: DailyReminder[] = [
  {
    id: 'rem-vitamin-d',
    title: 'Vitamin D3 & Omega 3',
    category: 'medication',
    dosage: '1 softgel after breakfast',
    recurrence: { isRecurring: true, type: 'daily' },
    color: '#38bdf8',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rem-saturday-med',
    title: 'Weekly Injectable / Saturday Treatment',
    category: 'medication',
    dosage: '1 dose with water',
    recurrence: { isRecurring: true, type: 'weekly_days', daysOfWeek: [6] }, // Every Saturday
    color: '#a855f7',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'rem-portfolio-review',
    title: 'Review Weekly Portfolio & Rebalance',
    category: 'routine',
    recurrence: { isRecurring: true, type: 'weekly_days', daysOfWeek: [0] }, // Sunday
    color: '#10b981',
    createdAt: new Date().toISOString(),
  },
];

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
      properties: {
        'prop-weight': 74.2,
        'prop-investments': 18500,
      },
      subpropertyValues: {
        'prop-investments': {
          'subprop-stocks': 12000,
          'subprop-etf': 5000,
          'subprop-crypto': 1500,
        },
      },
      remindersCompleted: {
        'rem-vitamin-d': true,
      },
      updatedAt: new Date().toISOString(),
    },
    [yesterdayStr]: {
      date: yesterdayStr,
      journal: 'Solid progress on the roadmap. Kept phone away during focus blocks which helped tremendously.',
      energyLevel: 5,
      properties: {
        'prop-weight': 74.5,
        'prop-investments': 18250,
      },
      subpropertyValues: {
        'prop-investments': {
          'subprop-stocks': 11800,
          'subprop-etf': 5000,
          'subprop-crypto': 1450,
        },
      },
      remindersCompleted: {
        'rem-vitamin-d': true,
      },
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
    dailyProperties: DEFAULT_DAILY_PROPERTIES,
    dailyReminders: DEFAULT_DAILY_REMINDERS,
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
        // Ensure dailyProperties exists even from previous saves
        if (!data.dailyProperties || !Array.isArray(data.dailyProperties) || data.dailyProperties.length === 0) {
          data.dailyProperties = DEFAULT_DAILY_PROPERTIES;
        } else {
          // Ensure Investments has subproperties configured
          data.dailyProperties = data.dailyProperties.map((p) => {
            if (p.id === 'prop-investments' && (!p.subproperties || p.subproperties.length === 0)) {
              return {
                ...p,
                subproperties: [
                  { id: 'subprop-stocks', name: 'Stocks', unit: '$' },
                  { id: 'subprop-etf', name: 'ETF', unit: '$' },
                  { id: 'subprop-crypto', name: 'Crypto', unit: '$' },
                ],
              };
            }
            return p;
          });
        }
        // Ensure dailyReminders exists even from previous saves
        if (!data.dailyReminders || !Array.isArray(data.dailyReminders) || data.dailyReminders.length === 0) {
          data.dailyReminders = DEFAULT_DAILY_REMINDERS;
        }

        // Ensure subproperty values for today exist if Investments is tracked
        const todayStr = getTodayString();
        if (data.entries && data.entries[todayStr] && !data.entries[todayStr].subpropertyValues?.['prop-investments']) {
          data.entries[todayStr].subpropertyValues = {
            ...(data.entries[todayStr].subpropertyValues || {}),
            'prop-investments': {
              'subprop-stocks': 12000,
              'subprop-etf': 5000,
              'subprop-crypto': 1500,
            },
          };
          data.entries[todayStr].properties = {
            ...(data.entries[todayStr].properties || {}),
            'prop-investments': 18500,
          };
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

  async getVaultInfo(): Promise<VaultInfo | null> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.getVaultInfo) {
      try {
        const info = await (window as any).electronAPI.getVaultInfo();
        if (info) return info;
      } catch (err) {
        console.warn('Electron IPC getVaultInfo error, using fallback:', err);
      }
    }
    return {
      path: 'Default Vault',
      name: 'Default Vault',
      exists: true,
      hasDataFile: true,
      dataFilePath: 'localStorage',
      cloudProvider: 'local',
      isCustom: false,
      recentVaults: [],
    };
  },

  async selectVaultDirectory(): Promise<{
    success: boolean;
    vaultInfo?: VaultInfo;
    data?: AppData;
    isEmpty?: boolean;
  } | null> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.selectVaultDirectory) {
      try {
        return await (window as any).electronAPI.selectVaultDirectory();
      } catch (err) {
        console.error('Error in selectVaultDirectory IPC:', err);
        throw err;
      }
    }
    return null;
  },

  async createNewVault(
    vaultName: string,
    parentPath?: string,
    initialData?: AppData
  ): Promise<{ success: boolean; vaultInfo?: VaultInfo; data?: AppData; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.createNewVault) {
      try {
        return await (window as any).electronAPI.createNewVault(vaultName, parentPath, initialData);
      } catch (err: any) {
        console.error('Error in createNewVault IPC:', err);
        return { success: false, error: err.message || 'Failed to create vault in Electron' };
      }
    }
    return { success: false, error: 'Vault operations require desktop Electron app.' };
  },

  async switchVault(
    vaultPath: string,
    migrateCurrentData?: boolean,
    currentData?: AppData
  ): Promise<{ success: boolean; vaultInfo?: VaultInfo; data?: AppData; error?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.switchVault) {
      try {
        return await (window as any).electronAPI.switchVault(vaultPath, migrateCurrentData, currentData);
      } catch (err: any) {
        console.error('Error in switchVault IPC:', err);
        return { success: false, error: err.message || 'Failed to switch vault in Electron' };
      }
    }
    return { success: false, error: 'Vault operations require desktop Electron app.' };
  },

  async openVaultInExplorer(vaultPath?: string): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.openVaultInExplorer) {
      try {
        return await (window as any).electronAPI.openVaultInExplorer(vaultPath);
      } catch (err) {
        console.warn('Error in openVaultInExplorer IPC:', err);
      }
    }
    return false;
  },
};
