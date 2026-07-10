import { describe, expect, it } from 'vitest';
import {
  normalizeOfflineQueueForStorage,
  normalizeOfflineQueueItem,
  offlineQueueItemHasLocalOnlyMedia,
  sanitizeOfflineQueueItemForStorage,
  isNetworkErrorMessage,
} from './offlineQueueUtils';
import { STORAGE_OMITTED_VALUE } from './taskUtils';
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
});
