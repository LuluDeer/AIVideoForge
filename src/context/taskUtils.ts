import type { GenerationMode, Task, TaskQueryResponse } from '../types';
import { getApiSafeMessage } from '../services/api/errorNormalizer';
import { matchesTaskStatusFilter, normalizeTaskStatus } from '../utils/taskStatus';
export {
  ACTIVE_TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  TASK_STATUS_COLOR,
  TASK_STATUS_TEXT,
  canCancelTask,
  canDeleteTask,
  canRetryTask,
  createTaskStats,
  getAutoDownloadBadge,
  getTaskStatusColor,
  getTaskStatusText,
  isTaskActive,
  isTaskCancelled,
  isTaskFailed,
  isTaskRunning,
  isTaskSucceeded,
  isTaskTerminal,
  matchesTaskStatusFilter,
  normalizeTaskStatus,
} from '../utils/taskStatus';

export const POLL_TIMEOUT = 120;
export const POLL_INTERVAL = 15000;
export const MAX_POLL_ERROR_COUNT = 3;
export const POLL_RECOVERY_INTERVAL = 5 * 60 * 1000; // 暂停后自动恢复尝试间隔：5 分钟
export const MAX_CONCURRENT_POLLS = 5; // 单次轮询周期内最大并发请求数，避免任务数量过多时产生请求风暴
export const MAX_DOWNLOAD_RETRY_COUNT = 3; // 下载失败后最多自动重试次数（指数退避）

/**
 * 自适应轮询间隔（指数退避）。
 * 根据任务从创建至今的运行时长动态调整轮询频率，减少长时任务无效请求。
 * - 前 2 分钟：15 秒/次
 * - 2-5 分钟：30 秒/次
 * - 5-10 分钟：60 秒/次
 * - 10 分钟以上：120 秒/次
 */
export function getAdaptivePollInterval(createdAt: number, now: number = Date.now()): number {
  const elapsedMin = (now - createdAt) / 60000;
  if (elapsedMin < 2) return 15000;
  if (elapsedMin < 5) return 30000;
  if (elapsedMin < 10) return 60000;
  return 120000;
}
export const POLL_TIMEOUT_PAUSED_MESSAGE = '自动轮询已暂停，云端状态未知，请手动刷新或同步云端';
export const STORAGE_OMITTED_VALUE = '[omitted-large-local-data]';
export const LOCAL_ONLY_IMAGE_MESSAGE = '本地图片未保存，请重新上传或改用公开 URL';

const LOCAL_DATA_URL_RE = /^(data:|blob:)/i;

export function getTaskVideoUrl(result: Pick<TaskQueryResponse, 'video_result'>): string | undefined {
  return result.video_result?.find(item => item?.url)?.url;
}

export function formatPollError(error: unknown, count: number): string {
  const message = getApiSafeMessage(error, '网络或服务异常');
  return `轮询暂时失败（连续 ${count} 次）：${message}`;
}

export function createPollTimeoutPausePatch(task: Pick<Task, 'poll_error_count'>): Partial<Task> {
  return {
    poll_error_count: task.poll_error_count ?? 0,
    poll_paused: true,
    poll_paused_at: Date.now(),
    last_poll_error: POLL_TIMEOUT_PAUSED_MESSAGE,
  };
}

/**
 * 判断任务当前是否可被轮询：未暂停的任务始终可轮询；
 * 已暂停的任务需等待 POLL_RECOVERY_INTERVAL 后才允许一次自动恢复尝试。
 */
export function isTaskPollEligible(task: Pick<Task, 'poll_paused' | 'poll_paused_at'>, now: number = Date.now()): boolean {
  if (!task.poll_paused) return true;
  return typeof task.poll_paused_at === 'number' && now - task.poll_paused_at >= POLL_RECOVERY_INTERVAL;
}

/**
 * 下载失败自动重试的退避延迟（毫秒）：10s → 20s → 40s，上限 60s。
 * retryCount 为即将进行的第几次重试（从 1 开始）。
 */
export function getDownloadRetryDelay(retryCount: number): number {
  return Math.min(10000 * 2 ** Math.max(retryCount - 1, 0), 60000);
}

/**
 * 判断下载失败任务当前是否可触发自动重试：仅当状态为 failed 且已到达预定的
 * download_retry_at 恢复时刻。重试次数上限（MAX_DOWNLOAD_RETRY_COUNT）由失败时
 * 是否写入 download_retry_at 决定，此处无需重复校验。
 */
export function isDownloadRetryEligible(task: Pick<Task, 'download_status' | 'download_retry_at'>, now: number = Date.now()): boolean {
  if (task.download_status !== 'failed') return false;
  return typeof task.download_retry_at === 'number' && now >= task.download_retry_at;
}

const ACTIONABLE_ERROR_RULES: Array<{ test: RegExp; advice: string }> = [
  { test: /api\s*key|api_key|401|unauthori[sz]ed/i, advice: '检查 API Key' },
  { test: /429|rate limit|too many requests/i, advice: '降低频率后重试' },
  { test: /failed to fetch|network|timeout|timed out|ECONNABORTED/i, advice: '检查网络后重试' },
  { test: /upload|上传|image.*fail/i, advice: '重新上传图片' },
  { test: /url|公开访问|public/i, advice: '改用公开 URL' },
  { test: /轮询|查询|同步|refresh/i, advice: '手动刷新任务' },
];

export function getActionableErrorAdvice(message?: string): string | undefined {
  if (!message) return undefined;
  for (const rule of ACTIONABLE_ERROR_RULES) {
    if (rule.test.test(message)) return rule.advice;
  }
  return undefined;
}

export function formatErrorWithAdvice(message: string, fallbackAdvice?: string): string {
  const advice = getActionableErrorAdvice(message) ?? fallbackAdvice;
  return advice ? `${message}。建议：${advice}` : message;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const MAX_PROMPT_LENGTH = 8000;
const MAX_ERROR_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;
const MAX_PARAM_STRING_LENGTH = 4000;
const MAX_PARAM_ARRAY_LENGTH = 30;
const MAX_PARAM_DEPTH = 4;

const str = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const num = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const timestamp = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : (Number(new Date(String(value ?? ''))) || Date.now());
const truncate = (value: string | undefined, max: number): string | undefined => {
  if (!value) return value;
  return value.length > max ? `${value.slice(0, max)}...` : value;
};

export const isLocalOnlyImagePlaceholder = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed === STORAGE_OMITTED_VALUE || LOCAL_DATA_URL_RE.test(trimmed);
};

export const containsLocalOnlyImageValue = (value: unknown): boolean => {
  if (isLocalOnlyImagePlaceholder(value)) return true;
  if (Array.isArray(value)) return value.some(containsLocalOnlyImageValue);
  if (!isRecord(value)) return false;
  return Object.values(value).some(containsLocalOnlyImageValue);
};

const sanitizeUrlForStorage = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value) return undefined;
  if (isLocalOnlyImagePlaceholder(value)) return undefined;
  return truncate(value, MAX_URL_LENGTH);
};

const sanitizeParamValueForStorage = (value: unknown, depth = 0): unknown => {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (isLocalOnlyImagePlaceholder(value)) return STORAGE_OMITTED_VALUE;
    return truncate(value, MAX_PARAM_STRING_LENGTH) ?? '';
  }
  if (depth >= MAX_PARAM_DEPTH) return STORAGE_OMITTED_VALUE;
  if (Array.isArray(value)) return value.slice(0, MAX_PARAM_ARRAY_LENGTH).map(item => sanitizeParamValueForStorage(item, depth + 1));
  if (!isRecord(value)) return undefined;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!key || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const sanitized = sanitizeParamValueForStorage(item, depth + 1);
    if (sanitized !== undefined) output[key] = sanitized;
  }
  return output;
};

const normalizeMode = (mode: unknown): GenerationMode =>
  mode === 'image' || mode === 'imageTail' || mode === 'multiImage' || mode === 'multiModal' || mode === 'text' ? mode : 'text';

const normalizeDownloadStatus = (status: unknown, downloaded: unknown): Task['download_status'] => {
  if (downloaded === true) return 'downloaded';
  return status === 'waiting' || status === 'downloading' || status === 'downloaded' || status === 'failed' ? status : undefined;
};

export function normalizeTaskForStorage(value: unknown): Task | null {
  if (!isRecord(value)) return null;
  const id = str(value.id);
  if (!id) return null;
  return {
    ...(value as Partial<Task>),
    id,
    platformId: typeof value.platformId === 'string' ? value.platformId : undefined,
    prompt: str(value.prompt),
    model: str(value.model),
    mode: normalizeMode(value.mode),
    count: num(value.count, 1),
    status: normalizeTaskStatus(str(value.status)),
    raw_status: typeof value.raw_status === 'string' ? value.raw_status : str(value.status),
    poll_count: num(value.poll_count, 0),
    poll_error_count: num(value.poll_error_count, 0),
    poll_paused: typeof value.poll_paused === 'boolean' ? value.poll_paused : false,
    cancel_scope: value.cancel_scope === 'remote' || value.cancel_scope === 'local' ? value.cancel_scope : undefined,
    downloaded: typeof value.downloaded === 'boolean' ? value.downloaded : value.download_status === 'downloaded',
    download_status: normalizeDownloadStatus(value.download_status, value.downloaded),
    download_retry_count: num(value.download_retry_count, 0),
    created_at: timestamp(value.created_at),
    updated_at: timestamp(value.updated_at),
  };
}

export function sanitizeTaskForStorage(task: Task): Task {
  const sanitizedParams = sanitizeParamValueForStorage(task.saved_params) as Record<string, unknown> | undefined;
  return {
    ...task,
    prompt: truncate(task.prompt, MAX_PROMPT_LENGTH) ?? '',
    enhanced_prompt: truncate(task.enhanced_prompt, MAX_PROMPT_LENGTH),
    error_message: truncate(task.error_message, MAX_ERROR_LENGTH),
    download_error: truncate(task.download_error, MAX_ERROR_LENGTH),
    last_poll_error: truncate(task.last_poll_error, MAX_ERROR_LENGTH),
    image_url: sanitizeUrlForStorage(task.image_url),
    image_tail_url: sanitizeUrlForStorage(task.image_tail_url),
    image_urls: task.image_urls?.map(sanitizeUrlForStorage).filter((url): url is string => !!url).slice(0, MAX_PARAM_ARRAY_LENGTH),
    video_url: sanitizeUrlForStorage(task.video_url),
    last_frame_url: sanitizeUrlForStorage(task.last_frame_url),
    saved_params: sanitizedParams && Object.keys(sanitizedParams).length ? sanitizedParams : undefined,
    retry_history: task.retry_history?.slice(-20).map(item => ({
      ...item,
      old_error: truncate(item.old_error, MAX_ERROR_LENGTH),
      error: truncate(item.error, MAX_ERROR_LENGTH),
    })),
  };
}

export function normalizeTasksForStorage(tasks: unknown[]): Task[] {
  return tasks.map(normalizeTaskForStorage).filter((task): task is Task => !!task).map(sanitizeTaskForStorage);
}

export function createNewTask(taskData: Omit<Task, 'created_at' | 'updated_at'>): Task {
  return {
    ...taskData,
    status: normalizeTaskStatus(taskData.status),
    raw_status: taskData.raw_status ?? taskData.status,
    poll_error_count: taskData.poll_error_count ?? 0,
    poll_paused: taskData.poll_paused ?? false,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

export function normalizeTaskPatch(updates: Partial<Task>): Partial<Task> {
  const normalizedUpdates: Partial<Task> = { ...updates };
  if (updates.status) normalizedUpdates.status = normalizeTaskStatus(updates.status);
  if (updates.error_message) normalizedUpdates.error_message = getApiSafeMessage(updates.error_message, updates.error_message);
  return normalizedUpdates;
}

export function getModelStats(tasks: Task[], filter: 'all' | 'running' | Task['status']): Record<string, number> {
  const stats: Record<string, number> = {};
  tasks.filter(task => matchesTaskStatusFilter(task.status, filter)).forEach(task => {
    const model = task.model || '未知模型';
    stats[model] = (stats[model] || 0) + 1;
  });
  return stats;
}
