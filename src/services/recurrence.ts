import { RecurrenceRule, Task } from '../types';
import { getTodayString } from './storage';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function isReminderDueOnDate(
  rule?: RecurrenceRule,
  dateStr?: string,
  lastCompletedDate?: string
): boolean {
  if (!rule || !rule.isRecurring) return false;

  const targetDateStr = dateStr || getTodayString();
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d);
  targetDate.setHours(0, 0, 0, 0);

  const dayOfWeek = targetDate.getDay(); // 0 = Sunday, ..., 6 = Saturday

  switch (rule.type) {
    case 'daily':
      return true;

    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;

    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;

    case 'weekly_days':
      return Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.includes(dayOfWeek);

    case 'interval_days': {
      if (!lastCompletedDate) return true;
      const [ly, lm, ld] = lastCompletedDate.split('-').map(Number);
      const last = new Date(ly, lm - 1, ld);
      last.setHours(0, 0, 0, 0);
      const diffMs = targetDate.getTime() - last.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return diffDays >= (rule.intervalDays || 1);
    }

    case 'cycle': {
      const startStr = rule.cycleStartDate || getTodayString();
      const [sy, sm, sd] = startStr.split('-').map(Number);
      const startDate = new Date(sy, sm - 1, sd);
      startDate.setHours(0, 0, 0, 0);

      const diffMs = targetDate.getTime() - startDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return false;

      const activeDays = Math.max(1, rule.activeDays || 1);
      const skipDays = Math.max(1, rule.skipDays || 1);
      const cycleLength = activeDays + skipDays;

      const positionInCycle = diffDays % cycleLength;
      return positionInCycle < activeDays;
    }

    case 'monthly': {
      const targetDateNumber = targetDate.getDate();
      return targetDateNumber === (rule.monthlyDay || 1);
    }

    default:
      return true;
  }
}

export function isTaskDueToday(rule?: RecurrenceRule, lastCompletedDate?: string): boolean {
  return isReminderDueOnDate(rule, getTodayString(), lastCompletedDate);
}

/**
 * Returns human-readable description of any recurrence rule.
 */
export function getRecurrenceDescription(rule?: RecurrenceRule): string {
  if (!rule || !rule.isRecurring) return 'One-time';

  switch (rule.type) {
    case 'daily':
      return 'Every day';

    case 'weekdays':
      return 'Weekdays only (Mon–Fri)';

    case 'weekends':
      return 'Weekends only (Sat–Sun)';

    case 'weekly_days':
      if (!rule.daysOfWeek || rule.daysOfWeek.length === 0) return 'Weekly';
      return `Weekly on ${rule.daysOfWeek.map((d) => DAY_NAMES[d]).join(', ')}`;

    case 'interval_days':
      return `Every ${rule.intervalDays || 1} days`;

    case 'cycle':
      return `${rule.activeDays || 3} days on, ${rule.skipDays || 1} day(s) off`;

    case 'monthly':
      return `Monthly on day ${rule.monthlyDay || 1}`;

    default:
      return 'Recurring';
  }
}

/**
 * Calculates current cycle status for cycle-based recurrence rules.
 */
export function getCycleStatus(rule?: RecurrenceRule): {
  isActive: boolean;
  dayInPhase: number;
  totalPhaseDays: number;
  label: string;
} | null {
  if (!rule || !rule.isRecurring || rule.type !== 'cycle') return null;

  const today = new Date();
  const startStr = rule.cycleStartDate || getTodayString();
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  startDate.setHours(0, 0, 0, 0);

  const curDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = curDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const activeDays = Math.max(1, rule.activeDays || 1);
  const skipDays = Math.max(1, rule.skipDays || 1);
  const cycleLength = activeDays + skipDays;

  if (diffDays < 0) {
    return {
      isActive: false,
      dayInPhase: 0,
      totalPhaseDays: activeDays,
      label: `Starts in ${Math.abs(diffDays)} days`,
    };
  }

  const pos = diffDays % cycleLength;
  const isActive = pos < activeDays;

  if (isActive) {
    return {
      isActive: true,
      dayInPhase: pos + 1,
      totalPhaseDays: activeDays,
      label: `Active: Day ${pos + 1} of ${activeDays}`,
    };
  } else {
    const skipPos = pos - activeDays;
    return {
      isActive: false,
      dayInPhase: skipPos + 1,
      totalPhaseDays: skipDays,
      label: `Rest / Skip: Day ${skipPos + 1} of ${skipDays}`,
    };
  }
}

/**
 * Rolls over unfinished tasks from previous days to today,
 * calculates and increments `daysMissed`, and returns the updated task list.
 */
export function processDayRollover(tasks: Task[], lastOpenedDate: string): Task[] {
  const today = getTodayString();
  if (lastOpenedDate === today) {
    return tasks;
  }

  const lastDate = new Date(lastOpenedDate);
  const curDate = new Date(today);
  const diffDays = Math.max(1, Math.floor((curDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)));

  return tasks.map((task) => {
    // If it's already completed or archived, leave it on its historical date
    if (task.completed || task.archived) {
      return task;
    }

    // If it was scheduled on an earlier date and remained incomplete,
    // roll it over to today. Multi-day tasks carry over without daysMissed penalty.
    if (task.date < today) {
      return {
        ...task,
        date: today,
        daysMissed: task.isMultiDay ? 0 : (task.daysMissed || 0) + diffDays,
      };
    }

    return task;
  });
}
