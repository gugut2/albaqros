import { AppData, DailyPropertyDefinition, Task } from '../types';

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

export interface SubpropertyBreakdown {
  id: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface PropertyDataPoint {
  date: string;
  dayLabel: string;
  value: number | null;
  carriedValue: number | null;
  hasActualEntry: boolean;
  [subpropId: string]: any;
}

export interface PropertyAnalytics {
  property: DailyPropertyDefinition;
  dataPoints: PropertyDataPoint[];
  currentValue: number | null;
  currentDate?: string;
  previousValue: number | null;
  previousDate?: string;
  delta: number;
  deltaPercent: number;
  high: number | null;
  highDate?: string;
  low: number | null;
  lowDate?: string;
  average: number | null;
  recordedCount: number;
  subproperties: SubpropertyBreakdown[];
}

export const SUBPROP_PALETTE = [
  '#6366f1', // Indigo
  '#38bdf8', // Sky Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
  '#f97316', // Orange
];

export function getSubpropertyColor(index: number): string {
  return SUBPROP_PALETTE[index % SUBPROP_PALETTE.length];
}

export function calculatePropertyAnalytics(
  data: AppData,
  propertyId: string,
  rangeDays: number | 'all' = 14
): PropertyAnalytics | null {
  const property = (data.dailyProperties || []).find((p) => p.id === propertyId);
  if (!property) return null;

  const entries = data.entries || {};
  const today = new Date();

  // Determine chronological list of dates to evaluate
  const dateList: string[] = [];

  if (rangeDays === 'all') {
    // Gather all dates with entries or default to last 30 days
    const recordedDates = Object.keys(entries)
      .filter((d) => {
        const ent = entries[d];
        return (
          ent?.properties?.[propertyId] !== undefined ||
          (ent?.subpropertyValues?.[propertyId] &&
            Object.keys(ent.subpropertyValues[propertyId]).length > 0)
        );
      })
      .sort();

    if (recordedDates.length === 0) {
      // Default to 14 days if nothing recorded yet
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dateList.push(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        );
      }
    } else {
      // Continuous date range from first recorded date to today
      const [startYear, startMonth, startDay] = recordedDates[0].split('-').map(Number);
      const startDate = new Date(startYear, startMonth - 1, startDay);
      const diffTime = Math.max(0, today.getTime() - startDate.getTime());
      const totalDays = Math.min(365, Math.max(7, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1));

      for (let i = totalDays - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dateList.push(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        );
      }
    }
  } else {
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dateList.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      );
    }
  }

  // Pre-fetch any historical value prior to the start of the dateList for carry-forward
  let lastKnownValue: number | null = null;
  const lastKnownSubValues: Record<string, number> = {};
  const subDefs = property.subproperties || [];

  const priorDates = Object.keys(entries)
    .filter((d) => d < dateList[0])
    .sort();

  for (const pDate of priorDates) {
    const ent = entries[pDate];
    if (subDefs.length > 0) {
      if (ent?.subpropertyValues?.[propertyId]) {
        const subs = ent.subpropertyValues[propertyId];
        for (const [subId, sVal] of Object.entries(subs)) {
          const num = typeof sVal === 'number' ? sVal : parseFloat(sVal as any);
          if (!isNaN(num)) {
            lastKnownSubValues[subId] = num;
          }
        }
      }
      let subSum = 0;
      let hasAnySub = false;
      for (const sub of subDefs) {
        if (lastKnownSubValues[sub.id] !== undefined) {
          subSum += lastKnownSubValues[sub.id];
          hasAnySub = true;
        }
      }
      if (hasAnySub) {
        lastKnownValue = Math.round(subSum * 100) / 100;
      }
    } else {
      if (ent?.properties?.[propertyId] !== undefined) {
        const v = Number(ent.properties[propertyId]);
        if (!isNaN(v)) lastKnownValue = v;
      }
    }
  }

  const dataPoints: PropertyDataPoint[] = [];
  const recordedPoints: { date: string; value: number }[] = [];

  for (const dateStr of dateList) {
    const [y, m, dNum] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, dNum);
    const dayLabel = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const entry = entries[dateStr];
    let actualValue: number | null = null;
    let hasActual = false;

    if (subDefs.length > 0) {
      // For compound properties, calculate sum of defined subproperties
      const daySubs = entry?.subpropertyValues?.[propertyId];
      if (daySubs) {
        for (const sub of subDefs) {
          const raw = daySubs[sub.id];
          const num = typeof raw === 'number' ? raw : parseFloat(raw as any);
          if (!isNaN(num)) {
            lastKnownSubValues[sub.id] = num;
            hasActual = true;
          }
        }
      }
      if (hasActual) {
        let currentSubSum = 0;
        for (const sub of subDefs) {
          currentSubSum += lastKnownSubValues[sub.id] ?? 0;
        }
        actualValue = Math.round(currentSubSum * 100) / 100;
        lastKnownValue = actualValue;
      } else if (entry?.properties?.[propertyId] !== undefined) {
        const rawVal = Number(entry.properties[propertyId]);
        if (!isNaN(rawVal)) {
          actualValue = rawVal;
          hasActual = true;
          lastKnownValue = rawVal;
        }
      }
    } else {
      if (entry?.properties?.[propertyId] !== undefined) {
        const rawVal = Number(entry.properties[propertyId]);
        if (!isNaN(rawVal)) {
          actualValue = rawVal;
          hasActual = true;
          lastKnownValue = rawVal;
        }
      }
    }

    // Build the data point
    const point: PropertyDataPoint = {
      date: dateStr,
      dayLabel,
      value: actualValue,
      carriedValue: actualValue !== null ? actualValue : lastKnownValue,
      hasActualEntry: hasActual,
    };

    // Populate subproperties
    if (subDefs.length > 0) {
      for (const sub of subDefs) {
        point[sub.id] = lastKnownSubValues[sub.id] ?? 0;
      }
    }

    dataPoints.push(point);

    if (hasActual && actualValue !== null) {
      recordedPoints.push({ date: dateStr, value: actualValue });
    }
  }

  // Calculate KPIs
  let currentValue: number | null = null;
  let currentDate: string | undefined;
  let previousValue: number | null = null;
  let previousDate: string | undefined;
  let delta = 0;
  let deltaPercent = 0;
  let high: number | null = null;
  let highDate: string | undefined;
  let low: number | null = null;
  let lowDate: string | undefined;
  let average: number | null = null;

  if (recordedPoints.length > 0) {
    const latest = recordedPoints[recordedPoints.length - 1];
    currentValue = latest.value;
    currentDate = latest.date;

    const earliest = recordedPoints[0];
    previousValue = earliest.value;
    previousDate = earliest.date;

    delta = currentValue - previousValue;
    deltaPercent = previousValue !== 0 ? (delta / Math.abs(previousValue)) * 100 : 0;

    let sum = 0;
    for (const p of recordedPoints) {
      sum += p.value;
      if (high === null || p.value > high) {
        high = p.value;
        highDate = p.date;
      }
      if (low === null || p.value < low) {
        low = p.value;
        lowDate = p.date;
      }
    }
    average = Math.round((sum / recordedPoints.length) * 100) / 100;
  }

  // Calculate latest subproperty distribution
  const subproperties: SubpropertyBreakdown[] = [];
  if (property.subproperties && property.subproperties.length > 0) {
    const total = currentValue || 0;
    property.subproperties.forEach((sub, idx) => {
      const subVal = lastKnownSubValues[sub.id] ?? 0;
      const pct = total > 0 ? Math.round((subVal / total) * 1000) / 10 : 0;
      subproperties.push({
        id: sub.id,
        name: sub.name,
        value: subVal,
        percentage: pct,
        color: getSubpropertyColor(idx),
      });
    });
  }

  return {
    property,
    dataPoints,
    currentValue,
    currentDate,
    previousValue,
    previousDate,
    delta,
    deltaPercent,
    high,
    highDate,
    low,
    lowDate,
    average,
    recordedCount: recordedPoints.length,
    subproperties,
  };
}

