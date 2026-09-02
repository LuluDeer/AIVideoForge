import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import VideoApi from '../services/api';
import { getApiSafeMessage } from '../services/api/errorNormalizer';
import { readJsonStorage, writeJsonStorage } from '../utils/storage';
import { logger } from '../utils/logger';
import { useConfig } from './useConfig';
import { useTasks } from './useTasks';
import { OfflineQueueContext } from './offlineQueueContextValue';
import type { OfflineQueueContextType } from './offlineQueueContextValue';
import {
  MAX_OFFLINE_QUEUE_SIZE,
  OFFLINE_LOCAL_IMAGE_MESSAGE,
  OFFLINE_QUEUE_RETRY_INTERVAL,
  OFFLINE_QUEUE_STORAGE_KEY,
  isOfflineQueueRetryExhausted,
  isRetryableNetworkError,
  normalizeOfflineQueueForStorage,
  offlineQueueItemHasLocalOnlyMedia,
  sanitizeOfflineQueueForStorage,
} from './offlineQueueUtils';
import type { OfflineQueueItem } from './offlineQueueUtils';
import { getTaskVideoUrl, normalizeTaskStatus } from './taskUtils';

const generateOfflineId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `offline-${crypto.randomUUID()}`;
  } catch {
    // 部分环境（如非安全上下文）可能不支持 crypto.randomUUID，回退到时间戳方案
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * 离线队列：网络断开（或提交遭遇网络类异常）时暂存待提交任务，
 * 监听 online/offline 事件与兜底轮询，网络恢复后自动依次重新提交。
 */
export const OfflineQueueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<OfflineQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [isProcessing, setIsProcessing] = useState(false);

  const { runtimePlatforms, activePlatform } = useConfig();
  const { addTask } = useTasks();

  const queueRef = useRef(queue);
  const runtimePlatformsRef = useRef(runtimePlatforms);
  const activePlatformRef = useRef(activePlatform);
  const processingRef = useRef(false);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { runtimePlatformsRef.current = runtimePlatforms; }, [runtimePlatforms]);
  useEffect(() => { activePlatformRef.current = activePlatform; }, [activePlatform]);

  const saveQueue = useCallback((data: OfflineQueueItem[]) => {
    writeJsonStorage(OFFLINE_QUEUE_STORAGE_KEY, sanitizeOfflineQueueForStorage(data), e => logger.error('OfflineQueueContext', '保存离线队列失败', e));
  }, []);

  // 启动时从 localStorage 恢复未完成的离线任务，避免应用重启后丢失
  useEffect(() => {
    const parsed = readJsonStorage<unknown[]>(OFFLINE_QUEUE_STORAGE_KEY, [], Array.isArray);
    const loaded = normalizeOfflineQueueForStorage(parsed);
    if (loaded.length > 0) setQueue(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPlatformForItem = useCallback((item: OfflineQueueItem) => item.platformId
    ? (runtimePlatformsRef.current.find(p => p.id === item.platformId) ?? activePlatformRef.current)
    : activePlatformRef.current, []);

  const submitOfflineItem = useCallback(async (item: OfflineQueueItem): Promise<{ success: boolean; networkError: boolean; message?: string }> => {
    const platform = getPlatformForItem(item);
    if (!platform?.apiKey) {
      return { success: false, networkError: false, message: '平台未配置 API Key，无法提交' };
    }
    if (offlineQueueItemHasLocalOnlyMedia(item)) {
      return { success: false, networkError: false, message: OFFLINE_LOCAL_IMAGE_MESSAGE };
    }
    try {
      const api = new VideoApi(platform);
      const response = await api.generateVideo(item.request);
      const paramsSnapshot: Record<string, unknown> = { ...item.request };
      delete paramsSnapshot.prompt;
      addTask({
        id: response.task_id,
        platformId: platform.id,
        prompt: item.prompt,
        model: item.model,
        mode: item.mode,
        count: item.count,
        image_url: Array.isArray(item.request.image) ? item.request.image[0] : (typeof item.request.image === 'string' ? item.request.image : undefined),
        image_tail_url: item.request.image_tail as string | undefined,
        image_urls: Array.isArray(item.request.image) ? item.request.image : (Array.isArray(item.request.images) ? item.request.images as string[] : undefined),
        video_urls: Array.isArray(item.request.video) ? item.request.video as string[] : (typeof item.request.video === 'string' ? [item.request.video] : undefined),
        audio_urls: Array.isArray(item.request.audio) ? item.request.audio as string[] : (typeof item.request.audio === 'string' ? [item.request.audio] : undefined),
        status: normalizeTaskStatus(response.task_status),
        raw_status: response.task_status,
        video_url: getTaskVideoUrl(response, platform),
        auto_download: Boolean(item.autoDownload && item.downloadPath),
        downloaded: false,
        download_status: item.autoDownload && item.downloadPath ? 'waiting' : undefined,
        download_path: item.autoDownload && item.downloadPath ? item.downloadPath : undefined,
        saved_params: paramsSnapshot,
      });
      return { success: true, networkError: false };
    } catch (err) {
      const message = getApiSafeMessage(err, '视频生成请求失败');
      return { success: false, networkError: isRetryableNetworkError(err, message), message };
    }
  }, [addTask, getPlatformForItem]);

  const processOfflineQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;
    processingRef.current = true;
    setIsProcessing(true);
    try {
      // 使用快照遍历：处理期间队列可能因成功移除/用户手动操作而变化，需以最新状态为准逐条核对
      const snapshot = [...queueRef.current];
      for (const item of snapshot) {
        if (!queueRef.current.some(q => q.id === item.id)) continue;
        // 自动重试已达上限的条目不再自动提交，保留在队列中等待用户手动重试
        if (isOfflineQueueRetryExhausted(item)) continue;
        const result = await submitOfflineItem(item);
        if (result.success) {
          setQueue(prev => {
            const next = prev.filter(q => q.id !== item.id);
            saveQueue(next);
            return next;
          });
        } else {
          setQueue(prev => {
            const next = prev.map(q => q.id === item.id
              ? { ...q, retryCount: q.retryCount + 1, lastError: result.message, lastAttemptAt: Date.now() }
              : q);
            saveQueue(next);
            return next;
          });
          if (result.networkError) {
            // 网络仍不可用：停止本轮剩余提交，避免连续超时，等待网络恢复事件或下次兜底轮询
            setIsOnline(false);
            break;
          }
        }
      }
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [saveQueue, submitOfflineItem]);

  const enqueueOfflineTask = useCallback((item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount' | 'lastError' | 'lastAttemptAt'>): OfflineQueueItem => {
    const newItem: OfflineQueueItem = {
      ...item,
      id: generateOfflineId(),
      createdAt: Date.now(),
      retryCount: 0,
    };
    setQueue(prev => {
      const next = [...prev, newItem].slice(-MAX_OFFLINE_QUEUE_SIZE);
      saveQueue(next);
      return next;
    });
    return newItem;
  }, [saveQueue]);

  const removeOfflineTask = useCallback((id: string) => {
    setQueue(prev => {
      const next = prev.filter(q => q.id !== id);
      saveQueue(next);
      return next;
    });
  }, [saveQueue]);

  const clearOfflineQueue = useCallback(() => {
    setQueue([]);
    saveQueue([]);
  }, [saveQueue]);

  const retryOfflineTask = useCallback(async (id: string): Promise<void> => {
    const item = queueRef.current.find(q => q.id === id);
    if (!item) return;
    const result = await submitOfflineItem(item);
    if (result.success) {
      setQueue(prev => {
        const next = prev.filter(q => q.id !== id);
        saveQueue(next);
        return next;
      });
    } else {
      // 用户主动重试视为开启新一轮自动重试周期，retryCount 重置为 1
      setQueue(prev => {
        const next = prev.map(q => q.id === id
          ? { ...q, retryCount: 1, lastError: result.message, lastAttemptAt: Date.now() }
          : q);
        saveQueue(next);
        return next;
      });
      throw new Error(result.message ?? '重试提交失败');
    }
  }, [saveQueue, submitOfflineItem]);

  // 监听浏览器/Electron 的网络状态变化事件，网络恢复时立即尝试处理队列
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 网络恢复或队列有新增任务时尝试自动提交
  useEffect(() => {
    if (isOnline && queue.length > 0) processOfflineQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, queue.length]);

  // 兜底定时轮询：部分环境 online 事件不可靠，定期尝试处理仍在队列中的任务
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline && queueRef.current.length > 0 && !processingRef.current) processOfflineQueue();
    }, OFFLINE_QUEUE_RETRY_INTERVAL);
    return () => clearInterval(interval);
  }, [isOnline, processOfflineQueue]);

  const contextValue = useMemo<OfflineQueueContextType>(() => ({
    queue,
    isOnline,
    isProcessing,
    enqueueOfflineTask,
    removeOfflineTask,
    clearOfflineQueue,
    retryOfflineTask,
    processOfflineQueue,
  }), [queue, isOnline, isProcessing, enqueueOfflineTask, removeOfflineTask, clearOfflineQueue, retryOfflineTask, processOfflineQueue]);

  return <OfflineQueueContext.Provider value={contextValue}>{children}</OfflineQueueContext.Provider>;
};
