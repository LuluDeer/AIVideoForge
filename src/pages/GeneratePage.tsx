import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Video, Image, AlertCircle, Loader2, Plus, BookOpen, X, ChevronDown, RotateCcw, Copy, WifiOff, RefreshCw, Trash2 } from 'lucide-react';
import AppSelect from '../components/AppSelect';
import { useConfig } from '../context/useConfig';
import { useTasks } from '../context/useTasks';
import { useOfflineQueue } from '../context/useOfflineQueue';
import type { GenerationMode, VideoGenerationRequest, ParamDef, ParamOption } from '../types';
import VideoApi from '../services/api';
import { buildRequestPayload } from '../services/api/payloadBuilders';
import ImageUploader from '../services/imageUpload';
import GeekaiAssetService, { type GeekaiAssetKind } from '../services/geekaiAssets';
import { getApiSafeMessage } from '../services/api/errorNormalizer';
import { resolveParam } from '../services/modelConfigManager';
import { addCustomPrompt, deleteCustomPrompt, loadCustomPrompts, updateCustomPrompt } from '../services/promptLibrary';
import type { PromptItem } from '../services/promptLibrary';
import { logger } from '../utils/logger';
import { containsLocalOnlyImageValue, formatErrorWithAdvice, getTaskVideoUrl, normalizeTaskStatus } from '../context/taskUtils';
import { isNetworkErrorMessage } from '../context/offlineQueueUtils';
import { validateGenerationInput } from './generate/validation';
import { MAX_IMAGE_URL_LENGTH, isAssetUrl, normalizeImageUrl, normalizeMediaUrl, validateImageFile, validateMediaFile } from './generate/imageInput';

type ResolvedParam = ReturnType<typeof resolveParam>;
type PendingReuseData = { platformId: string; model: string; mode: GenerationMode; prompt: string; paramValues: Record<string, unknown> };

const normalizeModelId = (modelId: string) => modelId.toLowerCase().replace(/[._]/g, '-');

const modelIdsMatch = (left: string, right: string) => normalizeModelId(left) === normalizeModelId(right);

const MODES: { value: GenerationMode; label: string; icon: React.ReactNode }[] = [
  { value: 'text', label: '文生视频', icon: <Video className="w-4 h-4" /> },
  { value: 'image', label: '图生视频', icon: <Image className="w-4 h-4" /> },
  { value: 'imageTail', label: '首尾帧', icon: <Image className="w-4 h-4" /> },
  { value: 'multiImage', label: '多图生成', icon: <Image className="w-4 h-4" /> },
  { value: 'multiModal', label: '多模态参考', icon: <Video className="w-4 h-4" /> },
];

const getReusableParamValue = (key: string, values: Record<string, unknown>): unknown => {
  if (values[key] !== undefined) return values[key];
  if (key === 'image') {
    const imageList = values.images;
    if (Array.isArray(imageList)) return imageList.find(item => typeof item === 'string' && item.trim());
    return values.image_url ?? values.input_image ?? values.inputImage;
  }
  if (key === 'images') {
    if (Array.isArray(values.images)) return values.images;
    if (typeof values.image === 'string' && values.image.trim()) return [values.image];
  }
  if (key === 'aspect_ratio') return values.ratio ?? values.aspectRatio;
  if (key === 'duration') return values.seconds ?? values.videoDuration;
  if (key === 'resolution') return values.quality;
  if (key === 'generate_audio') return values.withAudio ?? values.audioEnabled;
  return undefined;
};

interface GeneratePageProps { onNavigateToTasks?: () => void; onNavigateToConfig?: () => void }
const GeneratePage: React.FC<GeneratePageProps> = ({ onNavigateToTasks, onNavigateToConfig }) => {
  const { activePlatform, runtimePlatforms, setActivePlatformId, appConfig } = useConfig();
  const activeImageUploadMode = activePlatform?.imageUploadMode ?? appConfig.imageUploadMode ?? 'geekai';
  const { addTask, reuseTaskData, clearReuseTaskData } = useTasks();
  const {
    queue: offlineQueue,
    isOnline,
    isProcessing: offlineProcessing,
    enqueueOfflineTask,
    removeOfflineTask,
    retryOfflineTask,
  } = useOfflineQueue();
  const [offlineActionError, setOfflineActionError] = useState<string>('');

  const [mode, setMode] = useState<GenerationMode>('text');
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [assetConvertingKey, setAssetConvertingKey] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [promptList, setPromptList] = useState<string[]>(['']);
  const [generationCount, setGenerationCount] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [copiedAssetUrl, setCopiedAssetUrl] = useState<string | null>(null);
  const [submitProgress, setSubmitProgress] = useState<string>('');
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [showParams, setShowParams] = useState(true);
  const [showRequestPreview, setShowRequestPreview] = useState(false);
  const [promptLibraryCategory, setPromptLibraryCategory] = useState<string>('全部');
  const [promptSearch, setPromptSearch] = useState('');
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editPromptCategory, setEditPromptCategory] = useState('');
  const [editPromptText, setEditPromptText] = useState('');
  const [promptLibrary, setPromptLibrary] = useState<PromptItem[]>(() => loadCustomPrompts());
  const [pendingReuseData, setPendingReuseData] = useState<PendingReuseData | null>(null);
  const stopGenerateRef = useRef(false);
  const promptSectionRef = useRef<HTMLDivElement | null>(null);
  const generationControlColumnRef = useRef<HTMLDivElement | null>(null);
  const [promptLibraryLayout, setPromptLibraryLayout] = useState<{ panelStyle: React.CSSProperties; listMaxHeight: number }>({
    panelStyle: {
      position: 'sticky',
      top: 24,
      width: '100%',
      maxHeight: '78vh',
    },
    listMaxHeight: 320,
  });

  // 参数值 state：key = ParamDef.key, value = 用户当前选的值
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});

  // 切换平台或模式时选择当前模式可用模型；复用参数恢复期间优先保留待回填模型，避免默认值覆盖。
  useEffect(() => {
    if (!activePlatform) return;
    if (pendingReuseData && (!pendingReuseData.platformId || activePlatform.id === pendingReuseData.platformId) && mode === pendingReuseData.mode) {
      const reuseModel = activePlatform.models.find(m => modelIdsMatch(m.id, pendingReuseData.model) && m.modes.includes(mode));
      if (reuseModel) {
        setSelectedModelId(prev => prev === reuseModel.id ? prev : reuseModel.id);
        return;
      }
    }
    const currentModelStillSupported = activePlatform.models.some(m => m.id === selectedModelId && m.modes.includes(mode));
    if (currentModelStillSupported) return;
    const firstModel = activePlatform.models.find(m => m.modes.includes(mode));
    setSelectedModelId(firstModel?.id ?? activePlatform.defaultModel);
  }, [activePlatform, mode, pendingReuseData, selectedModelId]);

  // 当前选中的模型定义
  const selectedModel = useMemo(() => {
    return activePlatform?.models.find(m => m.id === selectedModelId) ?? null;
  }, [activePlatform, selectedModelId]);

  // 当前模式下可用的模型列表
  const supportedModels = useMemo(() => {
    return activePlatform?.models.filter(m => m.modes.includes(mode)) ?? [];
  }, [activePlatform, mode]);

  // 当前模型的参数列表（合并用户覆盖后，模型级覆盖优先于平台级）
  const resolvedParams = useMemo(() => {
    if (!selectedModel) return [];
    return selectedModel.params.map(p => {
      // 模型级 key 为 "modelId__paramKey"，平台级兼容旧 key
      const modelLevelKey = `${selectedModel.id}__${p.key}`;
      const override =
        activePlatform?.paramOverrides?.[modelLevelKey] ??
        activePlatform?.paramOverrides?.[p.key];
      return { def: p, resolved: resolveParam(p, override) };
    });
  }, [selectedModel, activePlatform]);

  // 初始化参数默认值
  useEffect(() => {
    const initial: Record<string, unknown> = {};
    resolvedParams.forEach(({ def, resolved }) => {
      if (!resolved.hidden && resolved.fixedValue === undefined) {
        initial[def.key] = resolved.defaultValue;
      }
    });
    setParamValues(initial);
  }, [resolvedParams]);

  // 收到复用参数时先切换平台/模式/模型，等参数定义刷新后再恢复参数值。
  useEffect(() => {
    if (!reuseTaskData) return;
    if (reuseTaskData.platformId && activePlatform?.id !== reuseTaskData.platformId) return;
    const reuseModel = activePlatform?.models.find(m => modelIdsMatch(m.id, reuseTaskData.model) && m.modes.includes(reuseTaskData.mode));
    setMode(reuseTaskData.mode);
    setSelectedModelId(reuseModel?.id ?? reuseTaskData.model);
    setPromptList([reuseTaskData.prompt || '']);
    setPendingReuseData(reuseTaskData);
    clearReuseTaskData();
  }, [reuseTaskData, activePlatform?.id, clearReuseTaskData]);

  useEffect(() => {
    if (!pendingReuseData) return;
    if (pendingReuseData.platformId && activePlatform?.id !== pendingReuseData.platformId) return;
    if (mode !== pendingReuseData.mode || !modelIdsMatch(selectedModelId, pendingReuseData.model)) return;
    if (!selectedModel || resolvedParams.length === 0) return;

    const restored: Record<string, unknown> = {};
    let skippedLocalOnly = false;
    resolvedParams.forEach(({ def }) => {
      const val = getReusableParamValue(def.key, pendingReuseData.paramValues);
      if (val === undefined || val === null) return;
      if (containsLocalOnlyImageValue(val)) {
        skippedLocalOnly = true;
        return;
      }
      restored[def.key] = val;
    });
    setParamValues(prev => ({ ...prev, ...restored }));
    setPendingReuseData(null);
    setSuccessMessage(skippedLocalOnly
      ? '已载入可复用参数。本地图片未保存，请重新上传或改用公开 URL。'
      : '已载入该任务的参数，可直接生成变体');
    setTimeout(() => setSuccessMessage(''), 6000);
  }, [pendingReuseData, activePlatform?.id, mode, selectedModelId, selectedModel, resolvedParams]);

  // 某参数在当前模式下是否可见（走模型级覆盖优先逻辑）
  const isParamVisible = useCallback((def: ParamDef): boolean => {
    if (!selectedModel) return false;
    const modelLevelKey = `${selectedModel.id}__${def.key}`;
    const override =
      activePlatform?.paramOverrides?.[modelLevelKey] ??
      activePlatform?.paramOverrides?.[def.key];
    const resolved = resolveParam(def, override);
    if (resolved.hidden) return false;
    if (resolved.fixedValue !== undefined) return false;
    if (def.modes && def.modes.length > 0 && !def.modes.includes(mode)) return false;
    return true;
  }, [activePlatform?.paramOverrides, mode, selectedModel]);

  const visibleParams = useMemo(() => {
    return resolvedParams.filter(({ def }) => isParamVisible(def));
  }, [isParamVisible, resolvedParams]);

  const updatePromptLibraryLayout = useCallback(() => {
    if (!showPromptLibrary || typeof window === 'undefined') return;

    const scrollViewportRect = promptSectionRef.current?.closest('.app-main')?.getBoundingClientRect();
    const stickyOffset = 24;
    const viewportTop = scrollViewportRect?.top ?? 0;
    const viewportBottom = scrollViewportRect?.bottom ?? window.innerHeight;
    const availableHeight = viewportBottom - viewportTop - stickyOffset - 16;
    const maxHeight = Math.max(260, Math.min(availableHeight, window.innerHeight * 0.78));
    const listMaxHeight = Math.max(140, maxHeight - 178);

    setPromptLibraryLayout(prev => {
      const current = prev.panelStyle;
      if (
        current.position === 'sticky' &&
        current.top === stickyOffset &&
        current.width === '100%' &&
        current.maxHeight === maxHeight &&
        prev.listMaxHeight === listMaxHeight
      ) {
        return prev;
      }
      return {
        panelStyle: {
          position: 'sticky',
          top: stickyOffset,
          width: '100%',
          maxHeight,
        },
        listMaxHeight,
      };
    });
  }, [showPromptLibrary]);

  useEffect(() => {
    if (!showPromptLibrary) return;

    updatePromptLibraryLayout();
    window.addEventListener('resize', updatePromptLibraryLayout);
    return () => {
      window.removeEventListener('resize', updatePromptLibraryLayout);
    };
  }, [showPromptLibrary, updatePromptLibraryLayout, promptList.length, promptLibrary.length, editingPromptId, promptSearch, promptLibraryCategory]);

  const validPromptCount = useMemo(() => promptList.filter(p => p.trim()).length, [promptList]);
  const totalSubmitCount = validPromptCount * generationCount;
  const hasNoPlatform = !activePlatform;
  const hasApiKey = Boolean(activePlatform?.apiKey);
  const hasModelSelection = selectedModelId.trim().length > 0;
  const noSupportedModelForMode = Boolean(activePlatform && activePlatform.models.length > 0 && supportedModels.length === 0);
  const canGenerate = hasApiKey && hasModelSelection && !noSupportedModelForMode && !isGenerating && totalSubmitCount > 0;
  const supportsGeekaiAsset = Boolean(activePlatform?.apiKey && activePlatform.baseUrl.includes('geekai.co'));

  const isMediaParam = (def: ParamDef) => def.type === 'image' || def.type === 'image-multi' || def.type === 'video' || def.type === 'video-multi' || def.type === 'audio' || def.type === 'audio-multi';
  const imageParams = useMemo(() => visibleParams.filter(({ def }) => def.type === 'image' || def.type === 'image-multi'), [visibleParams]);
  const mediaParams = useMemo(() => visibleParams.filter(({ def }) => isMediaParam(def)), [visibleParams]);
  const selectParams = useMemo(() => visibleParams.filter(({ def }) => (def.type === 'string' || def.type === 'number') && !isMediaParam(def)), [visibleParams]);
  const boolParams = useMemo(() => visibleParams.filter(({ def }) => def.type === 'boolean'), [visibleParams]);

  const handleParamChange = (key: string, value: unknown) => {
    setParamValues(prev => ({ ...prev, [key]: value }));
  };

  const showUrlSuffixHint = () => {
    setSuccessMessage('已添加图片 URL。未识别常见图片后缀，如签名 URL 无法生成，请确认该地址可公开访问。');
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const handleStopGenerate = () => {
    stopGenerateRef.current = true;
    setSuccessMessage('正在停止继续提交，已提交的任务会保留在任务列表中');
  };

  const handleModeChange = (newMode: GenerationMode) => {
    setMode(newMode);
    const defaultModel = activePlatform?.models.find(m => m.id === activePlatform.defaultModel && m.modes.includes(newMode));
    const first = activePlatform?.models.find(m => m.modes.includes(newMode));
    if (defaultModel || first) setSelectedModelId((defaultModel ?? first)?.id ?? '');
  };

  const promptCategories = ['全部', ...Array.from(new Set(promptLibrary.map(p => p.category)))];
  const filteredPrompts = useMemo(() => {
    let list = promptLibraryCategory === '全部' ? promptLibrary : promptLibrary.filter(p => p.category === promptLibraryCategory);
    if (promptSearch.trim()) {
      const q = promptSearch.toLowerCase();
      list = list.filter(p => p.text.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    return list;
  }, [promptLibraryCategory, promptSearch, promptLibrary]);

  const handleInsertPrompt = (text: string) => {
    const emptyIndex = promptList.findIndex(p => p.trim() === '');
    if (emptyIndex !== -1) {
      const newList = [...promptList];
      newList[emptyIndex] = text;
      setPromptList(newList);
      return;
    }
    setPromptList(prev => [...prev, text]);
  };

  const handleRemovePromptInput = (promptIndex: number) => {
    setPromptList(prev => {
      if (prev.length <= 1) return [''];
      return prev.filter((_, index) => index !== promptIndex);
    });
  };

  const handleSaveCurrentPrompt = (promptIndex: number = 0) => {
    const currentPrompt = promptList[promptIndex]?.trim() ?? '';
    if (!currentPrompt) {
      setError(`请先在 Prompt ${promptIndex + 1} 输入框填写内容，再保存到个人词库。`);
      return;
    }
    addCustomPrompt('我的提示词', currentPrompt);
    setPromptLibrary(loadCustomPrompts());
    setPromptLibraryCategory('全部');
    setShowPromptLibrary(true);
    setSuccessMessage(`已保存 Prompt ${promptIndex + 1} 到个人词库，可在词库中编辑分类`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };
  const handleStartEdit = (p: PromptItem) => {
    setEditingPromptId(p.id);
    setEditPromptCategory(p.category);
    setEditPromptText(p.text);
  };
  const handleSaveEdit = () => {
    if (editingPromptId) {
      updateCustomPrompt(editingPromptId, { category: editPromptCategory, text: editPromptText });
      setPromptLibrary(loadCustomPrompts());
    }
    setEditingPromptId(null);
  };
  const handleDeletePrompt = (id: string) => {
    deleteCustomPrompt(id);
    setPromptLibrary(loadCustomPrompts());
  };

  const buildRequest = (): VideoGenerationRequest => {
    const req: VideoGenerationRequest = {
      model: selectedModelId,
      prompt: '',
      async: true,
    };

    // 写入用户填的参数值
    visibleParams.forEach(({ def }) => {
      const val = paramValues[def.key];
      if (val !== undefined && val !== null && val !== '') {
        if (def.key === 'real_person_mode') {
          req.extra_body = { ...(req.extra_body ?? {}), real_person_mode: Boolean(val) };
        } else {
          req[def.key] = val;
        }
      }
    });

    // 写入当前模式生效的固定值参数，避免跨模式隐藏参数污染请求。
    resolvedParams.forEach(({ def, resolved }) => {
      const matchesMode = !def.modes || def.modes.length === 0 || def.modes.includes(mode);
      if (matchesMode && !resolved.hidden && resolved.fixedValue !== undefined) {
        req[def.key] = resolved.fixedValue;
      }
    });

    return req;
  };

  const requestPreviewJson = useMemo(() => {
    if (!activePlatform) {
      return JSON.stringify({ message: '请先配置并选择平台' }, null, 2);
    }

    const previewPrompt = promptList.find(p => p.trim())?.trim() ?? '';
    const request = { ...buildRequest(), prompt: previewPrompt };
    const payload = buildRequestPayload(activePlatform, request);
    const body = payload instanceof FormData
      ? Object.fromEntries(Array.from(payload.entries()).map(([key, value]) => [key, value instanceof File ? value.name : value]))
      : payload;

    return JSON.stringify(body, null, 2);
  }, [activePlatform, promptList, selectedModelId, visibleParams, resolvedParams, paramValues]);

  const handleGenerate = async () => {
    stopGenerateRef.current = false;
    const validPrompts = promptList.filter(p => p.trim());
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
      setError(validationError);
      return;
    }

    setIsGenerating(true);
    setError('');
    setSuccessMessage('');
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
            image_urls: Array.isArray(request.image) ? request.image : (Array.isArray(request.images) ? request.images : undefined),
            video_urls: Array.isArray(request.video) ? request.video : (typeof request.video === 'string' ? [request.video] : undefined),
            audio_urls: Array.isArray(request.audio) ? request.audio : (typeof request.audio === 'string' ? [request.audio] : undefined),
            status: normalizeTaskStatus(response.task_status),
            raw_status: response.task_status,
            video_url: getTaskVideoUrl(response),
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
          if (isNetworkErrorMessage(msg)) {
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
      setSuccessMessage(`${stopGenerateRef.current ? '已停止继续提交。' : ''}${parts.join('，')}`);
      setTimeout(() => setSuccessMessage(''), queuedCount > 0 ? 8000 : 5000);
    }
    if (lastErrors.length > 0) {
      const failedCount = lastErrors.length;
      const summary = lastErrors.slice(-3).join('；');
      const stoppedHint = stopGenerateRef.current ? '，剩余任务已停止提交' : '';
      setError(`批量提交完成：成功 ${succeedCount} 个，失败 ${failedCount} 个${stoppedHint}。最近失败：${summary}${failedCount > 3 ? '；更多失败请检查参数或稍后重试' : ''}`);
    }
  };

  // ─── 渲染图片上传控件 ──────────────────────────────────────
  // ImageUploader 是 class（非 React 组件），这里包成上传 handler
  const uploadImage = async (file: File, _paramKey?: string): Promise<string | null> => {
    const fileError = validateImageFile(file);
    if (fileError) {
      setError(fileError);
      return null;
    }
    const mode = activeImageUploadMode;
    if (mode === 'base64') {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve((e.target?.result as string) ?? null);
        reader.readAsDataURL(file);
      });
    }
    if (!appConfig.uploadCk.trim()) {
      setError('当前平台图片上传方式为 GeekAI CDN，但还没有填写上传 Cookie（ck）。为避免调用存储接口，请到配置页填写 ck，或将当前平台的图传方式改为 Base64 / 仅 URL。');
      return null;
    }
    if (_paramKey) setUploadingKey(_paramKey);
    const uploader = new ImageUploader(
      appConfig.uploadCk,
      activePlatform?.imageUploadConfig ?? {},
    );
    try {
      const result = await uploader.uploadImage(file);
      return result?.url ?? null;
    } catch (err) {
      logger.warn('GeneratePage', '图片上传失败', err);
      const detail = getApiSafeMessage(err, '服务未返回可用图片地址');
      setError(`图片上传失败：${formatErrorWithAdvice(detail, '重新上传图片')}。也可粘贴可公开访问的图片 URL。`);
      return null;
    } finally {
      if (_paramKey) setUploadingKey(null);
    }
  };

  const getParamLabel = (key: string) => visibleParams.find(({ def }) => def.key === key)?.def.label ?? key;

  const shortenAssetUrl = (assetUrl: string) => assetUrl.length > 30 ? `${assetUrl.slice(0, 18)}...${assetUrl.slice(-8)}` : assetUrl;

  const copyAssetUrl = async (assetUrl: string) => {
    try {
      if (!navigator.clipboard) throw new Error('当前环境不支持剪贴板写入');
      await navigator.clipboard.writeText(assetUrl);
      setCopiedAssetUrl(assetUrl);
      setSuccessMessage(`已复制素材链接：${assetUrl}`);
      setTimeout(() => setCopiedAssetUrl(null), 2000);
    } catch (err) {
      logger.warn('GeneratePage', '复制素材链接失败', err);
      setError('复制失败，请手动选中 asset:// 链接复制。');
    }
  };

  const getCachedGeekaiAssetByAssetUrl = (assetUrl: string, kind?: GeekaiAssetKind) => {
    if (!activePlatform || !supportsGeekaiAsset) return null;
    return new GeekaiAssetService(activePlatform).getCachedAssetByAssetUrl(assetUrl, kind);
  };

  const renderAssetInfo = (assetUrl: string) => (
    <div className="mt-1 flex max-w-full items-center gap-1 rounded bg-purple-50 px-1.5 py-1 text-[11px] text-purple-700" title={assetUrl}>
      <span className="min-w-0 flex-1 truncate font-mono">{shortenAssetUrl(assetUrl)}</span>
      <button
        type="button"
        onClick={() => copyAssetUrl(assetUrl)}
        className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 font-medium hover:bg-purple-100"
      >
        <Copy className="h-3 w-3" />
        {copiedAssetUrl === assetUrl ? '已复制' : '复制'}
      </button>
    </div>
  );

  const handleConvertToGeekaiAsset = async (
    paramKey: string,
    currentUrl: string,
    kind: GeekaiAssetKind,
    applyAssetUrl: (assetUrl: string) => void,
    itemKey = paramKey,
  ) => {
    if (!activePlatform) {
      setError('请先选择极客平台并配置 API Key。');
      return;
    }
    if (!supportsGeekaiAsset) {
      setError('当前平台不支持极客自定义素材接口，请切换到 GeekAI / 极客智坊平台。');
      return;
    }
    if (isAssetUrl(currentUrl)) {
      setSuccessMessage('当前素材已经是 asset:// 格式，无需重复转换。');
      return;
    }
    if (currentUrl.startsWith('data:')) {
      setError('极客素材接口需要可公开访问的图片/视频 URL。请先上传图片获取 URL，或粘贴公开视频 URL 后再转素材。');
      return;
    }

    setAssetConvertingKey(itemKey);
    setError('');
    try {
      const service = new GeekaiAssetService(activePlatform);
      const cachedAsset = service.getCachedAsset(currentUrl, kind);
      const assetUrl = cachedAsset?.assetUrl ?? await service.createAssetFromUrl(currentUrl, kind, `${getParamLabel(paramKey)}-${Date.now()}`);
      applyAssetUrl(assetUrl);
      setSuccessMessage(`${cachedAsset ? '已复用本地素材缓存' : '已转换为极客自定义素材'}：${assetUrl}`);
      setTimeout(() => setSuccessMessage(''), 6000);
    } catch (err) {
      logger.warn('GeneratePage', '转极客素材失败', err);
      const detail = getApiSafeMessage(err, '素材接口未返回可用素材 ID');
      setError(`转极客素材失败：${formatErrorWithAdvice(detail, '确认 URL 可公开访问，或稍后重试')}`);
    } finally {
      setAssetConvertingKey(null);
    }
  };

  const getGenerateBlockerHint = (): string | null => {
    if (hasNoPlatform) return '请先在配置页新增或启用平台，再填写 API Key。';
    if (!hasApiKey) return '当前平台缺少 API Key，请先到配置页填写后再生成。';
    if (!hasModelSelection) return '请选择模型。若平台刚发布新模型，可到配置页的「模型管理」手动新增。';
    if (noSupportedModelForMode) return '当前模式没有可用模型，请切换模式，或到配置页为当前平台新增支持该模式的模型。';
    if (totalSubmitCount === 0) return '请输入至少一个 Prompt；图片模式还需上传或粘贴公开图片 URL。';
    return null;
  };

  const generateBlockerHint = getGenerateBlockerHint();

  const uploadMediaFile = async (file: File, kind: 'video' | 'audio', paramKey: string): Promise<string | null> => {
    const fileError = validateMediaFile(file, kind);
    if (fileError) {
      setError(fileError);
      return null;
    }

    if (!appConfig.uploadCk.trim()) {
      setError('当前平台需要上传视频/音频到 GeekAI CDN，但还没有填写上传 Cookie（ck）。已停止上传且不会调用存储接口；请到配置页填写 ck，或直接粘贴公开 URL。');
      return null;
    }

    const itemKey = `${paramKey}:upload`;
    setUploadingKey(itemKey);
    setError('');
    const uploader = new ImageUploader(
      appConfig.uploadCk,
      activePlatform?.imageUploadConfig ?? {},
    );

    try {
      const result = await uploader.uploadFile(file, kind);
      return result?.url ?? null;
    } catch (err) {
      logger.warn('GeneratePage', `${kind === 'video' ? '视频' : '音频'}上传失败`, err);
      const detail = getApiSafeMessage(err, '服务未返回可用附件地址');
      setError(`${kind === 'video' ? '视频' : '音频'}上传失败：${formatErrorWithAdvice(detail, '重新上传文件，或粘贴可公开访问的 URL')}`);
      return null;
    } finally {
      setUploadingKey(null);
    }
  };

  const renderImagePreview = (url: string, className: string) => {
    if (isAssetUrl(url)) {
      const cachedAsset = getCachedGeekaiAssetByAssetUrl(url, 'image');
      if (cachedAsset?.sourceUrl && !cachedAsset.sourceUrl.startsWith('data:')) {
        return (
          <div className="relative" title={`${url}\n来源：${cachedAsset.sourceUrl}`}>
            <img src={cachedAsset.sourceUrl} className={className} alt="" />
            <span className="absolute left-1 top-1 rounded bg-purple-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm">
              已转素材
            </span>
          </div>
        );
      }
      return (
        <div className={`${className} flex items-center justify-center rounded border bg-purple-50 px-2 text-center text-[11px] font-medium text-purple-700`} title={url}>
          已转素材
        </div>
      );
    }
    return <img src={url} className={className} alt="" />;
  };

  const renderImageParam = (def: ParamDef) => {
    const isUploading = uploadingKey === def.key;
    const uploadMode = activeImageUploadMode;

    if (def.type === 'image-multi') {
      const urls: string[] = (paramValues[def.key] as string[]) ?? [];
      const limits = def.imageLimits;
      return (
        <div key={def.key} className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-gray-700">{def.label}</label>
            {supportsGeekaiAsset && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">可转极客素材</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {urls.map((url, idx) => (
              <div key={idx} className="relative w-24 rounded border bg-white p-1 shadow-sm">
                {renderImagePreview(url, 'h-20 w-full object-cover rounded')}
                <button
                  onClick={() => handleParamChange(def.key, urls.filter((_, i) => i !== idx))}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
                {supportsGeekaiAsset && !isAssetUrl(url) && !url.startsWith('data:') && (
                  <button
                    type="button"
                    onClick={() => handleConvertToGeekaiAsset(def.key, url, 'image', (assetUrl: string) => handleParamChange(def.key, urls.map((item, i) => i === idx ? assetUrl : item)), `${def.key}:${idx}`)}
                    disabled={assetConvertingKey === `${def.key}:${idx}`}
                    className="mt-1 flex w-full items-center justify-center gap-1 rounded bg-purple-600 px-1.5 py-1 text-[11px] font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                    title="调用极客自定义素材接口，将该图片 URL 转为 asset://素材ID"
                  >
                    {assetConvertingKey === `${def.key}:${idx}` ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    转素材
                  </button>
                )}
              </div>
            ))}
            {uploadMode !== 'url' && (!limits?.max || urls.length < limits.max) && (
              <label className={`w-20 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer ${
                isUploading ? 'border-blue-300 bg-blue-50 text-blue-400' : 'border-gray-300 hover:border-blue-400 text-gray-400'
              }`}>
                {isUploading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><Plus className="w-5 h-5" /><span className="text-xs mt-1">上传</span></>}
                <input type="file" accept="image/*" className="hidden" disabled={isUploading} onChange={async e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = await uploadImage(f, def.key);
                  if (url) handleParamChange(def.key, [...urls, url]);
                  e.target.value = '';
                }} />
              </label>
            )}
          </div>

          <p className="text-xs text-gray-400">
            支持上传或粘贴 http(s) 图片 URL / asset://素材ID 后按 Enter 添加；CDN/OSS/COS 签名 URL 无需图片后缀。
            {limits?.max ? ` 最多 ${limits.max} 张。` : ''}
          </p>
          <input
            type="text"
            placeholder={`粘贴图片 URL 或 asset://素材ID 后按回车添加${limits?.max ? `（最多${limits.max}张）` : ''}...`}
            className="w-full min-h-10 rounded-lg border border-gray-200 px-3 py-2 text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-blue-100"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const input = e.target as HTMLInputElement;
                const val = normalizeImageUrl(input.value);
                if (!val) {
                  setError(`请输入非空的 http(s) 图片 URL，长度不超过 ${MAX_IMAGE_URL_LENGTH} 个字符`);
                  return;
                }
                if (!limits?.max || urls.length < limits.max) {
                  handleParamChange(def.key, [...urls, val.url]);
                  if (!val.hasCommonImageExt) showUrlSuffixHint();
                  input.value = '';
                }
              }
            }}
          />
          {isUploading && <p className="text-xs text-blue-500">上传中...</p>}
        </div>
      );
    }

    const url = paramValues[def.key] as string | undefined;
    return (
      <div key={def.key} className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700">{def.label}</label>
          {supportsGeekaiAsset && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">可转极客素材</span>}
        </div>
        {url ? (
          <div className="inline-flex flex-col gap-1 rounded border bg-white p-1 shadow-sm">
            <div className="relative">
              {renderImagePreview(url, 'w-32 h-20 object-cover rounded')}
              <button
                onClick={() => handleParamChange(def.key, undefined)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {isAssetUrl(url) && renderAssetInfo(url)}
            {supportsGeekaiAsset && !isAssetUrl(url) && !url.startsWith('data:') && (
              <button
                type="button"
                onClick={() => handleConvertToGeekaiAsset(def.key, url, 'image', (assetUrl: string) => handleParamChange(def.key, assetUrl))}
                disabled={assetConvertingKey === def.key}
                className="inline-flex min-h-7 items-center justify-center gap-1 rounded bg-purple-600 px-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                title="调用极客自定义素材接口，将该图片 URL 转为 asset://素材ID"
              >
                {assetConvertingKey === def.key ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                转极客素材
              </button>
            )}
          </div>
        ) : uploadMode !== 'url' ? (
          <label className={`w-32 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer ${
            isUploading ? 'border-blue-300 bg-blue-50 text-blue-400' : 'border-gray-300 hover:border-blue-400 text-gray-400'
          }`}>
            {isUploading
              ? <><Loader2 className="w-5 h-5 animate-spin" /><span className="text-xs mt-1">上传中</span></>
              : <><Plus className="w-6 h-6" /><span className="text-xs mt-1">上传图片</span></>}
            <input type="file" accept="image/*" className="hidden" disabled={isUploading} onChange={async e => {
              const f = e.target.files?.[0];
              if (!f) return;
              const u = await uploadImage(f, def.key);
              if (u) handleParamChange(def.key, u);
              e.target.value = '';
            }} />
          </label>
        ) : null}
        <input type="text" placeholder="粘贴图片 URL 或 asset://素材ID 后按回车..."
          className="w-full min-h-10 rounded-lg border border-gray-200 px-3 py-2 text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-blue-100"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const input = e.target as HTMLInputElement;
              const val = normalizeImageUrl(input.value);
              if (!val) {
                setError(`请输入非空的 http(s) 图片 URL，长度不超过 ${MAX_IMAGE_URL_LENGTH} 个字符`);
                return;
              }
              handleParamChange(def.key, val.url);
              if (!val.hasCommonImageExt) showUrlSuffixHint();
              input.value = '';
            }
          }} />
        {isUploading && <p className="text-xs text-blue-500">上传中...</p>}
      </div>
    );
  };

  const renderVideoAudioParam = (def: ParamDef) => {
    const isMulti = def.type === 'video-multi' || def.type === 'audio-multi';
    const mediaKind = def.type === 'video' || def.type === 'video-multi' ? 'video' : 'audio';
    const accept = mediaKind === 'video' ? 'video/*' : 'audio/*';
    const mediaName = mediaKind === 'video' ? '视频' : '音频';
    const limits = def.imageLimits;
    const values = isMulti
      ? ((paramValues[def.key] as string[] | undefined) ?? [])
      : (typeof paramValues[def.key] === 'string' && paramValues[def.key] ? [paramValues[def.key] as string] : []);
    const updateValues = (next: string[]) => handleParamChange(def.key, isMulti ? next : next[0]);
    const isUploadingMedia = uploadingKey === `${def.key}:upload`;

    return (
      <div key={def.key} className="space-y-2 min-w-64 flex-1">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700">{def.label}</label>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">需 ck 上传获取URL</span>
          {mediaKind === 'video' && supportsGeekaiAsset && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">可转极客素材</span>}
        </div>
        {values.length > 0 && (
          <div className="space-y-2">
            {values.map((url, idx) => (
              <div key={`${url}-${idx}`} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <span className="min-w-0 flex-1 truncate" title={url}>{url.startsWith('data:') ? `${mediaName}文件（Data URL）` : url}</span>
                {mediaKind === 'video' && supportsGeekaiAsset && !isAssetUrl(url) && !url.startsWith('data:') && (
                  <button
                    type="button"
                    onClick={() => handleConvertToGeekaiAsset(def.key, url, 'video', (assetUrl: string) => updateValues(values.map((item, i) => i === idx ? assetUrl : item)), `${def.key}:${idx}`)}
                    disabled={assetConvertingKey === `${def.key}:${idx}`}
                    className="inline-flex min-h-7 items-center gap-1 rounded bg-purple-50 px-2 font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-60"
                    title="调用极客自定义素材接口，将该视频 URL 转为 asset://素材ID"
                  >
                    {assetConvertingKey === `${def.key}:${idx}` ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    转素材
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => updateValues(values.filter((_, i) => i !== idx))}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600"
                  title={`移除该${mediaName}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {(!limits?.max || values.length < limits.max) && (
          <div className="flex flex-wrap gap-2">
            <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm ${
              isUploadingMedia ? 'border-blue-300 bg-blue-50 text-blue-500' : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600'
            }`}>
              {isUploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{isUploadingMedia ? `上传${mediaName}中` : `上传${mediaName}获取URL`}</span>
              <input type="file" accept={accept} className="hidden" disabled={isUploadingMedia} onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const uploadedUrl = await uploadMediaFile(file, mediaKind, def.key);
                if (uploadedUrl) updateValues([...values, uploadedUrl]);
                e.target.value = '';
              }} />
            </label>
          </div>
        )}
        <input
          type="text"
          placeholder={`粘贴 http(s) ${mediaName} URL 或 asset://素材ID 后按回车添加${limits?.max ? `（最多${limits.max}个）` : ''}...`}
          className="w-full min-h-10 rounded-lg border border-gray-200 px-3 py-2 text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-blue-100"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const input = e.target as HTMLInputElement;
              const val = normalizeMediaUrl(input.value);
              if (!val) {
                setError(`请输入非空的 http(s) ${mediaName} URL。`);
                return;
              }
              if (!limits?.max || values.length < limits.max) {
                updateValues([...values, val]);
                input.value = '';
              }
            }
          }}
        />
        <p className="text-xs text-gray-400">
          支持粘贴公开 URL 或 asset://素材ID；本地视频/音频会复用 GeekAI 附件上传流程，上传到 COS 后写入可公开访问 URL。
          {mediaKind === 'video' && supportsGeekaiAsset ? ' 视频 URL 添加后可点击“转素材”生成 asset://素材ID。' : ''}
          {limits?.max ? ` 最多 ${limits.max} 个。` : ''}
        </p>
      </div>
    );
  };

  const renderMediaParam = (def: ParamDef) => {
    if (def.type === 'image' || def.type === 'image-multi') return renderImageParam(def);
    if (def.type === 'video' || def.type === 'video-multi' || def.type === 'audio' || def.type === 'audio-multi') return renderVideoAudioParam(def);
    return null;
  };

  // ─── 渲染 select/preset 参数 ──────────────────────────────
  const renderSelectParam = (def: ParamDef, _resolved: ResolvedParam) => {
    const resolved = _resolved;
    const options: ParamOption[] = (resolved.options ?? []) as ParamOption[];
    const current = paramValues[def.key];

    if (options.length === 0) {
      const inputType = def.key === 'video' ? 'url' : def.type === 'number' ? 'number' : 'text';
      return (
        <div key={def.key}>
          <label className="block text-xs text-gray-500 mb-1">{def.label}</label>
          <input
            type={inputType}
            value={String(current ?? '')}
            onChange={e => handleParamChange(def.key, def.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
            placeholder={def.key === 'video' ? '粘贴 http(s) 视频 URL...' : `请输入${def.label}`}
            className="w-full min-h-10 min-w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      );
    }

    // 若选项 <=4，渲染按钮组；否则渲染 select
    if (options.length <= 5) {
      return (
        <div key={def.key}>
          <label className="block text-xs text-gray-500 mb-1">{def.label}</label>
          <div className="flex flex-wrap gap-1">
            {options.map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => handleParamChange(def.key, opt.value)}
                className={`min-h-10 rounded-lg border px-3 py-2 text-sm leading-normal transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                  String(current) === String(opt.value)
                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm ring-2 ring-blue-100'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div key={def.key}>
        <label className="block text-xs text-gray-500 mb-1">{def.label}</label>
        <AppSelect
          value={String(current ?? '')}
          onChange={e => {
            const selected = options.find(opt => String(opt.value) === e.target.value)?.value ?? e.target.value;
            handleParamChange(def.key, def.type === 'number' ? Number(selected) : selected);
          }}
          className="w-full min-w-40"
          options={options.map(opt => ({ value: String(opt.value), label: opt.label }))}
        />
      </div>
    );
  };

  // ─── 渲染 boolean 参数 ────────────────────────────────────
  const renderBoolParam = (def: ParamDef) => (
    <label key={def.key} className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={!!paramValues[def.key]}
        onChange={e => handleParamChange(def.key, e.target.checked)}
        className="w-4 h-4 rounded accent-blue-500"
      />
      <span className="text-sm text-gray-600">{def.label}</span>
    </label>
  );

  return (
    <div className="generate-page page-shell">
      {/* 顶栏 */}
      <div className="page-hero">
        <div>
          <h2>视频生成</h2>
          <p>按模式选择模型，填写 Prompt 与必要图片参数，一次提交多个生成任务。参数已按「模式 / 图片 / 预设 / 开关」分区，减少来回查找。</p>
        </div>
        <div className="hero-actions">
          <AppSelect
            value={activePlatform?.id ?? ''}
            onChange={e => setActivePlatformId(e.target.value)}
            className="app-select--platform min-w-44 text-blue-700"
            title="选择当前生成平台"
            disabled={runtimePlatforms.length === 0}
            options={runtimePlatforms.map(p => ({ value: p.id, label: p.name }))}
            placeholder="暂无可用平台"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 border-l-4 border-red-400 bg-red-50/70 px-3 py-2 text-sm text-red-700 shadow-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600" title="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {submitProgress && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-blue-700 text-sm">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span className="flex-1">{submitProgress}</span>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-green-700 text-sm">
          <span className="flex-1">{successMessage}</span>
          {onNavigateToTasks && (
            <button onClick={onNavigateToTasks} className="text-green-700 underline text-xs whitespace-nowrap">查看任务</button>
          )}
        </div>
      )}

      {offlineQueue.length > 0 && (
        <div className="offline-queue-banner">
          <div className="offline-queue-banner__header">
            <WifiOff className="w-4 h-4 shrink-0 text-slate-500" />
            <span className="flex-1">
              {isOnline
                ? `网络已恢复，正在自动提交离线队列中的 ${offlineQueue.length} 个任务${offlineProcessing ? '…' : ''}`
                : `网络异常，${offlineQueue.length} 个任务已暂存离线队列，网络恢复后将自动提交`}
            </span>
            {offlineActionError && <span className="text-red-600 text-xs">{offlineActionError}</span>}
          </div>
          <div className="offline-queue-banner__list">
            {offlineQueue.map(item => (
              <div key={item.id} className="offline-queue-banner__item">
                <span className="offline-queue-banner__item-text" title={item.prompt}>
                  [{item.model}] {item.prompt || '（无 Prompt）'}
                </span>
                {item.retryCount > 0 && (
                  <span className="text-[11px] text-amber-600 shrink-0">已重试 {item.retryCount} 次</span>
                )}
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-blue-600 hover:bg-blue-50"
                  disabled={offlineProcessing}
                  onClick={async () => {
                    setOfflineActionError('');
                    try {
                      await retryOfflineTask(item.id);
                    } catch (err) {
                      setOfflineActionError(getApiSafeMessage(err, '重试提交失败'));
                    }
                  }}
                  title="立即重试提交"
                >
                  <RefreshCw className="w-3 h-3" />重试
                </button>
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-red-500 hover:bg-red-50"
                  onClick={() => removeOfflineTask(item.id)}
                  title="从离线队列移除，不再自动提交"
                >
                  <Trash2 className="w-3 h-3" />移除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* 左栏：模式 + 参数 + Prompt */}
        <div className="col-span-12 lg:col-span-8 space-y-4">

          {/* 生成模式 */}
          <div className="generate-card bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-base font-semibold text-gray-700 mb-3">生成模式</h3>
            <div className="flex flex-wrap gap-2">
              {MODES.map(m => (
                <button
                  key={m.value}
                  onClick={() => handleModeChange(m.value)}
                  title={`切换到${m.label}`}
                  aria-pressed={mode === m.value}
                  className={`generate-option-button flex min-h-10 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium leading-normal transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                    mode === m.value
                      ? 'generate-option-button--selected border-blue-600 bg-blue-600 text-white shadow-sm ring-2 ring-blue-100'
                      : 'generate-option-button--idle border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 生成参数 */}
          <div className={`generate-card bg-white rounded-lg shadow-sm p-4 ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
            <div onClick={() => setShowParams(v => !v)} className="flex items-center justify-between cursor-pointer mb-3 gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-700">生成参数</h3>
                <p className="text-xs text-gray-400 mt-1">仅展示当前模式和模型需要你确认的参数，隐藏项会自动随请求提交。</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showParams ? '' : '-rotate-90'}`} />
            </div>

            {showParams && (
              <div>
                {/* 模型选择：优先展示内置与用户新增模型；无匹配时引导去配置页新增 */}
                <div className="mb-4">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <label className="block text-xs font-medium text-gray-600">模型</label>
                    {onNavigateToConfig && (
                      <button type="button" onClick={onNavigateToConfig} className="text-xs text-blue-600 hover:text-blue-700 whitespace-nowrap">管理 / 新增模型</button>
                    )}
                  </div>
                  {supportedModels.length > 0 ? (
                    <AppSelect
                      value={selectedModelId}
                      onChange={e => setSelectedModelId(e.target.value)}
                      className="w-full"
                      options={supportedModels.map(m => ({ value: m.id, label: m.label }))}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-3">
                      <p className="text-sm font-medium text-blue-800">当前模式暂无可选模型</p>
                      <p className="mt-1 text-xs leading-5 text-blue-700">如果官方或中转站已发布新模型，请到配置页为当前平台新增模型 ID，并勾选支持的生成模式。</p>
                      {onNavigateToConfig && (
                        <button type="button" onClick={onNavigateToConfig} className="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">去新增模型</button>
                      )}
                    </div>
                  )}
                </div>

                {/* 媒体参考参数：根据模型参数动态展示图片/视频/音频 */}
                {mediaParams.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-4">
                    {mediaParams.map(({ def }) => renderMediaParam(def))}
                  </div>
                )}

                {/* select/preset 参数 */}
                {selectParams.length > 0 && (
                  <div className="flex flex-wrap gap-4 mb-4">
                    {selectParams.map(({ def, resolved }) => renderSelectParam(def, resolved))}
                  </div>
                )}

                {/* boolean 参数 */}
                {boolParams.length > 0 && (
                  <div className="flex flex-wrap gap-4">
                    {boolParams.map(({ def }) => renderBoolParam(def))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prompt 输入 */}
          <div ref={promptSectionRef} className="generate-card relative overflow-visible bg-white rounded-lg shadow-sm p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-700">Prompt</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPromptList(prev => [...prev, ''])}
                  className="flex min-h-9 items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
                >
                  <Plus className="w-3 h-3" />
                  批量
                </button>
                <button
                  type="button"
                  onClick={() => setPromptList(prev => prev.map(() => ''))}
                  className="flex min-h-9 items-center gap-1 rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  <RotateCcw className="w-4 h-4" />
                  清空
                </button>
                <button
                  type="button"
                  onClick={() => setShowPromptLibrary(!showPromptLibrary)}
                  aria-expanded={showPromptLibrary}
                  className="prompt-library-trigger flex min-h-9 items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-purple-200"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  词库
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {promptList.map((prompt, index) => (
                <div key={index} className="relative space-y-2 overflow-visible">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <textarea
                        value={prompt}
                        onChange={e => {
                          const next = [...promptList];
                          next[index] = e.target.value;
                          setPromptList(next);
                        }}
                        placeholder={index === 0 ? '例如：一只橘猫在雨后街道奔跑，电影感，慢镜头，柔和光线' : `Prompt ${index + 1}：输入另一条独立生成内容`}
                        className="prompt-input min-h-[96px] w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm leading-normal resize-y focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePromptInput(index)}
                        className="prompt-remove-button absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-400 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                        title="删除该 Prompt 输入框"
                        aria-label={`删除 Prompt ${index + 1} 输入框`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex w-28 flex-col gap-2 self-start">
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...promptList];
                          next[index] = '';
                          setPromptList(next);
                        }}
                        className="prompt-clear-button inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs font-semibold leading-normal text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-200"
                        title="清除该 Prompt 输入框"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>清除</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveCurrentPrompt(index)}
                        className="prompt-library-primary inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-lg border border-purple-600 bg-purple-600 px-2 py-2 text-xs font-semibold leading-normal text-white shadow-sm transition-colors hover:!bg-purple-700 active:!bg-purple-800 focus:!bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        title="添加该 Prompt 到个人词库"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>添加词库</span>
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右栏：生成控制 */}
        <div ref={generationControlColumnRef} className="generation-control-column col-span-12 lg:col-span-4 space-y-4">
          <div className="generate-card bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-base font-semibold text-gray-700 mb-3">生成控制</h3>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">每个 Prompt 生成数量</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setGenerationCount(n)}
                    className={`generate-option-button min-h-10 flex-1 rounded-lg border px-3 py-2 text-sm leading-normal transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                      generationCount === n
                        ? 'generate-option-button--selected border-blue-600 bg-blue-600 text-white shadow-sm ring-2 ring-blue-100'
                        : 'generate-option-button--idle border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                当前有效 Prompt {validPromptCount} 条，预计提交 {totalSubmitCount} 个任务。
              </p>
            </div>

            {!activePlatform?.apiKey && (
              <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <span>当前平台未配置 API Key，无法提交生成任务。</span>
                {onNavigateToConfig && <button onClick={onNavigateToConfig} className="underline whitespace-nowrap" title="前往系统配置填写 API Key">去配置</button>}
              </div>
            )}
            {!hasModelSelection && (
              <p className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">请选择模型后再生成。找不到新模型时，去配置页「模型管理」手动添加模型 ID。</p>
            )}
            {generateBlockerHint && (
              <div className="generate-warning-message mb-3 flex items-start gap-2 border-l-4 border-amber-300 bg-amber-50/60 px-3 py-2 text-xs leading-5 text-amber-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{generateBlockerHint}</span>
              </div>
            )}
            <button
              onClick={isGenerating ? handleStopGenerate : handleGenerate}
              disabled={!isGenerating && !canGenerate}
              className="generate-submit-button flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold leading-normal text-white shadow-sm transition-colors hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400"
              title={isGenerating ? '停止继续提交新任务，已提交任务仍会保留' : '提交生成任务'}
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 停止继续提交</>
              ) : !activePlatform?.apiKey ? (
                '请先配置 API Key'
              ) : totalSubmitCount === 0 ? (
                '请输入 Prompt 后再生成'
              ) : (
                `开始生成（共 ${totalSubmitCount} 个）`
              )}
            </button>

            {selectedModel && (
              <div className="mt-3 text-xs text-gray-400 space-y-0.5">
                <p className="break-all">模型：{selectedModel.name} <span className="text-gray-300">({selectedModel.id})</span></p>
                {selectedModel.price && <p>价格: {selectedModel.price}</p>}
              </div>
            )}

            <div className="mt-4 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setShowRequestPreview(v => !v)}
                className="request-preview-trigger group flex w-full items-center justify-between py-1.5 text-left"
                aria-expanded={showRequestPreview}
              >
                <span className="text-xs text-gray-500 group-hover:text-gray-800">请求体参数JSON预览</span>
                <ChevronDown className={`h-4 w-4 text-gray-300 transition-transform group-hover:text-gray-500 ${showRequestPreview ? 'rotate-180' : ''}`} />
              </button>
              {showRequestPreview && (
                <pre className="request-preview-panel mt-2 max-h-80 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-[11px] leading-5 text-gray-800">
                  <code>{requestPreviewJson}</code>
                </pre>
              )}
            </div>
          </div>

          {showPromptLibrary && (
            <div className="prompt-library-panel z-[1000] flex flex-col rounded-xl border border-purple-200 bg-white p-3 shadow-2xl" style={promptLibraryLayout.panelStyle}>
              <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-purple-900">个人词库</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-gray-500">仅展示你自己保存的提示词，可编辑分类。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPromptLibrary(false)}
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-purple-50 hover:text-purple-600 active:bg-purple-100 focus:bg-purple-50"
                  title="关闭词库"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-3 shrink-0">
                <input
                  type="text"
                  value={promptSearch}
                  onChange={e => setPromptSearch(e.target.value)}
                  placeholder="搜索个人提示词..."
                  className="prompt-library-search w-full min-h-10 rounded-lg border border-purple-200 px-3 py-2 text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div className="mb-2 flex shrink-0 flex-wrap gap-1.5">
                {promptCategories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPromptLibraryCategory(cat)}
                    className={`min-h-8 rounded-full border px-3 py-1 text-xs font-medium leading-normal transition-colors focus:outline-none focus:ring-2 focus:ring-purple-100 ${
                      promptLibraryCategory === cat
                        ? '!border-purple-600 !bg-purple-600 !text-white hover:!bg-purple-700 active:!bg-purple-800 focus:!bg-purple-600'
                        : '!border-purple-200 !bg-purple-100 !text-purple-700 hover:!bg-purple-200 active:!bg-purple-200 focus:!bg-purple-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="prompt-library-list min-h-0 space-y-1 overflow-y-auto pr-1" style={{ maxHeight: promptLibraryLayout.listMaxHeight }}>
                {filteredPrompts.length === 0 ? (
                  <p className="py-4 text-center text-xs leading-5 text-gray-400">暂无个人提示词。先在左侧填写 Prompt，再点击输入框右侧的“添加词库”。</p>
                ) : filteredPrompts.map(p => (
                  <div key={p.id} className="group rounded border border-purple-100 bg-white p-2 transition-colors hover:border-purple-300">
                    {editingPromptId === p.id ? (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={editPromptCategory}
                          onChange={e => setEditPromptCategory(e.target.value)}
                          className="min-h-10 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-purple-100"
                          placeholder="分类"
                        />
                        <textarea
                          value={editPromptText}
                          onChange={e => setEditPromptText(e.target.value)}
                          className="w-full min-h-[88px] rounded-lg border border-gray-200 px-3 py-2 text-sm leading-normal resize-y focus:outline-none focus:ring-2 focus:ring-purple-100"
                        />
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingPromptId(null)} className="min-h-9 rounded-lg px-3 py-2 text-sm leading-normal text-gray-600 hover:bg-gray-100">取消</button>
                          <button type="button" onClick={handleSaveEdit} className="prompt-library-save min-h-9 rounded-lg border border-purple-600 bg-purple-600 px-3 py-2 text-sm font-medium leading-normal text-white shadow-sm transition-colors hover:bg-purple-700 active:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-200" data-prompt-library-action="save">保存</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => handleInsertPrompt(p.text)}
                            className="prompt-library-item-text flex-1 text-left text-xs leading-relaxed text-gray-700"
                            style={{ maxHeight: '6.5em', overflowY: 'auto', whiteSpace: 'pre-wrap' }}
                            title="点击填充到空 Prompt；没有空输入框时自动新增"
                          >
                            {p.text}
                          </button>
                          <div className="flex flex-shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(p)}
                              className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-600 shadow-sm hover:border-amber-300 hover:bg-amber-100 hover:text-amber-700"
                              title="编辑提示词"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePrompt(p.id)}
                              className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-500 shadow-sm hover:border-red-300 hover:bg-red-100 hover:text-red-600"
                              title="删除提示词"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1">
                          <span className="rounded bg-purple-50 px-1 text-[10px] text-purple-500">{p.category}</span>
                          <span className="sr-only">个人提示词</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 shrink-0 text-center text-[10px] text-gray-400">点击提示词会优先填充空输入框，没有空输入框时自动新增，词库面板会保持打开。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneratePage;
