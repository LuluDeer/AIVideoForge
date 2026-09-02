import { useCallback, useRef, useState } from 'react';
import type { AppConfig, GenerationMode, ParamDef, RuntimePlatform, VideoGenerationRequest } from '../../types';
import type { ModelDef } from '../../types';
import VideoApi from '../../services/api';
import { getApiSafeMessage } from '../../services/api/errorNormalizer';
import { formatErrorWithAdvice, getTaskVideoUrl, normalizeTaskStatus } from '../../context/taskUtils';
import { isRetryableNetworkError } from '../../context/offlineQueueUtils';
import { logger } from '../../utils/logger';
import type { OfflineQueueItem } from '../../context/offlineQueueUtils';
import type { Task } from '../../types';
import { validateGenerationInput } from './validation';

interface UseBatchSubmitOptions {
  activePlatform: RuntimePlatform;
  selectedModelId: string;
  selectedModel: ModelDef | null;
  supportedModels: ModelDef[];
  mode: GenerationMode;
  generationCount: number;
  promptList: string[];
  imageParams: { def: ParamDef }[];
  mediaParams: { def: ParamDef }[];
  paramValues: Record<string, unknown>;
  buildRequest: () => VideoGenerationRequest;
  appConfig: AppConfig;
  addTask: (task: Omit<Task, 'created_at' | 'updated_at'>) => Task;
  enqueueOfflineTask: (item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount' | 'lastError' | 'lastAttemptAt'>) => OfflineQueueItem;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

/**
 * 批量提交：逐 Prompt × 数量提交任务；网络类异常转入离线队列；支持中途停止继续提交。
 */
export function useBatchSubmit(options: UseBatchSubmitOptions) {
  const {
    activePlatform, selectedModelId, selectedModel, supportedModels, mode, generationCount,
    promptList, imageParams, mediaParams, paramValues, buildRequest, appConfig,
    addTask, enqueueOfflineTask, onError, onSuccess,
  } = options;

  const [isGenerating, setIsGenerating] = useState(false);
  const [submitProgress, setSubmitProgress] = useState('');
  const stopGenerateRef = useRef(false);

  const handleStopGenerate = useCallback(() => {
    stopGenerateRef.current = true;
    onSuccess('正在停止继续提交，已提交的任务会保留在任务列表中');
  }, [onSuccess]);

  const handleGenerate = useCallback(async () => {
    stopGenerateRef.current = false;
    const validPrompts = promptList.filter(p => p.trim());
    const totalSubmitCount = validPrompts.length * generationCount;
    const validationError = validateGenerationInput({
      activePlatform,
      selectedModelId,
      selectedModel,
      supportedModels,
      mode,
      validPrompts,
      generationCount,
      imageParams,
      mediaParams,
      paramValues,
    });
    if (validationError) {
      onError(validationError);
      return;
    }

    setIsGenerating(true);
    onError('');
    onSuccess('');
    setSubmitProgress(`正在提交 0/${totalSubmitCount}`);
    const api = new VideoApi(activePlatform);
    let succeedCount = 0;
    let submittedCount = 0;
    let queuedCount = 0;
    const lastErrors: string[] = [];

    for (const prompt of validPrompts) {
      for (let i = 0; i < generationCount; i++) {
        if (stopGenerateRef.current) break;
        submittedCount++;
        setSubmitProgress(`正在提交 ${submittedCount}/${totalSubmitCount}`);
        const request = { ...buildRequest(), prompt: prompt.trim() };
        try {
          const response = await api.generateVideo(request);
          // 保存完整参数快照（排除 prompt，单独存）
          const paramsSnapshot: Record<string, unknown> = { ...request };
          delete paramsSnapshot.prompt;
          addTask({
            id: response.task_id,
            platformId: activePlatform?.id,
            prompt: prompt.trim(),
            model: selectedModelId,
            mode,
            count: generationCount,
            image_url: Array.isArray(request.image) ? request.image[0] : (typeof request.image === 'string' ? request.image : undefined),
            image_tail_url: request.image_tail,
            image_urls: Array.isArray(request.image) ? request.image : (Array.isArray(request.images) ? request.images as string[] : undefined),
            video_urls: Array.isArray(request.video) ? request.video as string[] : (typeof request.video === 'string' ? [request.video] : undefined),
            audio_urls: Array.isArray(request.audio) ? request.audio as string[] : (typeof request.audio === 'string' ? [request.audio] : undefined),
            status: normalizeTaskStatus(response.task_status),
            raw_status: response.task_status,
            video_url: getTaskVideoUrl(response, activePlatform),
            auto_download: Boolean(appConfig.autoDownload && appConfig.downloadPath),
            downloaded: false,
            download_status: appConfig.autoDownload && appConfig.downloadPath ? 'waiting' : undefined,
            download_path: appConfig.autoDownload && appConfig.downloadPath ? appConfig.downloadPath : undefined,
            saved_params: paramsSnapshot,
          });
          succeedCount++;
        } catch (err) {
          const msg = getApiSafeMessage(err, '视频生成请求失败');
          // 网络类异常（断网/连接超时等）不算最终失败，转入离线队列，网络恢复后自动重新提交
          if (isRetryableNetworkError(err, msg)) {
            enqueueOfflineTask({
              platformId: activePlatform?.id,
              model: selectedModelId,
              mode,
              prompt: prompt.trim(),
              request,
              count: generationCount,
              autoDownload: appConfig.autoDownload,
              downloadPath: appConfig.downloadPath,
            });
            queuedCount++;
          } else {
            lastErrors.push(formatErrorWithAdvice(msg, '检查参数后重试'));
          }
          logger.error('GeneratePage', '提交任务失败', err);
        }
      }
    }

    setIsGenerating(false);
    setSubmitProgress('');
    if (succeedCount > 0 || queuedCount > 0) {
      const parts: string[] = [];
      if (succeedCount > 0) parts.push(`成功提交 ${succeedCount} 个`);
      if (queuedCount > 0) parts.push(`${queuedCount} 个因网络异常已加入离线队列，网络恢复后自动提交`);
      onSuccess(`${stopGenerateRef.current ? '已停止继续提交。' : ''}${parts.join('，')}`);
      setTimeout(() => onSuccess(''), queuedCount > 0 ? 8000 : 5000);
    }
    if (lastErrors.length > 0) {
      const failedCount = lastErrors.length;
      const summary = lastErrors.slice(-3).join('；');
      const stoppedHint = stopGenerateRef.current ? '，剩余任务已停止提交' : '';
      onError(`批量提交完成：成功 ${succeedCount} 个，失败 ${failedCount} 个${stoppedHint}。最近失败：${summary}${failedCount > 3 ? '；更多失败请检查参数或稍后重试' : ''}`);
    }
  }, [
    activePlatform, addTask, appConfig, buildRequest, enqueueOfflineTask, generationCount,
    imageParams, mediaParams, mode, onError, onSuccess, paramValues, promptList,
    selectedModel, selectedModelId, supportedModels,
  ]);

  return { isGenerating, submitProgress, handleGenerate, handleStopGenerate };
}
