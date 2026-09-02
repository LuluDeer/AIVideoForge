import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Video, Image, AlertCircle, Loader2, Plus, BookOpen, X, ChevronDown, RotateCcw } from 'lucide-react';
import AppSelect from '../components/AppSelect';
import { useConfig } from '../context/useConfig';
import { useTasks } from '../context/useTasks';
import { useOfflineQueue } from '../context/useOfflineQueue';
import type { GenerationMode, VideoGenerationRequest, ParamDef, ParamOption } from '../types';
import { buildRequestPayload } from '../services/api/payloadBuilders';
import { resolveParam } from '../services/modelConfigManager';
import { addCustomPrompt } from '../services/promptLibrary';
import { containsLocalOnlyImageValue } from '../context/taskUtils';
import MediaParamField from './generate/MediaParamField';
import PromptLibraryPanel from './generate/PromptLibraryPanel';
import OfflineQueueBanner from './generate/OfflineQueueBanner';
import { useBatchSubmit } from './generate/useBatchSubmit';

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
  const { addTask, reuseTaskData, clearReuseTaskData } = useTasks();
  const {
    queue: offlineQueue,
    isOnline,
    isProcessing: offlineProcessing,
    enqueueOfflineTask,
    removeOfflineTask,
    retryOfflineTask,
  } = useOfflineQueue();

  const [mode, setMode] = useState<GenerationMode>('text');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [promptList, setPromptList] = useState<string[]>(['']);
  const [generationCount, setGenerationCount] = useState<number>(1);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [promptLibraryVersion, setPromptLibraryVersion] = useState(0);
  const [showParams, setShowParams] = useState(true);
  const [showRequestPreview, setShowRequestPreview] = useState(false);
  const [pendingReuseData, setPendingReuseData] = useState<PendingReuseData | null>(null);
  const promptSectionRef = useRef<HTMLDivElement | null>(null);
  const generationControlColumnRef = useRef<HTMLDivElement | null>(null);

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

  const validPromptCount = useMemo(() => promptList.filter(p => p.trim()).length, [promptList]);
  const totalSubmitCount = validPromptCount * generationCount;
  const hasNoPlatform = !activePlatform;
  const hasApiKey = Boolean(activePlatform?.apiKey);
  const hasModelSelection = selectedModelId.trim().length > 0;
  const noSupportedModelForMode = Boolean(activePlatform && activePlatform.models.length > 0 && supportedModels.length === 0);
  const canGenerate = hasApiKey && hasModelSelection && !noSupportedModelForMode && totalSubmitCount > 0;
  const supportsGeekaiAsset = Boolean(activePlatform?.apiKey && activePlatform.baseUrl.includes('geekai.co'));

  const isMediaParam = (def: ParamDef) => def.type === 'image' || def.type === 'image-multi' || def.type === 'video' || def.type === 'video-multi' || def.type === 'audio' || def.type === 'audio-multi';
  const imageParams = useMemo(() => visibleParams.filter(({ def }) => def.type === 'image' || def.type === 'image-multi'), [visibleParams]);
  const mediaParams = useMemo(() => visibleParams.filter(({ def }) => isMediaParam(def)), [visibleParams]);
  const selectParams = useMemo(() => visibleParams.filter(({ def }) => (def.type === 'string' || def.type === 'number') && !isMediaParam(def)), [visibleParams]);
  const boolParams = useMemo(() => visibleParams.filter(({ def }) => def.type === 'boolean'), [visibleParams]);

  const handleParamChange = (key: string, value: unknown) => {
    setParamValues(prev => ({ ...prev, [key]: value }));
  };

  const handleModeChange = (newMode: GenerationMode) => {
    setMode(newMode);
    const defaultModel = activePlatform?.models.find(m => m.id === activePlatform.defaultModel && m.modes.includes(newMode));
    const first = activePlatform?.models.find(m => m.modes.includes(newMode));
    if (defaultModel || first) setSelectedModelId((defaultModel ?? first)?.id ?? '');
  };

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
    setPromptLibraryVersion(v => v + 1);
    setShowPromptLibrary(true);
    setSuccessMessage(`已保存 Prompt ${promptIndex + 1} 到个人词库，可在词库中编辑分类`);
    setTimeout(() => setSuccessMessage(''), 3000);
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

  const { isGenerating, submitProgress, handleGenerate, handleStopGenerate } = useBatchSubmit({
    activePlatform,
    selectedModelId,
    selectedModel,
    supportedModels,
    mode,
    generationCount,
    promptList,
    imageParams,
    mediaParams,
    paramValues,
    buildRequest,
    appConfig,
    addTask,
    enqueueOfflineTask,
    onError: setError,
    onSuccess: setSuccessMessage,
  });

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
    // buildRequest 每次渲染重建，纳入依赖会使 memo 失效；下列依赖已覆盖其全部输入
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlatform, promptList, selectedModelId, visibleParams, resolvedParams, paramValues]);

  const getGenerateBlockerHint = (): string | null => {
    if (hasNoPlatform) return '请先在配置页新增或启用平台，再填写 API Key。';
    if (!hasApiKey) return '当前平台缺少 API Key，请先到配置页填写后再生成。';
    if (!hasModelSelection) return '请选择模型。若平台刚发布新模型，可到配置页的「模型管理」手动新增。';
    if (noSupportedModelForMode) return '当前模式没有可用模型，请切换模式，或到配置页为当前平台新增支持该模式的模型。';
    if (totalSubmitCount === 0) return '请输入至少一个 Prompt；图片模式还需上传或粘贴公开图片 URL。';
    return null;
  };

  const generateBlockerHint = getGenerateBlockerHint();

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
                    : 'generate-option-button--idle border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
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

      <OfflineQueueBanner
        queue={offlineQueue}
        isOnline={isOnline}
        isProcessing={offlineProcessing}
        onRetry={retryOfflineTask}
        onRemove={removeOfflineTask}
      />

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
                    {mediaParams.map(({ def }) => (
                      <MediaParamField
                        key={def.key}
                        def={def}
                        value={paramValues[def.key]}
                        onChange={next => handleParamChange(def.key, next)}
                        appConfig={appConfig}
                        platform={activePlatform}
                        supportsGeekaiAsset={supportsGeekaiAsset}
                        onError={setError}
                        onSuccess={setSuccessMessage}
                      />
                    ))}
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
                  className="prompt-clear-button flex min-h-9 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
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
            <PromptLibraryPanel
              anchorRef={promptSectionRef}
              promptCount={promptList.length}
              refreshVersion={promptLibraryVersion}
              onInsertPrompt={handleInsertPrompt}
              onClose={() => setShowPromptLibrary(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneratePage;
