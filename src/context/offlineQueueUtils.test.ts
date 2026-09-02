import { describe, expect, it } from 'vitest';
import {
  MAX_OFFLINE_RETRY_COUNT,
  normalizeOfflineQueueForStorage,
  normalizeOfflineQueueItem,
  offlineQueueItemHasLocalOnlyMedia,
  sanitizeOfflineQueueItemForStorage,
  isNetworkErrorMessage,
  isOfflineQueueRetryExhausted,
  isRetryableNetworkError,
} from './offlineQueueUtils';
import { STORAGE_OMITTED_VALUE } from './taskUtils';
import { ApiError } from '../services/api/errorNormalizer';
import type { OfflineQueueItem } from './offlineQueueUtils';

const baseItem: OfflineQueueItem = {
  id: 'offline-1',
  model: 'model-a',
  mode: 'image',
  prompt: 'hello',
  request: { model: 'model-a', prompt: 'hello', image: 'https://example.com/a.png' },
  count: 1,
  createdAt: 1,
  retryCount: 0,
};

describe('offlineQueueUtils', () => {
  it('sanitizes local-only image data before persisting', () => {
    const sanitized = sanitizeOfflineQueueItemForStorage({
      ...baseItem,
      request: { model: 'model-a', prompt: 'hello', image: 'data:image/png;base64,abcd' },
    });
    expect(sanitized.request.image).toBe(STORAGE_OMITTED_VALUE);
  });

  it('truncates overly long prompt and error text', () => {
    const longText = 'a'.repeat(9000);
    const sanitized = sanitizeOfflineQueueItemForStorage({ ...baseItem, prompt: longText, lastError: longText });
    expect(sanitized.prompt.length).toBeLessThan(longText.length);
    expect(sanitized.lastError?.length).toBeLessThan(longText.length);
  });

  it('normalizes unknown input and rejects invalid records', () => {
    expect(normalizeOfflineQueueItem({ id: '', request: {} })).toBeNull();
    expect(normalizeOfflineQueueItem({ id: 'x', request: undefined })).toBeNull();
    expect(normalizeOfflineQueueItem('not-an-object')).toBeNull();

    const normalized = normalizeOfflineQueueItem({
      id: 'offline-2',
      model: 'm',
      mode: 'bad-mode',
      prompt: 123,
      request: { model: 'm', prompt: '' },
      count: Number.NaN,
      createdAt: 'not-a-number',
      retryCount: 2,
    });
    expect(normalized?.mode).toBe('text');
    expect(normalized?.count).toBe(1);
    expect(normalized?.retryCount).toBe(2);
    expect(typeof normalized?.createdAt).toBe('number');
  });

  it('filters invalid entries when normalizing a list', () => {
    const list = normalizeOfflineQueueForStorage([{ id: 'a', request: { model: 'm', prompt: '' } }, { id: '' }, null]);
    expect(list).toHaveLength(1);
  });

  it('detects local-only media inside a queued request', () => {
    expect(offlineQueueItemHasLocalOnlyMedia({ ...baseItem, request: { model: 'm', prompt: '', image: 'blob:http://x' } })).toBe(true);
    expect(offlineQueueItemHasLocalOnlyMedia(baseItem)).toBe(false);
  });

  it('recognizes network-related error messages', () => {
    expect(isNetworkErrorMessage('视频生成请求失败: 网络连接异常')).toBe(true);
    expect(isNetworkErrorMessage('Failed to fetch')).toBe(true);
    expect(isNetworkErrorMessage('HTTP 401')).toBe(false);
    expect(isNetworkErrorMessage(undefined)).toBe(false);
  });

  it('recognizes timeout messages (回归：中文“请求超时”曾被漏判)', () => {
    expect(isNetworkErrorMessage('视频生成请求失败: 请求超时')).toBe(true);
    expect(isNetworkErrorMessage('timeout of 60000ms exceeded')).toBe(true);
  });

  it('isRetryableNetworkError prefers ApiError flags over message regex', () => {
    expect(isRetryableNetworkError(new ApiError('视频生成请求失败: 请求超时', { isTimeout: true }))).toBe(true);
    expect(isRetryableNetworkError(new ApiError('网络连接异常', { isNetwork: true }))).toBe(true);
    // 标志明确为非网络类时，即使文案含“网络”也不入队
    expect(isRetryableNetworkError(new ApiError('网络连接异常', {}))).toBe(false);
    // 非 ApiError 回退到文案匹配
    expect(isRetryableNetworkError(new Error('Failed to fetch'), 'Failed to fetch')).toBe(true);
    expect(isRetryableNetworkError(new Error('bad params'), '参数错误')).toBe(false);
  });

  it('isOfflineQueueRetryExhausted caps auto retries', () => {
    expect(isOfflineQueueRetryExhausted({ retryCount: MAX_OFFLINE_RETRY_COUNT - 1 })).toBe(false);
    expect(isOfflineQueueRetryExhausted({ retryCount: MAX_OFFLINE_RETRY_COUNT })).toBe(true);
  });
});
