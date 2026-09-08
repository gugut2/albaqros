import { MajorTask, Task } from '../types';

export interface MajorTaskProgress {
  total: number;
  completed: number;
  percentage: number;
  label: string;
  associatedTasks: Task[];
}

export function calculateMajorTaskProgress(
  majorTask: MajorTask,
  allTasks: Task[]
): MajorTaskProgress {
  const associated = allTasks.filter((t) => t.majorTaskId === majorTask.id && !t.archived);
  const total = associated.length;
  const completed = associated.filter((t) => t.completed).length;

  let percentage = 0;
  if (total > 0) {
    percentage = Math.round((completed / total) * 100);
  } else if (majorTask.completed) {
    percentage = 100;
  }

  const label = total > 0
    ? `${completed} of ${total} tasks done (${percentage}%)`
    : majorTask.completed
    ? 'Completed'
    : 'No linked tasks yet (0%)';

  return {
    total,
    completed,
    percentage,
    label,
    associatedTasks: associated,
  };
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export interface CadenceStatus {
  hasCadence: boolean;
  cadenceDays?: number;
  daysSinceLastDeliverable: number;
  daysRemaining: number;
  status: 'on_track' | 'due_today' | 'overdue' | 'no_cadence';
  badgeText: string;
  totalArtifacts: number;
}

export function calculateCadenceStatus(majorTask: MajorTask): CadenceStatus {
  const artifacts = majorTask.artifacts || [];
  const totalArtifacts = artifacts.length;

  if (!majorTask.cadenceDays || majorTask.cadenceDays <= 0) {
    return {
      hasCadence: false,
      daysSinceLastDeliverable: 0,
      daysRemaining: 0,
      status: 'no_cadence',
      badgeText: totalArtifacts === 1 ? '1 milestone logged' : `${totalArtifacts} milestones logged`,
      totalArtifacts,
    };
  }

  const cadenceDays = majorTask.cadenceDays;
  const now = new Date();

  // Determine date anchor: last artifact creation date, or major task creation date
  let anchorDate: Date;
  if (artifacts.length > 0) {
    // Sort descending by createdAt
    const sorted = [...artifacts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    anchorDate = new Date(sorted[0].createdAt);
  } else {
    anchorDate = new Date(majorTask.createdAt);
  }

  // Calculate day difference
  const diffMs = now.getTime() - anchorDate.getTime();
  const daysSince = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const daysRemaining = cadenceDays - daysSince;

  let status: CadenceStatus['status'] = 'on_track';
  let badgeText = '';

  if (daysRemaining > 0) {
    status = 'on_track';
    badgeText = daysRemaining === 1 ? 'Next piece due tomorrow' : `Next piece due in ${daysRemaining} days`;
  } else if (daysRemaining === 0) {
    status = 'due_today';
    badgeText = 'Milestone piece due today!';
  } else {
    status = 'overdue';
    const overdueDays = Math.abs(daysRemaining);
    badgeText = overdueDays === 1 ? 'Milestone 1 day overdue' : `Milestone ${overdueDays} days overdue`;
  }

  return {
    hasCadence: true,
    cadenceDays,
    daysSinceLastDeliverable: daysSince,
    daysRemaining,
    status,
    badgeText,
    totalArtifacts,
  };
}
