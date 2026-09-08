import { AppData, Task } from '../types';

export interface ThemeStat {
  theme: string;
  total: number;
  completed: number;
  rate: number; // percentage 0-100
  color: string;
}

export interface DayVelocity {
  date: string;
  dayLabel: string;
  completed: number;
  total: number;
  journalWords: number;
  energyLevel: number;
}

export interface EnergyDistribution {
  name: string;
  value: number;
  color: string;
}

export interface AnalyticsSummary {
  currentStreak: number;
  totalCompleted: number;
  completionRate: number;
  highEnergyCount: number;
  lowEnergyCount: number;
  themeStats: ThemeStat[];
  recentVelocity: DayVelocity[]; // Last 7 or 14 days
  monthlyVelocity: DayVelocity[]; // Last 30 days
  energyDistribution: EnergyDistribution[];
  staleTasksCount: number;
}

const THEME_COLORS: Record<string, string> = {
  Work: '#3B82F6', // Blue
  Health: '#10B981', // Emerald
  Chores: '#F59E0B', // Amber
  Personal: '#8B5CF6', // Purple
  Default: '#64748B', // Slate
};

const EXTENDED_PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#E11D48', // Rose
];

export function getThemeColor(theme: string): string {
  if (THEME_COLORS[theme]) return THEME_COLORS[theme];
  let hash = 0;
  for (let i = 0; i < theme.length; i++) {
    hash = (hash << 5) - hash + theme.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % EXTENDED_PALETTE.length;
  return EXTENDED_PALETTE[index];
}

export function calculateAnalytics(data: AppData, rangeDays = 14): AnalyticsSummary {
  const { tasks, entries } = data;

  // Filter non-archived tasks
  const validTasks = tasks.filter((t) => !t.archived);

  // 1. Overall stats
  const totalTasks = validTasks.length;
  const completedTasks = validTasks.filter((t) => t.completed);
  const totalCompleted = completedTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  // 2. Energy counts
  const highEnergyCount = completedTasks.filter((t) => t.energy === 'high').length;
  const lowEnergyCount = completedTasks.filter((t) => t.energy === 'low').length;
  const normalEnergyCount = completedTasks.filter((t) => t.energy === 'normal').length;

  const energyDistribution: EnergyDistribution[] = [
    { name: 'High Focus (⚡)', value: highEnergyCount, color: '#EF4444' },
    { name: 'Low Energy (☕)', value: lowEnergyCount, color: '#10B981' },
    { name: 'Standard', value: normalEnergyCount, color: '#6366F1' },
  ].filter((item) => item.value > 0);

  // 3. Theme Breakdown
  const themeMap = new Map<string, { total: number; completed: number }>();
  validTasks.forEach((t) => {
    const themeName = t.theme || 'General';
    const current = themeMap.get(themeName) || { total: 0, completed: 0 };
    current.total += 1;
    if (t.completed) current.completed += 1;
    themeMap.set(themeName, current);
  });

  const themeStats: ThemeStat[] = Array.from(themeMap.entries()).map(([theme, stat]) => ({
    theme,
    total: stat.total,
    completed: stat.completed,
    rate: stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0,
    color: getThemeColor(theme),
  }));

  // 4. Day-by-day velocity
  const now = new Date();
  const recentVelocity: DayVelocity[] = [];
  const monthlyVelocity: DayVelocity[] = [];

  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

    const dayTasks = validTasks.filter((t) => t.date === dateStr);
    const dayCompleted = dayTasks.filter((t) => t.completed).length;

    const entry = entries[dateStr];
    const words = entry?.journal ? entry.journal.trim().split(/\s+/).filter(Boolean).length : 0;
    const energy = entry?.energyLevel || 3;

    recentVelocity.push({
      date: dateStr,
      dayLabel,
      completed: dayCompleted,
      total: dayTasks.length,
      journalWords: words,
      energyLevel: energy,
    });
  }

  // Monthly velocity (last 30 days)
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayLabel = `${d.getMonth() + 1}/${d.getDate()}`;

    const dayTasks = validTasks.filter((t) => t.date === dateStr);
    const dayCompleted = dayTasks.filter((t) => t.completed).length;
    const entry = entries[dateStr];
    const words = entry?.journal ? entry.journal.trim().split(/\s+/).filter(Boolean).length : 0;
    const energy = entry?.energyLevel || 3;

    monthlyVelocity.push({
      date: dateStr,
      dayLabel,
      completed: dayCompleted,
      total: dayTasks.length,
      journalWords: words,
      energyLevel: energy,
    });
  }

  // 5. Streak calculation (consecutive days with at least 1 completed task)
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const completedOnDay = validTasks.some((t) => t.date === dateStr && t.completed);

    if (completedOnDay) {
      streak += 1;
    } else if (i === 0) {
      // If today has no completed task yet, don't break streak from yesterday
      continue;
    } else {
      break;
    }
  }

  // 6. Stale tasks count
  const staleTasksCount = validTasks.filter((t) => !t.completed && (t.daysMissed || 0) >= 2).length;

  return {
    currentStreak: streak,
    totalCompleted,
    completionRate,
    highEnergyCount,
    lowEnergyCount,
    themeStats,
    recentVelocity,
    monthlyVelocity,
    energyDistribution,
    staleTasksCount,
  };
}
