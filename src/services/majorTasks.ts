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
