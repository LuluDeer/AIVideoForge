import React, { useState, useEffect, useMemo } from 'react';
import { Video, Image, Upload, Play, Trash2, AlertCircle, Loader2, Plus, Lock } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { useTasks } from '../context/TaskContext';
import type { GenerationMode, VideoGenerationRequest, ModelInfo, ParameterConstraint } from '../types';
import VideoApi from '../services/api';
import ImageUploader from '../services/imageUpload';
import modelConfigManager from '../services/modelConfigManager';
import type { ModelParameterConfig, ParameterMapping } from '../types/modelConfig';

const GeneratePage: React.FC = () => {
  const { config, activePlatform, setActivePlatform } = useConfig();
  const { addTask, updateTask } = useTasks();
  const [mode, setMode] = useState<GenerationMode>('text');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [promptList, setPromptList] = useState<string[]>(['']);
  const [generationCount, setGenerationCount] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const [modelConfig, setModelConfig] = useState<ModelParameterConfig | null>(null);
  const [customParams, setCustomParams] = useState<Record<string, any>>({});
  const [modelConstraints, setModelConstraints] = useState<ParameterConstraint[]>([]);

  useEffect(() => {
    if (activePlatform) {
      setSelectedModel(activePlatform.defaultModel);
    }
  }, [activePlatform]);

  useEffect(() => {
    if (selectedModel && activePlatform) {
      let modelConfigResult = modelConfigManager.getConfigForSystemModel(selectedModel, config.platforms);
      

      
      setModelConfig(modelConfigResult);
      
      const constraints = modelConfigManager.getModelConstraints(selectedModel, config.platforms, activePlatform?.id);
      setModelConstraints(constraints);
      
      if (modelConfigResult) {
        const initialParams: Record<string, any> = {};
        modelConfigResult.parameterMappings.forEach(mapping => {
          if (mapping.showInUI && mapping.defaultValue !== undefined) {
            const constraint = constraints.find(c => c.unifiedParam === mapping.unifiedParam);
            if (constraint?.fixed !== undefined) {
              initialParams[mapping.unifiedParam] = constraint.fixed;
            } else if (constraint?.defaultValue !== undefined) {
              initialParams[mapping.unifiedParam] = constraint.defaultValue;
            } else {
              initialParams[mapping.unifiedParam] = mapping.defaultValue;
            }
          }
        });
        setCustomParams(initialParams);
      } else {
        setCustomParams({});
      }
    }
  }, [selectedModel, activePlatform, config.platforms, mode]);

  const getConstraint = (paramName: string): ParameterConstraint | undefined => {
    return modelConstraints.find(c => c.unifiedParam === paramName);
  };

  const convertValueByType = (value: any, paramType?: string): any => {
    if (paramType === 'number') {
      const num = Number(value);
      return isNaN(num) ? value : num;
    } else if (paramType === 'boolean') {
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === '1') return true;
      if (value === 'false' || value === '0') return false;
      return Boolean(value);
    } else if (paramType === 'array') {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [value];
        } catch {
          return [value];
        }
      }
      return [value];
    } else if (paramType === 'object') {
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    }
    return value;
  };

  const isParamHidden = (paramName: string): boolean => {
    const constraint = getConstraint(paramName);
    if (constraint?.enabled === false) return true;
    if (constraint?.hidden) return true;
    if (constraint?.modes && constraint.modes.length > 0 && !constraint.modes.includes(mode)) {
      return true;
    }
    return false;
  };

  const isParamFixed = (paramName: string): boolean => {
    const constraint = getConstraint(paramName);
    return constraint?.fixed !== undefined;
  };

  const getFixedValue = (paramName: string): any => {
    const constraint = getConstraint(paramName);
    return constraint?.fixed;
  };

  const getFilteredEnumValues = (param: ParameterMapping): any[] => {
    const constraint = getConstraint(param.unifiedParam);
    if (constraint?.enumValues && constraint.enumValues.length > 0) {
      return constraint.enumValues;
    }
    return param.enumValues || [];
  };

  const modes: { value: GenerationMode; label: string; icon: React.ReactNode }[] = [
    { value: 'text', label: '文生视频', icon: <Video className="w-4 h-4" /> },
    { value: 'image', label: '图生视频', icon: <Image className="w-4 h-4" /> },
    { value: 'imageTail', label: '首尾帧', icon: <Image className="w-4 h-4" /> },
    { value: 'multiImage', label: '多图生成', icon: <Image className="w-4 h-4" /> },
  ];

  const getSupportedModels = (): ModelInfo[] => {
    if (!activePlatform?.models) return [];
    return activePlatform.models.filter(model => model.supportedModes.includes(mode));
  };

  const getVisibleParams = (): ParameterMapping[] => {
    if (!modelConfig) return [];
    return modelConfig.parameterMappings.filter(m => m.showInUI && !isParamHidden(m.unifiedParam));
  };

  const getSelectParams = (): ParameterMapping[] => {
    return getVisibleParams().filter(m => {
      if (m.uiType !== 'select') return false;
      // 约束里有 presetOptions 时，走预设按钮渲染，不走下拉框
      const constraint = getConstraint(m.unifiedParam);
      const effectivePreset = (constraint?.presetOptions && constraint.presetOptions.length > 0)
        ? constraint.presetOptions
        : m.presetOptions;
      return !effectivePreset || effectivePreset.length === 0;
    });
  };

  const getPresetParams = (): ParameterMapping[] => {
    return getVisibleParams().filter(m => {
      const constraint = getConstraint(m.unifiedParam);
      const effectivePreset = (constraint?.presetOptions && constraint.presetOptions.length > 0)
        ? constraint.presetOptions
        : m.presetOptions;
      return effectivePreset && effectivePreset.length > 0;
    });
  };

  const getCheckboxParams = (): ParameterMapping[] => {
    return getVisibleParams().filter(m => m.uiType === 'checkbox');
  };

  const getInputParams = (): ParameterMapping[] => {
    return getVisibleParams().filter(m => m.uiType === 'input');
  };

  const getNumberParams = (): ParameterMapping[] => {
    return getVisibleParams().filter(m => m.uiType === 'number');
  };

  const getTextareaParams = (): ParameterMapping[] => {
    return getVisibleParams().filter(m => m.uiType === 'textarea');
  };

  const getImageParams = (): ParameterMapping[] => {
    return getVisibleParams().filter(m => m.uiType === 'image' || m.uiType === 'image-multi');
  };

  const handleAddPrompt = () => {
    setPromptList([...promptList, '']);
  };

  const handleRemovePrompt = (index: number) => {
    if (promptList.length > 1) {
      setPromptList(promptList.filter((_, i) => i !== index));
    }
  };

  const handleUpdatePrompt = (index: number, value: string) => {
    const newList = [...promptList];
    newList[index] = value;
    setPromptList(newList);
  };

  const handleCustomParamChange = (paramName: string, value: any) => {
    setCustomParams(prev => ({ ...prev, [paramName]: value }));
  };

  const handleGenerate = async () => {
    if (!activePlatform?.apiKey) {
      setError('请先配置当前平台的API Key');
      return;
    }

    const validPrompts = promptList.filter(p => p.trim());
    if (validPrompts.length === 0) {
      setError('请输入至少一个Prompt');
      return;
    }

    if (!selectedModel) {
      setError('请选择一个模型');
      return;
    }

    const imageParamsList = getImageParams();
    const requiresImage = imageParamsList.length > 0;
    
    if (requiresImage) {
      const hasUploadedImage = imageParamsList.some(param => {
        const value = customParams[param.unifiedParam];
        if (Array.isArray(value)) {
          return value.length > 0 && value.some(v => v && v.trim() !== '');
        }
        return value && typeof value === 'string' && value.trim() !== '';
      });
      if (!hasUploadedImage) {
        setError('请上传至少一张图片');
        return;
      }
    }

    setIsGenerating(true);
    setError('');

    const api = new VideoApi(activePlatform);

    for (const prompt of validPrompts) {
      for (let i = 0; i < generationCount; i++) {
        try {
          const request: VideoGenerationRequest = {
            model: selectedModel,
            prompt: prompt.trim(),
            async: true,
          };

          if (modelConfig) {
            modelConfig.parameterMappings.forEach(mapping => {
              if (mapping.showInUI && !isParamHidden(mapping.unifiedParam) && customParams[mapping.unifiedParam] !== undefined) {
                const value = convertValueByType(customParams[mapping.unifiedParam], mapping.paramType);
                (request as any)[mapping.unifiedParam] = value;
              }
            });
          }

          const constrainedRequest = modelConfigManager.applyConstraintsToRequest(request, selectedModel, config.platforms, modelConfig ?? undefined, activePlatform?.id) as VideoGenerationRequest;
          const response = await api.generateVideo(constrainedRequest);
          
          const task = addTask({
            id: response.task_id,
            prompt: prompt.trim(),
            model: selectedModel,
            mode,
            count: generationCount,
            image_url: typeof request.image === 'string' ? request.image : undefined,
            image_tail_url: request.image_tail,
            image_urls: Array.isArray(request.image) ? request.image : undefined,
            status: response.task_status,
            video_url: response.video_result?.[0]?.url,
            auto_download: config.autoDownload && !!config.downloadPath,
            downloaded: false,
          });

          // 任务状态由 TaskContext 的 interval 轮询统一管理，无需在此重复轮询
        } catch (err) {
          console.error('生成失败:', err);
          setError(`生成失败: ${(err as Error).message}`);
        }
      }
    }

    setIsGenerating(false);
    const createdTasks = validPrompts.length * generationCount;
    setSuccessMessage(`成功创建 ${createdTasks} 个任务，正在后台生成中...`);
    setTimeout(() => setSuccessMessage(''), 5000);
    setPromptList(['']);
  };

  const supportedModels = getSupportedModels();
  const currentModelInfo = activePlatform?.models.find(m => m.id === selectedModel);
  const selectParams = getSelectParams();
  const presetParams = getPresetParams();
  const checkboxParams = getCheckboxParams();
  const inputParams = getInputParams();
  const numberParams = getNumberParams();
  const textareaParams = getTextareaParams();
  const imageParams = getImageParams();

  const buildPreviewRequest = useMemo(() => {
    if (!selectedModel || !activePlatform) return null;

    const request: Record<string, any> = {
      model: selectedModel,
      prompt: promptList.filter(p => p.trim()).join('\n'),
      async: true,
    };

    if (modelConfig) {
      modelConfig.parameterMappings.forEach(mapping => {
        if (mapping.showInUI && !isParamHidden(mapping.unifiedParam) && customParams[mapping.unifiedParam] !== undefined) {
          const value = convertValueByType(customParams[mapping.unifiedParam], mapping.paramType);
          request[mapping.unifiedParam] = value;
        }
      });

      // 应用约束后直接返回，字段名即为最终请求字段名，不做 modelParam 映射
      const constrained = modelConfigManager.applyConstraintsToRequest(
        request as any,
        selectedModel,
        config.platforms,
        modelConfig
      );
      return constrained;
    }

    return request;
  }, [selectedModel, activePlatform, promptList, modelConfig, customParams, modelConstraints, config.platforms]);

  return (
    <div className="p-4 min-h-screen bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">视频生成</h2>
        <div className="relative">
          <select
            value={activePlatform?.id || ''}
            onChange={(e) => {
              const platformId = e.target.value;
              if (platformId) {
                setActivePlatform(platformId);
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg text-sm text-blue-700 font-medium border-0 focus:ring-2 focus:ring-blue-300 cursor-pointer appearance-none pr-8"
          >
            {config.platforms.map(platform => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-700 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-base font-semibold text-gray-700 mb-3">生成模式</h3>
            <div className="flex gap-2">
              {modes.map(m => (
                <button
                  key={m.value}
                  onClick={() => {
                    const newMode = m.value;
                    setMode(newMode);
                    const filteredModels = activePlatform?.models.filter(model => model.supportedModes.includes(newMode)) || [];
                    const currentModelId = typeof selectedModel === 'string' ? selectedModel : (selectedModel as any)?.id || '';
                    const existingModel = filteredModels.find(model => model.id === currentModelId);
                    const newModelId = existingModel?.id || filteredModels[0]?.id;
                    if (newModelId) {
                      setSelectedModel(newModelId);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-sm font-medium ${
                    mode === m.value
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'
                  }`}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-700">生成参数</h3>
              {currentModelInfo && currentModelInfo.supportedModes.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-500">模型支持:</span>
                  {currentModelInfo.supportedModes.map(m => (
                    <span
                      key={m}
                      className="text-sm px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
                    >
                      {modes.find(mode => mode.value === m)?.label || m}
                    </span>
                  ))}
                </div>
              )}
            </div>
              
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">模型</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white min-w-[200px]"
                >
                  {supportedModels.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.id} {model.price && `(${model.price})`}
                    </option>
                  ))}
                </select>
              </div>
              
              {[...selectParams, ...inputParams, ...numberParams].map(param => {
                const fixed = isParamFixed(param.unifiedParam);
                const fixedVal = getFixedValue(param.unifiedParam);
                const enumValues = getFilteredEnumValues(param);
                const rawValue = fixed ? fixedVal : (customParams[param.unifiedParam] ?? param.defaultValue ?? '');
                const currentValue = convertValueByType(rawValue, param.paramType);
                const minWidth = param.uiType === 'select' ? 'min-w-[150px]' : '';

                return (
                  <div key={param.unifiedParam} className={minWidth}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1 truncate">
                      {param.uiLabel || param.description || param.unifiedParam}
                      {fixed && <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                    </label>
                    {param.uiType === 'select' ? (
                      <select
                        value={currentValue}
                        onChange={(e) => !fixed && handleCustomParamChange(param.unifiedParam, e.target.value)}
                        disabled={fixed}
                        className={`px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white min-w-[150px] ${
                          fixed ? 'bg-gray-100 cursor-not-allowed border-gray-200' : 'border-gray-300'
                        }`}
                      >
                        {enumValues.length > 0 ? (
                          enumValues.map((val: any) => (
                            <option key={String(val)} value={val}>{val}</option>
                          ))
                        ) : (
                          <option value={currentValue}>
                            {currentValue || '请选择'}
                          </option>
                        )}
                      </select>
                    ) : param.uiType === 'input' ? (
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => !fixed && handleCustomParamChange(param.unifiedParam, e.target.value)}
                        disabled={fixed}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                          fixed ? 'bg-gray-100 cursor-not-allowed border-gray-200' : 'border-gray-300'
                        }`}
                        placeholder={param.description}
                      />
                    ) : (
                      <input
                        type="number"
                        value={currentValue}
                        onChange={(e) => !fixed && handleCustomParamChange(param.unifiedParam, parseFloat(e.target.value))}
                        disabled={fixed}
                        min={getConstraint(param.unifiedParam)?.min}
                        max={getConstraint(param.unifiedParam)?.max}
                        step={getConstraint(param.unifiedParam)?.step}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
                          fixed ? 'bg-gray-100 cursor-not-allowed border-gray-200' : 'border-gray-300'
                        }`}
                        placeholder={param.description}
                      />
                    )}
                  </div>
                );
              })}
            </div>
              
            {presetParams.length > 0 && (
              <div className="mt-3 space-y-2">
                {presetParams.map(param => {
                  const fixed = isParamFixed(param.unifiedParam);
                  const fixedVal = getFixedValue(param.unifiedParam);
                  const rawPresetValue = fixed ? fixedVal : (customParams[param.unifiedParam] ?? param.defaultValue ?? '');
                  const currentValue = convertValueByType(rawPresetValue, param.paramType);
                  
                  const constraintForPreset = getConstraint(param.unifiedParam);
                  const effectivePresetOptions = (constraintForPreset?.presetOptions && constraintForPreset.presetOptions.length > 0)
                    ? constraintForPreset.presetOptions
                    : param.presetOptions;
                  return (
                    <div key={param.unifiedParam}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                        {param.uiLabel || param.description || param.unifiedParam}
                        {fixed && <Lock className="w-3 h-3 text-gray-400" />}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {effectivePresetOptions?.map((option, index) => (
                          <button
                            key={index}
                            onClick={() => !fixed && handleCustomParamChange(param.unifiedParam, option.value)}
                            disabled={fixed}
                            className={`px-3 py-1.5 rounded-lg text-sm transition ${
                              currentValue === option.value
                                ? 'bg-blue-600 text-white'
                                : fixed
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              
            {textareaParams.length > 0 && (
              <div className="mt-3 space-y-2">
                {textareaParams.map(param => {
                  const fixed = isParamFixed(param.unifiedParam);
                  const fixedVal = getFixedValue(param.unifiedParam);
                  const currentValue = fixed ? fixedVal : (customParams[param.unifiedParam] ?? param.defaultValue ?? '');
                  
                  return (
                    <div key={param.unifiedParam}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                        {param.uiLabel || param.description || param.unifiedParam}
                        {fixed && <Lock className="w-3 h-3 text-gray-400" />}
                      </label>
                      <textarea
                        value={currentValue}
                        onChange={(e) => !fixed && handleCustomParamChange(param.unifiedParam, e.target.value)}
                        disabled={fixed}
                        rows={2}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y ${
                          fixed ? 'bg-gray-100 cursor-not-allowed border-gray-200' : 'border-gray-300'
                        }`}
                        placeholder={param.description}
                      />
                    </div>
                  );
                })}
              </div>
            )}
              
            {imageParams.length > 0 && (
              <div className="mt-3 space-y-3">
                {imageParams.map(param => {
                  const isSingle = param.paramType === 'string';
                  const currentValue = customParams[param.unifiedParam];
                  const imageUrls: string[] = isSingle
                    ? (currentValue ? [currentValue as string] : [])
                    : (Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue as string] : []));

                  return (
                    <div key={param.unifiedParam}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {param.uiLabel || param.description || param.unifiedParam}
                        {isSingle
                          ? (imageUrls.length > 0 ? ' (已上传 1 张)' : '')
                          : (imageUrls.length > 0 ? ` (已上传 ${imageUrls.length} 张)` : '')}
                      </label>
                      <label
                        htmlFor={`param-image-${param.unifiedParam}`}
                        className="block border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors cursor-pointer"
                      >
                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-gray-500 text-sm">
                          {isSingle ? '点击上传图片（重复上传将覆盖）' : '点击上传图片（支持多选）'}
                        </p>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          multiple={!isSingle}
                          onChange={(e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0 || !config.uploadCk) return;

                            const uploader = new ImageUploader(config.uploadCk);

                            if (isSingle) {
                              uploader.uploadImage(files[0]).then(result => {
                                handleCustomParamChange(param.unifiedParam, result.url);
                              }).catch(err => {
                                setError(`图片上传失败: ${(err as Error).message}`);
                              });
                            } else {
                              const uploadPromises = Array.from(files).map(file =>
                                uploader.uploadImage(file).then(result => result.url)
                              );
                              Promise.all(uploadPromises).then(newUrls => {
                                const updatedImages = [...imageUrls, ...newUrls];
                                handleCustomParamChange(param.unifiedParam, updatedImages);
                              }).catch(err => {
                                setError(`图片上传失败: ${(err as Error).message}`);
                              });
                            }
                          }}
                          className="hidden"
                          id={`param-image-${param.unifiedParam}`}
                        />
                      </label>
                      {imageUrls.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {imageUrls.map((url, index) => (
                            <div key={index} className="relative">
                              <img
                                src={url}
                                alt={`已上传 ${index + 1}`}
                                className="w-12 h-12 object-cover rounded"
                              />
                              <button
                                onClick={() => {
                                  if (isSingle) {
                                    handleCustomParamChange(param.unifiedParam, '');
                                  } else {
                                    const updatedImages = imageUrls.filter((_, i) => i !== index);
                                    handleCustomParamChange(param.unifiedParam, updatedImages);
                                  }
                                }}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full hover:bg-red-600 flex items-center justify-center"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          {!isSingle && (
                            <button
                              onClick={() => handleCustomParamChange(param.unifiedParam, [])}
                              className="text-sm text-gray-500 hover:text-gray-600 self-end"
                            >
                              清空全部
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
              
            {checkboxParams.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-4">
                {checkboxParams.map(param => {
                  const fixed = isParamFixed(param.unifiedParam);
                  const fixedVal = getFixedValue(param.unifiedParam);
                  const rawCheckValue = fixed ? fixedVal : (customParams[param.unifiedParam] ?? param.defaultValue ?? false);
                  const currentValue = convertValueByType(rawCheckValue, param.paramType) as boolean;
                  
                  return (
                    <label key={param.unifiedParam} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={currentValue}
                        onChange={(e) => !fixed && handleCustomParamChange(param.unifiedParam, e.target.checked)}
                        disabled={fixed}
                        className={`w-4 h-4 rounded focus:ring-blue-500 ${
                          fixed ? 'bg-gray-200 cursor-not-allowed' : 'text-blue-600'
                        }`}
                      />
                      <span className={`text-sm ${fixed ? 'text-gray-500' : 'text-gray-700'}`}>
                        {param.uiLabel || param.description || param.unifiedParam}
                        {fixed && <Lock className="w-3 h-3 inline ml-0.5 text-gray-400" />}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>



          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-700">提示词</h3>
              <button
                onClick={handleAddPrompt}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加
              </button>
            </div>
            <div className="space-y-2">
              {promptList.map((prompt, index) => (
                <div key={index} className="flex gap-2">
                  <textarea
                    value={prompt}
                    onChange={(e) => {
                      handleUpdatePrompt(index, e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    placeholder={`输入提示词 ${index + 1}...`}
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none overflow-hidden"
                    style={{ height: 'auto' }}
                  />
                  {promptList.length > 1 && (
                    <button
                      onClick={() => handleRemovePrompt(index)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white rounded-lg shadow-sm p-4 sticky top-4">
            <h3 className="text-base font-semibold text-gray-700 mb-3">生成控制</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">生成数量</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setGenerationCount(Math.max(1, generationCount - 1))}
                    className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-base font-medium"
                  >
                    -
                  </button>
                  <span className="w-12 text-center font-medium text-base">{generationCount}</span>
                  <button
                    onClick={() => setGenerationCount(Math.min(10, generationCount + 1))}
                    className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-base font-medium"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all text-base ${
                    isGenerating
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/25'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      生成视频
                    </>
                  )}
                </button>
              </div>

              {currentModelInfo && (
                <div className="pt-3 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">当前模型信息</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>模型ID:</span>
                      <span className="font-mono">{currentModelInfo.id}</span>
                    </div>
                    {currentModelInfo.price && (
                      <div className="flex justify-between">
                        <span>价格:</span>
                        <span className="text-green-600">{currentModelInfo.price}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>支持模式:</span>
                      <span>{currentModelInfo.supportedModes.length} 种</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-700">请求JSON预览</h4>
                  <button
                    onClick={() => {
                      if (buildPreviewRequest) {
                        navigator.clipboard.writeText(JSON.stringify(buildPreviewRequest, null, 2));
                        setSuccessMessage('已复制到剪贴板');
                        setTimeout(() => setSuccessMessage(''), 2000);
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    复制
                  </button>
                </div>
                <div className="bg-gray-900 rounded-lg p-3 overflow-auto max-h-[300px]">
                  <pre className="text-xs text-green-400 whitespace-pre font-mono">
                    {buildPreviewRequest ? JSON.stringify(buildPreviewRequest, null, 2) : '请选择模型'}
                  </pre>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  <span className="text-gray-400">注：</span>
                  实际请求时用户输入的参数将替换此处留空的值
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneratePage;
