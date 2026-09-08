export type EnergyLevel = 'high' | 'low' | 'normal';

export type RecurrenceType =
  | 'daily'
  | 'weekdays'
  | 'weekends'
  | 'weekly_days'
  | 'interval_days'
  | 'cycle'
  | 'times_per_week'
  | 'monthly';

export interface RecurrenceRule {
  isRecurring: boolean;
  type: RecurrenceType;
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  intervalDays?: number; // e.g. every 3 days, every 14 days
  timesPerWeek?: number; // e.g. 3 times a week
  activeDays?: number; // For cycle: e.g. active for 3 days
  skipDays?: number; // For cycle: e.g. skip/rest for 1 day
  cycleStartDate?: string; // YYYY-MM-DD cycle anchor date
  monthlyDay?: number; // 1 to 31
  lastGeneratedDate?: string; // YYYY-MM-DD
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  theme: string; // e.g., 'Work', 'Health', 'Chores', 'Personal'
  energy: EnergyLevel; // 'high' (⚡) | 'low' (☕) | 'normal'
  isTopFocus: boolean; // Pinned #1 North Star focus
  completed: boolean;
  completedAt?: string; // ISO string
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO string
  daysMissed: number; // Count of past days this task was postponed or missed
  recurrence?: RecurrenceRule;
  recurringTemplateId?: string;
  subtasks?: Subtask[];
  majorTaskId?: string; // ID of linked Major Task / Project
  notes?: string;
  archived?: boolean;
}

export interface MajorTask {
  id: string;
  title: string;
  description?: string;
  theme: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  targetDate?: string; // Optional target completion date YYYY-MM-DD
  color?: string;
}

export interface DayEntry {
  date: string; // YYYY-MM-DD
  journal: string; // Free-style journal entry
  energyLevel?: number; // 1 to 5 daily energy/mood rating
  updatedAt: string;
}

export interface AppSettings {
  storagePath: string; // Custom Google Drive / OneDrive folder or default
  runOnStartup: boolean;
  alwaysOnTop: boolean;
  compactMode: boolean;
  defaultEnergyFilter: 'all' | 'high' | 'low';
}

export interface AppData {
  version: number;
  tasks: Task[];
  entries: Record<string, DayEntry>; // Keyed by YYYY-MM-DD
  recurringTemplates: Task[];
  majorTasks: MajorTask[]; // Major initiatives / long-term projects
  customThemes: string[]; // Dynamically user-defined themes/facets
  settings: AppSettings;
  lastOpenedDate: string; // YYYY-MM-DD
}
