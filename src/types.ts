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

export type ProjectArtifactType = 'image' | 'audio' | '3d' | 'file';

export interface ProjectArtifact {
  id: string;
  majorTaskId: string;
  title: string;
  type: ProjectArtifactType;
  filePath?: string; // Absolute path on disk
  fileName?: string;
  fileSize?: number; // Size in bytes
  fileExtension?: string; // e.g. .png, .blend, .wav
  dataUrl?: string; // Base64 data URL for instant image/audio preview in UI
  thumbnailUrl?: string; // Optional cover / render image
  notes?: string; // Creative reflection, critique, techniques practiced
  createdAt: string; // ISO date string
  milestoneNumber?: number; // e.g. 1 for Piece #1, 2 for Piece #2
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
  cadenceDays?: number; // Target deliverable cadence in days (e.g. every 7 days)
  artifacts?: ProjectArtifact[]; // Creative deliverables / milestones
}

export type DailyPropertyType = 'number' | 'text' | 'boolean';

export interface DailySubpropertyDefinition {
  id: string; // e.g. "subprop-stocks", "subprop-etf"
  name: string; // e.g. "Stocks", "ETF"
  unit?: string; // inherits from parent if not specified
  defaultValue?: number;
}

export interface DailyPropertyDefinition {
  id: string; // e.g. "prop-weight", "prop-investments"
  name: string; // e.g. "Weight", "Investments"
  unit?: string; // e.g. "kg", "$", "hrs", "L"
  type: DailyPropertyType;
  icon?: string;
  defaultValue?: number | string | boolean;
  subproperties?: DailySubpropertyDefinition[]; // Optional breakdown into sub-metrics whose values sum to the parent
}

export type ReminderCategory = 'medication' | 'routine' | 'habit' | 'general';

export interface DailyReminder {
  id: string;
  title: string; // e.g. "Vitamin D", "Saturday Meds"
  category: ReminderCategory;
  dosage?: string; // e.g. "1 capsule with breakfast", "5g"
  recurrence: RecurrenceRule; // daily, weekly_days (e.g. Sat), interval, cycle
  color?: string;
  notes?: string;
  createdAt: string;
}

export interface DayEntry {
  date: string; // YYYY-MM-DD
  journal: string; // Free-style journal entry
  energyLevel?: number; // 1 to 5 daily energy/mood rating
  updatedAt: string;
  properties?: Record<string, number | string | boolean>; // Keyed by property id e.g. { "prop-weight": 78.2 }
  subpropertyValues?: Record<string, Record<string, number>>; // Keyed by [propertyId][subpropertyId] e.g. { "prop-investments": { "subprop-stocks": 12000, "subprop-etf": 5000 } }
  remindersCompleted?: Record<string, boolean>; // Keyed by reminder id e.g. { "rem-1": true }
}

export type CloudProvider = 'onedrive' | 'google-drive' | 'dropbox' | 'icloud' | 'local';

export interface RecentVault {
  path: string;
  name: string;
  lastUsed: string;
}

export interface VaultInfo {
  path: string;
  name: string;
  exists: boolean;
  hasDataFile: boolean;
  dataFilePath: string;
  cloudProvider: CloudProvider;
  isCustom: boolean;
  recentVaults?: RecentVault[];
}

export interface AppSettings {
  storagePath: string; // Custom Google Drive / OneDrive folder or default
  activeVault?: string; // Active Vault folder path
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
  dailyProperties?: DailyPropertyDefinition[]; // Tracked metrics like Weight, Investments
  dailyReminders?: DailyReminder[]; // Recurring routine meds and non-task reminders
  settings: AppSettings;
  lastOpenedDate: string; // YYYY-MM-DD
}

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateInfo {
  state: UpdateState;
  version?: string;
  progress?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  error?: string;
  releaseDate?: string;
  releaseNotes?: string;
}
