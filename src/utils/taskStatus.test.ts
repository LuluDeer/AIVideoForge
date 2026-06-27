import { describe, expect, it } from 'vitest';
import {
  canCancelTask,
  canDeleteTask,
  canRetryTask,
  createTaskStats,
  getAutoDownloadBadge,
  isTaskActive,
  isTaskCancelled,
  isTaskFailed,
  isTaskSucceeded,
  isTaskTerminal,
  matchesTaskStatusFilter,
  normalizeTaskStatus,
} from './taskStatus';
import type { Task } from '../types';

describe('taskStatus', () => {
  it('normalizes common provider status aliases', () => {
    expect(normalizeTaskStatus('success')).toBe('succeed');
    expect(normalizeTaskStatus('COMPLETED')).toBe('succeed');
    expect(normalizeTaskStatus('user_cancelled')).toBe('cancelled');
    expect(normalizeTaskStatus('timeout')).toBe('failed');
    expect(normalizeTaskStatus('video_generating')).toBe('running');
    expect(normalizeTaskStatus('queued')).toBe('pending');
    expect(normalizeTaskStatus('unknown-provider-status')).toBe('pending');
  });

  it('classifies active, terminal, successful, failed and cancelled statuses', () => {
    expect(isTaskActive('pending')).toBe(true);
    expect(isTaskActive('running')).toBe(true);
    expect(isTaskTerminal('succeed')).toBe(true);
    expect(isTaskSucceeded('done')).toBe(true);
    expect(isTaskFailed('error')).toBe(true);
    expect(isTaskCancelled('canceled')).toBe(true);
    expect(isTaskFailed('cancelled')).toBe(false);
    expect(canRetryTask({ status: 'cancelled' })).toBe(false);
  });

  it('controls retry, cancel, delete and filter matching consistently', () => {
    const failedTask = { status: 'failed' as const };
    expect(canRetryTask(failedTask)).toBe(true);
    expect(canCancelTask('processing')).toBe(true);
    expect(canDeleteTask(failedTask)).toBe(true);
    expect(matchesTaskStatusFilter('pending', 'running')).toBe(true);
    expect(matchesTaskStatusFilter('succeed', 'running')).toBe(false);
    expect(matchesTaskStatusFilter('completed', 'succeed')).toBe(true);
  });

  it('builds aggregate stats and auto-download badges from normalized statuses', () => {
    const tasks = [
      { status: 'pending' },
      { status: 'running' },
      { status: 'success' },
      { status: 'fail' },
      { status: 'cancel' },
    ] as Array<Pick<Task, 'status'>>;
    expect(createTaskStats(tasks)).toEqual({ all: 5, running: 2, succeed: 1, failed: 1, cancelled: 1 });
    expect(getAutoDownloadBadge({ status: 'succeed', downloaded: false }).text).toBe('待自动下载');
    expect(getAutoDownloadBadge({ status: 'succeed', downloaded: false, download_status: 'downloading' }).text).toBe('下载中');
    expect(getAutoDownloadBadge({ status: 'succeed', downloaded: false, download_error: '磁盘写入失败' }).text).toBe('下载失败');
    expect(getAutoDownloadBadge({ status: 'failed', downloaded: true }).text).toBe('已下载');
  });
});
