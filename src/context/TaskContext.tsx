import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Task, VideoGenerationRequest, GenerationMode } from '../types';
import VideoApi from '../services/api';
import { getApiSafeMessage } from '../services/api/errorNormalizer';
import { readJsonStorage, writeJsonStorage } from '../utils/storage';
import { logger } from '../utils/logger';
import { useConfig } from './useConfig';
import { TaskContext } from './taskContextValue';
import type { TaskContextType } from './taskContextValue';
import {
  createNewTask,
  createPollTimeoutPausePatch,
  createTaskStats,
  containsLocalOnlyImageValue,
  formatPollError,
  getTaskVideoUrl,
  isTaskActive,
  isTaskFailed,
  isTaskSucceeded,
  LOCAL_ONLY_IMAGE_MESSAGE,
  MAX_POLL_ERROR_COUNT,
  normalizeTaskPatch,
  normalizeTasksForStorage,
  normalizeTaskStatus,
  POLL_INTERVAL,
  POLL_TIMEOUT,
  POLL_TIMEOUT_PAUSED_MESSAGE,
} from './taskUtils';

const STORAGE_KEY = 'geekai_tasks';
const SEEDANCE_MINI_MODEL_ID = 'doubao-seedance-2-0-mini-260615';

const isSeedanceMiniModel = (model?: string): boolean => {
  if (!model) return false;
  const normalized = model.toLowerCase().replace(/\./g, '-');
  return normalized.includes('doubao-seedance-2-0-mini') || normalized.includes(SEEDANCE_MINI_MODEL_ID);
};

const pickFirstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (Array.isArray(value)) {
      const first = value.find(item => typeof item === 'string' && item.trim());
      if (typeof first === 'string') return first;
    }
  }
  return undefined;
};

const normalizeReuseParamsForTargetMode = (task: Task, targetMode: GenerationMode): Record<string, unknown> => {
  const params: Record<string, unknown> = { ...((task.saved_params ?? {}) as Record<string, unknown>) };

  if (isSeedanceMiniModel(task.model)) {
    params.model = task.model;
  }

  if (targetMode === 'image') {
    const image = pickFirstString(params.image, params.images, task.image_url, task.image_urls);
    if (image) params.image = image;
  }

  if (params.aspect_ratio === undefined) params.aspect_ratio = params.ratio ?? params.aspectRatio;
  if (params.resolution === undefined) params.resolution = params.quality;
  if (params.duration === undefined) params.duration = params.seconds ?? params.videoDuration;
  if (params.generate_audio === undefined) params.generate_audio = params.withAudio ?? params.audioEnabled;

  return params;
};

const getReuseTargetMode = (task: Task): GenerationMode => task.mode;

export const TaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reuseTaskData, setReuseTaskData] = useState<{ platformId: string; model: string; mode: GenerationMode; prompt: string; paramValues: Record<string, unknown> } | null>(null);

  const pollingTaskIds = React.useRef<Set<string>>(new Set());
  const triggeredRef = React.useRef<Set<string>>(new Set());
  const pollRetryCountRef = React.useRef<Map<string, number>>(new Map());

  const { appConfig, activePlatform, runtimePlatforms, setActivePlatformId } = useConfig();
  const tasksRef = React.useRef(tasks);
  const activePlatformRef = React.useRef(activePlatform);
  const runtimePlatformsRef = React.useRef(runtimePlatforms);
  const downloadPathRef = React.useRef(appConfig.downloadPath);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { activePlatformRef.current = activePlatform; }, [activePlatform]);
  useEffect(() => { runtimePlatformsRef.current = runtimePlatforms; }, [runtimePlatforms]);
  useEffect(() => { downloadPathRef.current = appConfig.downloadPath; }, [appConfig.downloadPath]);

  const saveTasksData = useCallback((data: Task[]) => {
    writeJsonStorage(STORAGE_KEY, normalizeTasksForStorage(data), e => logger.error('TaskContext', '保存任务失败', e));
  }, []);

  const loadTasks = useCallback((): Task[] => {
    const parsed = readJsonStorage<unknown[]>(STORAGE_KEY, [], Array.isArray);
    const loaded = normalizeTasksForStorage(parsed);
    setTasks(loaded);
    return loaded;
  }, []);

  const saveTasks = useCallback(() => saveTasksData(tasksRef.current), [saveTasksData]);

  const addTask = useCallback((taskData: Omit<Task, 'created_at' | 'updated_at'>): Task => {
    const newTask = createNewTask(taskData);
    setTasks(prev => {
      const next = [newTask, ...prev];
      saveTasksData(next);
      return next;
    });
    return newTask;
  }, [saveTasksData]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    const normalizedUpdates = normalizeTaskPatch(updates);
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...normalizedUpdates, updated_at: Date.now() } : t);
      saveTasksData(next);
      return next;
    });
  }, [saveTasksData]);

  const removeTask = useCallback((id: string) => {
    setTasks(prev => {
      const next = prev.filter(t => t.id !== id);
      saveTasksData(next);
      return next;
    });
  }, [saveTasksData]);

  const clearTasks = useCallback(() => {
    setTasks([]);
    saveTasksData([]);
  }, [saveTasksData]);

  const getTaskPlatform = useCallback((task: Task) => task.platformId
    ? (runtimePlatformsRef.current.find(p => p.id === task.platformId) ?? activePlatformRef.current)
    : activePlatformRef.current, []);

  const downloadTaskVideo = useCallback(async (task: Task, videoUrl: string, overridePath?: string): Promise<void> => {
    const targetPath = overridePath || task.download_path || (task.auto_download ? '' : downloadPathRef.current);
    if (!window.electronAPI || !targetPath) {
      updateTask(task.id, {
        downloaded: false,
        download_status: 'failed',
        download_error: !window.electronAPI ? '当前环境不支持自动下载，请在桌面客户端中使用。' : '此任务没有保存自动下载目录快照，请手动下载或重新提交任务。',
      });
      return;
    }

    try {
      updateTask(task.id, { download_status: 'downloading', download_path: targetPath, download_error: undefined });
      const result = await window.electronAPI.downloadFile(videoUrl, targetPath);
      updateTask(task.id, {
        downloaded: true,
        download_status: 'downloaded',
        download_path: result.savePath || targetPath,
        download_file_path: result.filePath,
        downloaded_at: Date.now(),
        download_error: undefined,
      });
    } catch (error) {
      updateTask(task.id, {
        downloaded: false,
        download_status: 'failed',
        download_path: targetPath,
        download_error: getApiSafeMessage(error, '自动下载失败'),
      });
      throw error;
    }
  }, [updateTask]);

  const cancelTask = useCallback(async (taskId: string): Promise<void> => {
    const task = tasksRef.current.find(t => t.id === taskId);
    if (!task) return;
    const taskPlatform = getTaskPlatform(task);
    const hasRemoteCancel = !!taskPlatform?.apiKey && !!taskPlatform.endpoints.deleteTask;
    if (!hasRemoteCancel) {
      updateTask(taskId, { status: 'cancelled', cancel_scope: 'local', error_message: '已停止跟踪（仅本地停止跟踪，云端可能继续生成）' });
      return;
    }
    try {
      const api = new VideoApi(taskPlatform);
      await api.deleteTask(taskId);
      updateTask(taskId, { status: 'cancelled', cancel_scope: 'remote', error_message: '已取消（云端已取消）' });
    } catch (e) {
      logger.warn('TaskContext', '云端取消失败，已执行本地停止跟踪', e);
      updateTask(taskId, { status: 'cancelled', cancel_scope: 'local', error_message: `已停止跟踪（仅本地停止跟踪，云端可能继续生成；云端取消失败：${getApiSafeMessage(e, '未知错误')}）` });
    }
  }, [getTaskPlatform, updateTask]);

  const fetchRemoteTasks = useCallback(async (options?: { page?: number; pageSize?: number; status?: string }): Promise<void> => {
    const platform = activePlatformRef.current;
    if (!platform?.apiKey) return;
    const api = new VideoApi(platform);
    try {
      const remoteTasks = await api.queryTaskList(options || { page: 1, pageSize: 50 });
      const existingIds = new Set(tasksRef.current.map(t => t.id));
      const newTasks: Task[] = [];
      const updates: Array<{ id: string; status: Task['status']; raw_status?: string; video_url?: string; last_frame_url?: string; error_message?: string }> = [];
      for (const rt of remoteTasks) {
        if (!rt.task_id) continue;
        const status = normalizeTaskStatus(rt.task_status);
        const videoUrl = getTaskVideoUrl(rt);
        if (!existingIds.has(rt.task_id)) {
          newTasks.push({
            id: rt.task_id,
            platformId: platform.id,
            prompt: '',
            model: rt.model || '',
            mode: 'text',
            count: 1,
            status,
            raw_status: rt.task_status,
            video_url: videoUrl,
            last_frame_url: rt.last_frame_url,
            error_message: isTaskFailed(status) ? getApiSafeMessage(rt.error_message, '任务生成失败') : undefined,
            created_at: rt.created_at ?? Date.now(),
            updated_at: Date.now(),
          });
        } else {
          updates.push({ id: rt.task_id, status, raw_status: rt.task_status, video_url: videoUrl, last_frame_url: rt.last_frame_url, error_message: rt.error_message });
        }
      }
      if (newTasks.length > 0 || updates.length > 0) {
        setTasks(prev => {
          const updMap = new Map(updates.map(u => [u.id, u]));
          const next = prev.map(t => {
            const u = updMap.get(t.id);
            return u ? {
              ...t,
              status: u.status,
              raw_status: u.raw_status ?? t.raw_status,
              video_url: u.video_url ?? t.video_url,
              last_frame_url: u.last_frame_url ?? t.last_frame_url,
              error_message: isTaskFailed(u.status) ? getApiSafeMessage(u.error_message || t.error_message, '任务生成失败') : undefined,
              poll_paused: false,
              updated_at: Date.now(),
            } : t;
          });
          if (newTasks.length > 0) next.unshift(...newTasks);
          saveTasksData(next);
          return next;
        });
      }
    } catch (e) {
      logger.error('TaskContext', '同步云端任务失败', e);
      throw e;
    }
  }, [saveTasksData]);

  const doQueryTask = useCallback(async (task: Task): Promise<void> => {
    const taskPlatform = getTaskPlatform(task);
    if (!taskPlatform?.apiKey) return;
    const api = new VideoApi(taskPlatform);
    let result;
    try {
      result = await api.queryTask(task.id, task.model);
      pollRetryCountRef.current.delete(task.id);
    } catch (e) {
      const count = (pollRetryCountRef.current.get(task.id) ?? 0) + 1;
      const message = formatPollError(e, count);
      pollRetryCountRef.current.set(task.id, count);
      if (count >= MAX_POLL_ERROR_COUNT) {
        updateTask(task.id, { poll_error_count: count, poll_paused: true, last_poll_error: `${message}，${POLL_TIMEOUT_PAUSED_MESSAGE}` });
        pollRetryCountRef.current.delete(task.id);
      } else {
        updateTask(task.id, { poll_error_count: count, last_poll_error: message });
      }
      return;
    }

    const videoUrl = getTaskVideoUrl(result);
    const nextStatus = normalizeTaskStatus(result.task_status);
    updateTask(task.id, {
      status: nextStatus,
      raw_status: result.task_status,
      video_url: videoUrl,
      last_frame_url: result.last_frame_url,
      enhanced_prompt: result.enhanced_prompt,
      error_message: isTaskFailed(nextStatus) ? getApiSafeMessage(result.error_message, '任务生成失败') : undefined,
      updated_at: Date.now(),
      poll_count: (task.poll_count ?? 0) + 1,
      poll_error_count: 0,
      poll_paused: false,
      last_poll_error: undefined,
    });

    if (isTaskSucceeded(nextStatus) && videoUrl && task.auto_download && !task.downloaded) {
      try {
        await downloadTaskVideo(task, videoUrl, task.download_path);
      } catch (e) {
        logger.error('TaskContext', '自动下载失败', e);
      }
    }
  }, [getTaskPlatform, updateTask, downloadTaskVideo]);

  const refreshTask = useCallback(async (taskId: string): Promise<void> => {
    const task = tasksRef.current.find(t => t.id === taskId);
    if (!task) return;
    try { await doQueryTask(task); } catch (e) { logger.error('TaskContext', '刷新任务失败', e); }
  }, [doQueryTask]);

  const retryTask = useCallback(async (taskId: string): Promise<void> => {
    const task = tasksRef.current.find(t => t.id === taskId);
    if (!task) throw new Error('任务不存在');
    const taskPlatform = getTaskPlatform(task);
    if (!taskPlatform?.apiKey) throw new Error('平台未配置 API Key，无法重试');
    const savedParams = (task.saved_params ?? {}) as Record<string, unknown>;
    const request: VideoGenerationRequest = { model: task.model, prompt: task.prompt, image: task.image_urls ?? task.image_url, image_tail: task.image_tail_url, async: true, ...savedParams };

    const recordRetryFailure = (message: string) => {
      setTasks(prev => {
        const next = prev.map((t): Task => {
          if (t.id !== taskId) return t;
          const oldHistory = t.retry_history ?? [];
          return {
            ...t,
            error_message: `重试提交失败：${message}`,
            updated_at: Date.now(),
            retry_history: [...oldHistory, { time: Date.now(), old_error: getApiSafeMessage(t.error_message, '任务失败'), old_task_id: t.id, new_task_id: '', success: false, error: `提交失败尝试：${message}` }],
          };
        });
        saveTasksData(next);
        return next;
      });
    };

    if (containsLocalOnlyImageValue(savedParams) || containsLocalOnlyImageValue(request.image) || containsLocalOnlyImageValue(request.image_tail) || containsLocalOnlyImageValue(request.images)) {
      recordRetryFailure(LOCAL_ONLY_IMAGE_MESSAGE);
      throw new Error(LOCAL_ONLY_IMAGE_MESSAGE);
    }

    try {
      const api = new VideoApi(taskPlatform);
      const response = await api.generateVideo(request);
      const responseStatus = normalizeTaskStatus(response.task_status);
      setTasks(prev => {
        const next = prev.map(t => {
          if (t.id !== taskId) return t;
          const oldHistory = t.retry_history ?? [];
          return {
            ...t,
            id: response.task_id,
            status: responseStatus,
            raw_status: response.task_status,
            video_url: getTaskVideoUrl(response),
            error_message: undefined,
            enhanced_prompt: response.enhanced_prompt,
            poll_count: 0,
            poll_error_count: 0,
            poll_paused: false,
            last_poll_error: undefined,
            downloaded: false,
            download_status: t.auto_download && t.download_path ? ('waiting' as const) : undefined,
            download_file_path: undefined,
            downloaded_at: undefined,
            download_error: undefined,
            updated_at: Date.now(),
            retry_count: (t.retry_count ?? 0) + 1,
            retry_history: [...oldHistory, { time: Date.now(), old_error: getApiSafeMessage(t.error_message, '任务失败'), old_task_id: t.id, new_task_id: response.task_id, success: isTaskSucceeded(responseStatus), error: isTaskFailed(responseStatus) ? '提交即失败' : undefined }],
          };
        });
        saveTasksData(next);
        return next;
      });
    } catch (e) {
      const message = getApiSafeMessage(e, '未知错误');
      recordRetryFailure(message);
      throw e;
    }
  }, [getTaskPlatform, saveTasksData]);

  const pollRunningTasks = useCallback(async () => {
    const active = tasksRef.current.filter(t => isTaskActive(t.status) && !t.poll_paused);
    if (active.length === 0) return;
    if (!runtimePlatformsRef.current.some(p => p.apiKey)) return;
    await Promise.all(active.map(async task => {
      if (pollingTaskIds.current.has(task.id)) return;
      const pollCount = task.poll_count ?? 0;
      if (pollCount >= POLL_TIMEOUT) {
        updateTask(task.id, createPollTimeoutPausePatch(task));
        return;
      }
      pollingTaskIds.current.add(task.id);
      try { await doQueryTask(task); } catch (e) { logger.error('TaskContext', '轮询任务失败', e); } finally { pollingTaskIds.current.delete(task.id); }
    }));
  }, [doQueryTask, updateTask]);

  useEffect(() => {
    const loaded = loadTasks();
    if (loaded.some(t => isTaskActive(t.status) && !t.poll_paused)) setTimeout(() => pollRunningTasks(), 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => pollRunningTasks(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [pollRunningTasks]);

  useEffect(() => {
    if (!window.electronAPI) return;
    const pending = tasks.filter(t => isTaskSucceeded(t.status) && t.auto_download && !t.downloaded && t.video_url && t.download_path && t.download_status !== 'downloading' && !triggeredRef.current.has(t.id));
    pending.forEach(async task => {
      triggeredRef.current.add(task.id);
      try {
        await downloadTaskVideo(task, task.video_url!, task.download_path);
      } catch (e) {
        logger.error('TaskContext', '补充下载失败', e);
        triggeredRef.current.delete(task.id);
      }
    });
  }, [tasks, downloadTaskVideo]);

  const runningCount = useMemo(() => createTaskStats(tasks).running, [tasks]);

  const requestReuseTask = useCallback((taskId: string) => {
    const task = tasksRef.current.find(t => t.id === taskId);
    if (!task) return;
    const targetMode = getReuseTargetMode(task);
    const targetParams = normalizeReuseParamsForTargetMode(task, targetMode);
    if (task.platformId && task.platformId !== activePlatformRef.current?.id) setActivePlatformId(task.platformId);
    setReuseTaskData({ platformId: task.platformId ?? activePlatformRef.current?.id ?? '', model: task.model, mode: targetMode, prompt: task.prompt, paramValues: targetParams });
  }, [setActivePlatformId]);

  const clearReuseTaskData = useCallback(() => setReuseTaskData(null), []);

  const contextValue = useMemo<TaskContextType>(() => ({
    tasks,
    addTask,
    updateTask,
    removeTask,
    clearTasks,
    loadTasks,
    saveTasks,
    pollRunningTasks,
    cancelTask,
    refreshTask,
    fetchRemoteTasks,
    runningCount,
    retryTask,
    reuseTaskData,
    requestReuseTask,
    clearReuseTaskData,
  }), [tasks, addTask, updateTask, removeTask, clearTasks, loadTasks, saveTasks, pollRunningTasks, cancelTask, refreshTask, fetchRemoteTasks, runningCount, retryTask, reuseTaskData, requestReuseTask, clearReuseTaskData]);

  return <TaskContext.Provider value={contextValue}>{children}</TaskContext.Provider>;
};
