import type { Task } from '../types';

export const ACTIVE_TASK_STATUSES: Task['status'][] = ['pending', 'running'];
export const TERMINAL_TASK_STATUSES: Task['status'][] = ['succeed', 'failed', 'cancelled'];

export const TASK_STATUS_TEXT: Record<Task['status'], string> = {
  pending: '排队中',
  running: '生成中',
  succeed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

export const TASK_STATUS_COLOR: Record<Task['status'], string> = {
  pending: 'bg-blue-100 text-blue-800',
  running: 'bg-yellow-100 text-yellow-800',
  succeed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-700',
};

export function normalizeTaskStatus(status?: string): Task['status'] {
  const value = String(status ?? '').trim().toLowerCase();
  if (['succeed', 'success', 'succeeded', 'completed', 'complete', 'done'].includes(value)) return 'succeed';
  if (['cancelled', 'canceled', 'cancel', 'deleted', 'user_cancelled'].includes(value)) return 'cancelled';
  if (['failed', 'fail', 'failure', 'error', 'expired', 'timeout'].includes(value)) return 'failed';
  if (['running', 'processing', 'generating', 'video_generating', 'in_progress', 'executing'].includes(value)) return 'running';
  if (['pending', 'queued', 'queueing', 'submitted', 'created', 'waiting', ''].includes(value)) return 'pending';
  return 'pending';
}

export function isTaskActive(status?: string): boolean {
  return ACTIVE_TASK_STATUSES.includes(normalizeTaskStatus(status));
}

export function isTaskTerminal(status?: string): boolean {
  return TERMINAL_TASK_STATUSES.includes(normalizeTaskStatus(status));
}

export function isTaskRunning(status?: string): boolean {
  return normalizeTaskStatus(status) === 'running';
}

export function isTaskSucceeded(status?: string): boolean {
  return normalizeTaskStatus(status) === 'succeed';
}

export function isTaskFailed(status?: string): boolean {
  return normalizeTaskStatus(status) === 'failed';
}

export function isTaskCancelled(status?: string): boolean {
  return normalizeTaskStatus(status) === 'cancelled';
}

export function getTaskStatusText(status?: string): string {
  return TASK_STATUS_TEXT[normalizeTaskStatus(status)];
}

export function getTaskStatusColor(status?: string): string {
  return TASK_STATUS_COLOR[normalizeTaskStatus(status)];
}

export function canCancelTask(taskOrStatus: Pick<Task, 'status'> | string): boolean {
  const status = typeof taskOrStatus === 'string' ? taskOrStatus : taskOrStatus.status;
  return isTaskActive(status);
}

export function canRetryTask(taskOrStatus: Pick<Task, 'status'> | string): boolean {
  const status = typeof taskOrStatus === 'string' ? taskOrStatus : taskOrStatus.status;
  return isTaskFailed(status);
}

export function canDeleteTask(task: Pick<Task, 'status'>): boolean {
  void task;
  return true;
}

export function matchesTaskStatusFilter(status: string | undefined, filter: 'all' | 'running' | Task['status']): boolean {
  if (filter === 'all') return true;
  if (filter === 'running') return isTaskActive(status);
  return normalizeTaskStatus(status) === filter;
}

export function getAutoDownloadBadge(task: Pick<Task, 'status' | 'downloaded' | 'download_status' | 'download_error'>): { className: string; text: string } {
  if (task.downloaded || task.download_status === 'downloaded') return { className: 'bg-green-100 text-green-700', text: '已下载' };
  if (task.download_status === 'downloading') return { className: 'bg-sky-100 text-sky-700', text: '下载中' };
  if (task.download_status === 'failed' || task.download_error) return { className: 'bg-red-100 text-red-700', text: '下载失败' };
  if (isTaskSucceeded(task.status)) return { className: 'bg-blue-100 text-blue-700', text: '待自动下载' };
  return { className: 'bg-amber-100 text-amber-700', text: '等待下载' };
}

export function createTaskStats(tasks: Pick<Task, 'status'>[]) {
  return {
    all: tasks.length,
    running: tasks.filter(t => isTaskActive(t.status)).length,
    succeed: tasks.filter(t => isTaskSucceeded(t.status)).length,
    failed: tasks.filter(t => isTaskFailed(t.status)).length,
    cancelled: tasks.filter(t => isTaskCancelled(t.status)).length,
  };
}
