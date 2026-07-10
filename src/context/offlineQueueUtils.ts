import type { GenerationMode, VideoGenerationRequest } from '../types';
import {
  containsLocalOnlyImageValue,
  isLocalOnlyImagePlaceholder,
  LOCAL_ONLY_IMAGE_MESSAGE,
  STORAGE_OMITTED_VALUE,
} from './taskUtils';

// ─── 离线队列（提交时网络异常，暂存待网络恢复后自动提交）──────
export interface OfflineQueueItem {
  id: string;
  platformId?: string;
  model: string;
  mode: GenerationMode;
  prompt: string;
  /** 提交时构建好的完整请求（含 prompt），网络恢复后直接复用提交 */
  request: VideoGenerationRequest;
  /** 本批次生成数量，仅用于展示与写回任务记录 */
  count: number;
  autoDownload?: boolean;
  downloadPath?: string;
  createdAt: number;
  /** 自动/手动重试已尝试次数 */
  retryCount: number;
  lastError?: string;
  lastAttemptAt?: number;
}

export const OFFLINE_QUEUE_STORAGE_KEY = 'geekai_offline_queue';
export const MAX_OFFLINE_QUEUE_SIZE = 200;
export const OFFLINE_LOCAL_IMAGE_MESSAGE = LOCAL_ONLY_IMAGE_MESSAGE;
/** 自动轮询处理离线队列的兜底间隔（毫秒），弥补 online 事件在部分环境下不可靠的情况 */
export const OFFLINE_QUEUE_RETRY_INTERVAL = 30000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const MAX_DEPTH = 6;
const MAX_ARRAY_LENGTH = 30;
const MAX_STRING_LENGTH = 4000;
const MAX_PROMPT_LENGTH = 8000;
const MAX_ERROR_LENGTH = 2000;

/**
 * 递归清洗请求参数用于持久化：
 * - 本地图片占位值（data:/blob: 或已省略标记）替换为统一省略标记，避免撑爆 localStorage；
 * - 超长字符串截断；数组/嵌套深度设上限，避免异常数据无限增长。
 */
function sanitizeValueForStorage(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (isLocalOnlyImagePlaceholder(value)) return STORAGE_OMITTED_VALUE;
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;
  }
  if (depth >= MAX_DEPTH) return STORAGE_OMITTED_VALUE;
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_LENGTH).map(item => sanitizeValueForStorage(item, depth + 1));
  if (!isRecord(value)) return undefined;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!key || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const sanitized = sanitizeValueForStorage(item, depth + 1);
    if (sanitized !== undefined) output[key] = sanitized;
  }
  return output;
}

export function sanitizeOfflineQueueItemForStorage(item: OfflineQueueItem): OfflineQueueItem {
  return {
    ...item,
    prompt: item.prompt.length > MAX_PROMPT_LENGTH ? `${item.prompt.slice(0, MAX_PROMPT_LENGTH)}...` : item.prompt,
    lastError: item.lastError && item.lastError.length > MAX_ERROR_LENGTH ? `${item.lastError.slice(0, MAX_ERROR_LENGTH)}...` : item.lastError,
    request: sanitizeValueForStorage(item.request) as VideoGenerationRequest,
  };
}

export function sanitizeOfflineQueueForStorage(items: OfflineQueueItem[]): OfflineQueueItem[] {
  return items.map(sanitizeOfflineQueueItemForStorage);
}

const str = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const num = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const normalizeMode = (mode: unknown): GenerationMode =>
  mode === 'image' || mode === 'imageTail' || mode === 'multiImage' || mode === 'multiModal' || mode === 'text'
    ? mode
    : 'text';

export function normalizeOfflineQueueItem(value: unknown): OfflineQueueItem | null {
  if (!isRecord(value)) return null;
  const id = str(value.id);
  if (!id) return null;
  const request = isRecord(value.request) ? (value.request as VideoGenerationRequest) : undefined;
  if (!request) return null;
  return {
    id,
    platformId: typeof value.platformId === 'string' ? value.platformId : undefined,
    model: str(value.model),
    mode: normalizeMode(value.mode),
    prompt: str(value.prompt),
    request,
    count: num(value.count, 1),
    autoDownload: typeof value.autoDownload === 'boolean' ? value.autoDownload : undefined,
    downloadPath: typeof value.downloadPath === 'string' ? value.downloadPath : undefined,
    createdAt: num(value.createdAt, Date.now()),
    retryCount: num(value.retryCount, 0),
    lastError: typeof value.lastError === 'string' ? value.lastError : undefined,
    lastAttemptAt: typeof value.lastAttemptAt === 'number' && Number.isFinite(value.lastAttemptAt) ? value.lastAttemptAt : undefined,
  };
}

export function normalizeOfflineQueueForStorage(values: unknown[]): OfflineQueueItem[] {
  return values.map(normalizeOfflineQueueItem).filter((item): item is OfflineQueueItem => !!item);
}

/** 队列条目的请求中是否包含本地专属图片（data:/blob:），重启后可能已被清洗，需要提示用户重新上传 */
export function offlineQueueItemHasLocalOnlyMedia(item: OfflineQueueItem): boolean {
  return containsLocalOnlyImageValue(item.request);
}

/** 判断错误信息是否为网络类错误，用于展示更贴切的提示文案 */
export function isNetworkErrorMessage(message?: string): boolean {
  if (!message) return false;
  return /网络|连接异常|network|failed to fetch|ECONNABORTED|timed?\s*out/i.test(message);
}
