import { describe, expect, it } from 'vitest';
import {
  POLL_TIMEOUT_PAUSED_MESSAGE,
  STORAGE_OMITTED_VALUE,
  containsLocalOnlyImageValue,
  createPollTimeoutPausePatch,
  formatErrorWithAdvice,
  formatPollError,
  getActionableErrorAdvice,
  getModelStats,
  isLocalOnlyImagePlaceholder,
  normalizeTaskForStorage,
  sanitizeTaskForStorage,
} from './taskUtils';
import type { Task } from '../types';

const baseTask: Task = {
  id: 'task-1',
  prompt: 'prompt',
  model: 'model-a',
  mode: 'image',
  count: 1,
  status: 'failed',
  created_at: 1,
  updated_at: 2,
};

describe('taskUtils storage sanitizers', () => {
  it('detects local-only image placeholders recursively', () => {
    expect(isLocalOnlyImagePlaceholder('data:image/png;base64,abc')).toBe(true);
    expect(isLocalOnlyImagePlaceholder('blob:http://local')).toBe(true);
    expect(isLocalOnlyImagePlaceholder(STORAGE_OMITTED_VALUE)).toBe(true);
    expect(containsLocalOnlyImageValue({ nested: ['https://example.com/a.png', STORAGE_OMITTED_VALUE] })).toBe(true);
    expect(containsLocalOnlyImageValue({ nested: ['https://example.com/a.png'] })).toBe(false);
  });

  it('normalizes unknown task input and removes unsafe saved param fields', () => {
    const normalized = normalizeTaskForStorage({
      id: 'task-2',
      prompt: 123,
      model: 'm',
      mode: 'bad-mode',
      count: Number.NaN,
      status: 'completed',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: 3,
    });
    expect(normalized?.status).toBe('succeed');
    expect(normalized?.mode).toBe('text');
    expect(normalized?.count).toBe(1);

    const sanitized = sanitizeTaskForStorage({
      ...baseTask,
      image_url: 'data:image/png;base64,abc',
      image_tail_url: 'blob:http://local',
      image_urls: ['https://example.com/ok.png', STORAGE_OMITTED_VALUE],
      saved_params: {
        keep: 'ok',
        image: 'data:image/jpeg;base64,abc',
        constructor: { polluted: true },
        deep: { a: { b: { c: { d: { tooDeep: true } } } } },
      },
    });
    expect(sanitized.image_url).toBeUndefined();
    expect(sanitized.image_tail_url).toBeUndefined();
    expect(sanitized.image_urls).toEqual(['https://example.com/ok.png']);
    expect(sanitized.saved_params).toMatchObject({ keep: 'ok', image: STORAGE_OMITTED_VALUE });
    expect(sanitized.saved_params).not.toHaveProperty('constructor');
  });

  it('truncates large task fields and keeps latest retry history', () => {
    const long = 'x'.repeat(2500);
    const sanitized = sanitizeTaskForStorage({
      ...baseTask,
      prompt: 'p'.repeat(9000),
      error_message: long,
      video_url: `https://example.com/${'v'.repeat(3000)}`,
      retry_history: Array.from({ length: 25 }, (_, index) => ({
        time: index,
        old_task_id: `old-${index}`,
        new_task_id: `new-${index}`,
        success: false,
        error: long,
      })),
    });
    expect(sanitized.prompt.length).toBeLessThanOrEqual(8003);
    expect(sanitized.error_message?.endsWith('...')).toBe(true);
    expect(sanitized.video_url?.length).toBeLessThanOrEqual(2051);
    expect(sanitized.retry_history).toHaveLength(20);
    expect(sanitized.retry_history?.[0].new_task_id).toBe('new-5');
  });
});

describe('taskUtils presentation helpers', () => {
  it('adds actionable advice and safe poll error text', () => {
    expect(getActionableErrorAdvice('HTTP 401 unauthorized')).toBe('检查 API Key');
    expect(formatErrorWithAdvice('上传失败')).toContain('重新上传图片');
    expect(formatPollError(new Error('Authorization: secret'), 1)).not.toContain('secret');
  });

  it('pauses polling timeout without marking active tasks as failed', () => {
    const runningTask = { ...baseTask, status: 'running' as const, poll_error_count: 2 };
    const patch = createPollTimeoutPausePatch(runningTask);
    expect(patch).toMatchObject({
      poll_error_count: 2,
      poll_paused: true,
      last_poll_error: POLL_TIMEOUT_PAUSED_MESSAGE,
    });
    expect(typeof patch.poll_paused_at).toBe('number');
    expect(patch).not.toHaveProperty('status');
    expect(patch).not.toHaveProperty('error_message');
    expect({ ...runningTask, ...patch }).toMatchObject({ status: 'running', poll_paused: true });
  });

  it('counts model stats after status filtering', () => {
    const tasks = [
      { ...baseTask, id: '1', status: 'pending', model: 'a' },
      { ...baseTask, id: '2', status: 'running', model: 'a' },
      { ...baseTask, id: '3', status: 'failed', model: 'b' },
    ] as Task[];
    expect(getModelStats(tasks, 'running')).toEqual({ a: 2 });
    expect(getModelStats(tasks, 'failed')).toEqual({ b: 1 });
  });
});
