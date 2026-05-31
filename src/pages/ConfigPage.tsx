import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, AlertCircle, CheckCircle, FolderOpen, Plus, Trash2, ChevronDown, ChevronUp, Settings, Server, X, Filter, Search, RefreshCw, History, Eye, EyeOff, Power, FileJson } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import type { PlatformConfig, ModelInfo, ApiEndpoints, GenerationMode, ApiFormatType, ParameterConstraint, VersionHistory } from '../types';
import modelConfigManager from '../services/modelConfigManager';
import type { ModelParameterConfig } from '../types/modelConfig';

const ConfigPage: React.FC = () => {
  const { config, updateConfig, saveConfig, loadConfig, saveSuccess, updatePlatform, addPlatform, removePlatform, setActivePlatform } = useConfig();
  const [expandedPlatforms, setExpandedPlatforms] = useState<string[]>([config.activePlatformId]);
  const [showAddPlatformModal, setShowAddPlatformModal] = useState(false);
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [showConstraintModal, setShowConstraintModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['global', 'platforms']);
  const [newPlatform, setNewPlatform] = useState<Partial<PlatformConfig>>({
    id: '',
    name: '',
    baseUrl: '',
    apiKey: '',
    apiFormat: 'unified',
    defaultModel: '',
    models: [],
  });
  const [newModel, setNewModel] = useState<ModelInfo>({
    id: '',
    name: '',
    label: '',
    supportedModes: ['text'],
    supportedApiFormats: ['unified'],
    parameterConstraints: [],
    modelConfigVersion: 0,
    versionHistory: [],
    autoSyncConfig: true,
  });
  const [newModelPlatformId, setNewModelPlatformId] = useState<string | null>(null);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
  const [showEditModelModal, setShowEditModelModal] = useState(false);
  const [modelConfigs, setModelConfigs] = useState<ModelParameterConfig[]>([]);
  const [selectedModelForConstraints, setSelectedModelForConstraints] = useState<ModelInfo | null>(null);
  const [constraintPlatformId, setConstraintPlatformId] = useState<string | null>(null);
  const [constraintSearchQuery, setConstraintSearchQuery] = useState('');
  const [constraintFilterType, setConstraintFilterType] = useState<string>('all');
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [expandedConstraints, setExpandedConstraints] = useState<Set<string>>(new Set());
  const [diffHistory, setDiffHistory] = useState<VersionHistory | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionFilterQuery, setVersionFilterQuery] = useState('');
  const [previewMode, setPreviewMode] = useState<GenerationMode>('text');
  const [showJsonPreview, setShowJsonPreview] = useState(false);

  useEffect(() => {
    setModelConfigs(modelConfigManager.getAllConfigs());
  }, []);

  const handleChange = (key: keyof typeof config, value: string | boolean) => {
    updateConfig({ [key]: value });
  };

  const handleSelectDownloadPath = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.selectFolder();
      if (result && result.path) {
        updateConfig({ downloadPath: result.path });
      }
    } else {
      alert('请在桌面应用中使用此功能');
    }
  };

  const togglePlatformExpand = (platformId: string) => {
    setExpandedPlatforms(prev => 
      prev.includes(platformId) 
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };

  const toggleSectionExpand = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handlePlatformUpdate = (platformId: string, key: keyof PlatformConfig, value: string | boolean | ModelInfo[] | ApiEndpoints) => {
    updatePlatform(platformId, { [key]: value });
  };

  const handleAddPlatform = () => {
    if (!newPlatform.id || !newPlatform.name || !newPlatform.baseUrl) {
      alert('请填写平台ID、名称和基础URL');
      return;
    }
    
    const platform: PlatformConfig = {
      id: newPlatform.id!,
      name: newPlatform.name!,
      baseUrl: newPlatform.baseUrl!,
      apiKey: newPlatform.apiKey || '',
      apiFormat: (newPlatform.apiFormat as 'unified' | 'openai') || 'unified',
      defaultModel: newPlatform.defaultModel || '',
      models: (newPlatform.models as ModelInfo[]) || [],
      endpoints: {
        createVideo: '/v1/video/create',
        queryTask: '/v1/video/query',
      },
    };
    
    addPlatform(platform);
    setNewPlatform({
      id: '',
      name: '',
      baseUrl: '',
      apiKey: '',
      apiFormat: 'unified',
      defaultModel: '',
      models: [],
    });
    setShowAddPlatformModal(false);
  };

  const handleAddModel = () => {
    if (!newModel.id) {
      alert('请填写模型ID');
      return;
    }
    
    if (!newModelPlatformId) {
      alert('请选择目标平台');
      return;
    }
    
    const platform = config.platforms.find(p => p.id === newModelPlatformId);
    if (!platform) {
      alert('所选平台不存在');
      return;
    }
    
    const currentModels = platform.models || [];
    if (currentModels.some(m => m.id === newModel.id)) {
      alert('该模型ID已存在');
      return;
    }
    
    handlePlatformUpdate(newModelPlatformId, 'models', [...currentModels, newModel]);
    resetModelForm();
    setNewModelPlatformId(null);
    setShowAddModelModal(false);
  };

  const handleEditModel = () => {
    if (!newModel.id || !editingPlatformId) {
      alert('请填写模型ID');
      return;
    }
    
    const platform = config.platforms.find(p => p.id === editingPlatformId);
    if (platform) {
      const updatedModels = platform.models.map(m => 
        m.id === editingModelId ? { ...newModel } : m
      );
      handlePlatformUpdate(editingPlatformId, 'models', updatedModels);
    }
    
    resetModelForm();
    setShowEditModelModal(false);
    setEditingModelId(null);
    setEditingPlatformId(null);
  };

  const handleRemoveModel = (platformId: string, modelId: string) => {
    const platform = config.platforms.find(p => p.id === platformId);
    if (platform) {
      const updatedModels = platform.models.filter(m => m.id !== modelId);
      handlePlatformUpdate(platformId, 'models', updatedModels);
      if (platform.defaultModel === modelId) {
        handlePlatformUpdate(platformId, 'defaultModel', updatedModels[0]?.id || '');
      }
    }
  };

  const handleModeToggle = (mode: GenerationMode) => {
    setNewModel(prev => ({
      ...prev,
      supportedModes: prev.supportedModes.includes(mode)
        ? prev.supportedModes.filter(m => m !== mode)
        : [...prev.supportedModes, mode],
    }));
  };

  const handleApiFormatToggle = (format: ApiFormatType) => {
    setNewModel(prev => ({
      ...prev,
      supportedApiFormats: prev.supportedApiFormats.includes(format)
        ? prev.supportedApiFormats.filter(f => f !== format)
        : [...prev.supportedApiFormats, format],
    }));
  };

  const resetModelForm = () => {
    setNewModel({
      id: '',
      name: '',
      label: '',
      supportedModes: ['text'],
      supportedApiFormats: ['unified'],
      parameterConstraints: [],
    });
  };

  const openEditModelModal = (model: ModelInfo, platformId: string) => {
    setNewModel({ ...model });
    setEditingModelId(model.id);
    setEditingPlatformId(platformId);
    setShowEditModelModal(true);
  };

  const showVersionDiff = (history: VersionHistory) => {
    setDiffHistory(history);
    setShowDiffModal(true);
  };

  const [pendingNewParams, setPendingNewParams] = useState<string[]>([]);
  const [pendingDeletedParams, setPendingDeletedParams] = useState<string[]>([]);
  const [showSyncIndicator, setShowSyncIndicator] = useState(false);

  const checkForUpdates = (model: ModelInfo): { newParams: string[]; deletedParams: string[]; hasUpdate: boolean } => {
    if (!model.modelConfigId) {
      return { newParams: [], deletedParams: [], hasUpdate: false };
    }

    const config = modelConfigManager.getConfig(model.modelConfigId);
    if (!config) {
      return { newParams: [], deletedParams: [], hasUpdate: false };
    }

    const currentVersion = config.version || 1;
    const modelVersion = model.modelConfigVersion || 0;

    if (currentVersion <= modelVersion) {
      return { newParams: [], deletedParams: [], hasUpdate: false };
    }

    const existingConstraints = model.parameterConstraints || [];
    const existingParams = existingConstraints.map(c => c.unifiedParam);
    const currentParams = config.parameterMappings.map(m => m.unifiedParam);

    const newParams = currentParams.filter(p => !existingParams.includes(p));

    const deletedParams = existingParams.filter(p => !currentParams.includes(p));

    return {
      newParams,
      deletedParams,
      hasUpdate: newParams.length > 0 || deletedParams.length > 0,
    };
  };

  const openConstraintModal = (model: ModelInfo, platformId: string) => {
    const modelWithConstraints = { ...model };

    const updateInfo = checkForUpdates(model);
    setPendingNewParams(updateInfo.newParams);
    setPendingDeletedParams(updateInfo.deletedParams);
    setShowSyncIndicator(updateInfo.hasUpdate);
    setSelectedNewParams([]);

    setSelectedModelForConstraints(modelWithConstraints);
    setConstraintPlatformId(platformId);
    setShowConstraintModal(true);
  };

  const [selectedNewParams, setSelectedNewParams] = useState<string[]>([]);

  const mergeSelectedParams = () => {
    if (!selectedModelForConstraints || selectedNewParams.length === 0) return;

    setSelectedModelForConstraints(prev => {
      if (!prev) return prev;

      const config = prev.modelConfigId ? modelConfigManager.getConfig(prev.modelConfigId) : null;

      const newConstraints = selectedNewParams.map(param => {
        const mapping = config?.parameterMappings.find(m => m.unifiedParam === param);
        return {
          unifiedParam: param,
          enabled: true,
          hidden: mapping ? !mapping.showInUI : false,
        };
      });

      const currentParams = config?.parameterMappings.map(m => m.unifiedParam) || [];

      const currentModelVersion = prev.modelConfigVersion || 0;
      const nextModelVersion = currentModelVersion + 1;

      const history: VersionHistory = {
        version: nextModelVersion,
        syncedAt: Date.now(),
        description: `合并新增 ${selectedNewParams.length} 个参数`,
        paramsSnapshot: currentParams,
      };

      return {
        ...prev,
        parameterConstraints: [
          ...(prev.parameterConstraints || []),
          ...newConstraints,
        ],
        modelConfigVersion: nextModelVersion,
        versionHistory: [history, ...(prev.versionHistory || [])],
      };
    });

    setPendingNewParams(prev => prev.filter(p => !selectedNewParams.includes(p)));
    setSelectedNewParams([]);
    if (pendingNewParams.length === selectedNewParams.length && pendingDeletedParams.length === 0) {
      setShowSyncIndicator(false);
    }
  };

  const mergeAllNewParams = () => {
    if (!selectedModelForConstraints || pendingNewParams.length === 0) return;

    setSelectedModelForConstraints(prev => {
      if (!prev) return prev;

      const config = prev.modelConfigId ? modelConfigManager.getConfig(prev.modelConfigId) : null;

      const newConstraints = pendingNewParams.map(param => {
        const mapping = config?.parameterMappings.find(m => m.unifiedParam === param);
        return {
          unifiedParam: param,
          enabled: true,
          hidden: mapping ? !mapping.showInUI : false,
        };
      });

      const currentParams = config?.parameterMappings.map(m => m.unifiedParam) || [];

      const currentModelVersion = prev.modelConfigVersion || 0;
      const nextModelVersion = currentModelVersion + 1;

      const history: VersionHistory = {
        version: nextModelVersion,
        syncedAt: Date.now(),
        description: `合并新增 ${pendingNewParams.length} 个参数`,
        paramsSnapshot: currentParams,
      };

      return {
        ...prev,
        parameterConstraints: [
          ...(prev.parameterConstraints || []),
          ...newConstraints,
        ],
        modelConfigVersion: nextModelVersion,
        versionHistory: [history, ...(prev.versionHistory || [])],
      };
    });

    setPendingNewParams([]);
    setSelectedNewParams([]);
    if (pendingDeletedParams.length === 0) {
      setShowSyncIndicator(false);
    }
  };

  const removeDeletedParams = () => {
    if (!selectedModelForConstraints || pendingDeletedParams.length === 0) return;
    
    setSelectedModelForConstraints(prev => {
      if (!prev) return prev;
      
      const config = prev.modelConfigId ? modelConfigManager.getConfig(prev.modelConfigId) : null;
      const currentParams = config?.parameterMappings.map(m => m.unifiedParam) || [];
      
      const currentModelVersion = prev.modelConfigVersion || 0;
      const nextModelVersion = currentModelVersion + 1;
      
      const history: VersionHistory = {
        version: nextModelVersion,
        syncedAt: Date.now(),
        description: `手动清理：删除 ${pendingDeletedParams.length} 个参数`,
        paramsSnapshot: currentParams,
      };
      
      return {
        ...prev,
        parameterConstraints: (prev.parameterConstraints || []).filter(
          c => !pendingDeletedParams.includes(c.unifiedParam)
        ),
        modelConfigVersion: nextModelVersion,
        versionHistory: [history, ...(prev.versionHistory || [])],
      };
    });
    
    setPendingDeletedParams([]);
    setShowSyncIndicator(false);
  };

  const keepDeletedParams = () => {
    setPendingDeletedParams([]);
    if (pendingNewParams.length === 0) {
      setShowSyncIndicator(false);
    }
  };

  const saveConstraints = () => {
    if (!selectedModelForConstraints || !constraintPlatformId) return;

    const modelConfig = selectedModelForConstraints.modelConfigId ? modelConfigManager.getConfig(selectedModelForConstraints.modelConfigId) : null;

    let finalConstraints = [...(selectedModelForConstraints.parameterConstraints || [])];

    if (pendingNewParams.length > 0) {
      const newConstraints = pendingNewParams.map(param => {
        const mapping = modelConfig?.parameterMappings.find(m => m.unifiedParam === param);
        return {
          unifiedParam: param,
          enabled: true,
          hidden: mapping ? !mapping.showInUI : false,
        };
      });
      finalConstraints = [...finalConstraints, ...newConstraints];
    }

    const platform = config.platforms.find(p => p.id === constraintPlatformId);
    if (platform) {
      const originalModel = platform.models.find(m => m.id === selectedModelForConstraints.id);
      const hasChanges = !originalModel ||
        JSON.stringify(originalModel.parameterConstraints) !== JSON.stringify(finalConstraints);
      
      let updatedModel = { ...selectedModelForConstraints };
      
      if (hasChanges) {
        const currentModelVersion = selectedModelForConstraints.modelConfigVersion || 0;
        const nextModelVersion = currentModelVersion + 1;
        const currentParams = finalConstraints?.map(c => c.unifiedParam) || [];

        const history: VersionHistory = {
          version: nextModelVersion,
          syncedAt: Date.now(),
          description: '手动编辑保存',
          paramsSnapshot: currentParams,
        };

        updatedModel = {
          ...updatedModel,
          parameterConstraints: finalConstraints,
          modelConfigVersion: nextModelVersion,
          versionHistory: [history, ...(updatedModel.versionHistory || [])],
        };
      }
      
      const updatedModels = platform.models.map(m => 
        m.id === updatedModel.id ? updatedModel : m
      );
      handlePlatformUpdate(constraintPlatformId, 'models', updatedModels);
    }
    setShowConstraintModal(false);
    setSelectedModelForConstraints(null);
    setConstraintPlatformId(null);
    setPendingNewParams([]);
    setPendingDeletedParams([]);
    setShowSyncIndicator(false);
  };

  const updateModelConstraint = (unifiedParam: string, updates: Partial<ParameterConstraint>) => {
    if (!selectedModelForConstraints) return;
    
    setSelectedModelForConstraints(prev => ({
      ...prev!,
      parameterConstraints: (prev?.parameterConstraints || []).map((constraint) =>
        constraint.unifiedParam === unifiedParam ? { ...constraint, ...updates } : constraint
      ),
    }));
  };

  const deleteModelConstraint = (index: number) => {
    if (!selectedModelForConstraints) return;
    
    setSelectedModelForConstraints(prev => ({
      ...prev!,
      parameterConstraints: (prev?.parameterConstraints || []).filter((_, i) => i !== index),
    }));
  };

  const deleteVersion = (index: number) => {
    if (!selectedModelForConstraints) return;
    
    if (confirm('确定要删除此版本吗？此操作不可撤销。')) {
      setSelectedModelForConstraints(prev => ({
        ...prev!,
        versionHistory: (prev?.versionHistory || []).filter((_, i) => i !== index),
      }));
    }
  };

  const restoreFromVersion = (history: VersionHistory) => {
    if (!selectedModelForConstraints || !history.paramsSnapshot) return;
    
    if (confirm(`确定要还原到版本 ${history.version} 吗？当前的参数约束将被替换为该版本的状态。`)) {
      const currentModelVersion = selectedModelForConstraints.modelConfigVersion || 0;
      const nextModelVersion = currentModelVersion + 1;
      
      const paramsSnapshot = history.paramsSnapshot || [];
      const newConstraints = paramsSnapshot.map(param => {
        const existing = (selectedModelForConstraints.parameterConstraints || []).find(
          c => c.unifiedParam === param
        );
        return existing || { unifiedParam: param };
      });
      
      const newHistory: VersionHistory = {
        version: nextModelVersion,
        syncedAt: Date.now(),
        description: `从版本 ${history.version} 还原`,
        paramsSnapshot: paramsSnapshot,
        restoredFromVersion: history.version,
      };
      
      setSelectedModelForConstraints(prev => ({
        ...prev!,
        parameterConstraints: newConstraints,
        modelConfigVersion: nextModelVersion,
        versionHistory: [newHistory, ...(prev?.versionHistory || [])],
      }));
      
      alert(`已成功还原到版本 ${history.version}`);
    }
  };

  const generationModes: { value: GenerationMode; label: string }[] = [
    { value: 'text', label: '文生视频' },
    { value: 'image', label: '图生视频' },
    { value: 'imageTail', label: '首尾帧' },
    { value: 'multiImage', label: '多图生成' },
  ];

  const getMappedParams = () => {
    if (!selectedModelForConstraints?.modelConfigId) return [];
    const config = modelConfigManager.getConfig(selectedModelForConstraints.modelConfigId);
    return config?.parameterMappings || [];
  };

  getMappedParams();

  const getConstraintsForMode = (mode: GenerationMode) => {
    return (selectedModelForConstraints?.parameterConstraints || []).filter(c => {
      if (c.enabled === false) return false;
      if (c.modes && c.modes.length > 0 && !c.modes.includes(mode)) return false;
      return true;
    });
  };

  const generatePreviewJson = (mode: GenerationMode) => {
    const constraints = getConstraintsForMode(mode);
    const mappedParams = getMappedParams();

    const getConstraintValue = (paramName: string) => {
      const constraint = constraints.find(c => c.unifiedParam === paramName);
      if (!constraint) return { hasConstraint: false, value: undefined };

      if (constraint.hidden) {
        return {
          hasConstraint: true,
          value: constraint.fixed !== undefined ? constraint.fixed : '__HIDDEN_WITHOUT_FIXED__',
        };
      }
      if (constraint.fixed !== undefined) return { hasConstraint: true, value: constraint.fixed };
      if (constraint.defaultValue !== undefined) return { hasConstraint: true, value: constraint.defaultValue };
      return { hasConstraint: false, value: undefined };
    };

    const getEmptyValue = (paramType?: string) => {
      if (paramType === 'number') return 0;
      if (paramType === 'boolean') return false;
      if (paramType === 'array') return [];
      if (paramType === 'object') return {};
      return '';
    };

    const preview: Record<string, any> = {
      model: selectedModelForConstraints?.id || '',
    };

    for (const mapping of mappedParams) {
      const constraint = constraints.find(c => c.unifiedParam === mapping.unifiedParam);
      if (!constraint) continue;
      if (constraint.enabled === false) continue;

      const { hasConstraint, value } = getConstraintValue(mapping.unifiedParam);

      if (value === '__HIDDEN_WITHOUT_FIXED__') {
        preview[mapping.unifiedParam] = '🔒 <hidden>';
      } else if (hasConstraint) {
        preview[mapping.unifiedParam] = value;
      } else {
        preview[mapping.unifiedParam] = getEmptyValue(mapping.paramType);
      }
    }

    return preview;
  };

  const filteredConstraints = (selectedModelForConstraints?.parameterConstraints || []).filter(c => {
    const matchesSearch = c.unifiedParam.toLowerCase().includes(constraintSearchQuery.toLowerCase());
    const hasConstraint = c.hidden || c.fixed !== undefined || c.enumValues?.length || c.defaultValue !== undefined;
    const matchesType = constraintFilterType === 'all' || 
      (constraintFilterType === 'hidden' && c.hidden) ||
      (constraintFilterType === 'fixed' && c.fixed !== undefined) ||
      (constraintFilterType === 'constrained' && hasConstraint);
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">系统配置</h2>
          <div className="flex gap-3 items-center">
            {saveSuccess && (
              <div className="flex items-center gap-2 px-3 py-2 text-green-600 bg-green-100 rounded-lg">
                <CheckCircle className="w-4 h-4" />
                保存成功
              </div>
            )}
            <button
              onClick={loadConfig}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </button>
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const importedConfig = JSON.parse(event.target?.result as string);
                        if (confirm('确定要导入配置吗？')) {
                          updateConfig(importedConfig);
                          alert('导入成功！请保存配置。');
                        }
                      } catch {
                        alert('配置文件格式无效');
                      }
                    };
                    reader.readAsText(file);
                  }
                };
                input.click();
              }}
              className="flex items-center gap-2 px-3 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              导入
            </button>
            <button
              onClick={() => {
                const configStr = JSON.stringify(config, null, 2);
                const blob = new Blob([configStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `video_gen_config_${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 px-3 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <Save className="w-4 h-4" />
              导出
            </button>
            <button
              onClick={saveConfig}
              className="flex items-center gap-2 px-3 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Save className="w-4 h-4" />
              保存
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md mb-4 overflow-hidden">
          <div
            onClick={() => toggleSectionExpand('global')}
            className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              全局配置
            </h3>
            {expandedSections.includes('global') ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
          
          {expandedSections.includes('global') && (
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">图床 Cookie (CK)</label>
                <input
                  type="text"
                  value={config.uploadCk}
                  onChange={(e) => updateConfig({ uploadCk: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="用于图片上传转公网链接（极客智坊图床）"
                />
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-700 mb-4">下载设置</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-700">下载路径</div>
                      <div className="text-xs text-gray-500 mt-1">视频将自动下载到此路径</div>
                    </div>
                    <button
                      onClick={handleSelectDownloadPath}
                      className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <FolderOpen className="w-4 h-4" />
                      选择
                    </button>
                  </div>
                  {config.downloadPath && (
                    <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg font-mono break-all">
                      {config.downloadPath}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-700">自动下载</div>
                      <div className="text-xs text-gray-500 mt-1">开启后，视频生成成功将自动下载到指定路径</div>
                    </div>
                    <button
                      onClick={() => handleChange('autoDownload', !config.autoDownload)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        config.autoDownload ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-1 right-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          config.autoDownload ? 'translate-x-0' : '-translate-x-6'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-xl shadow-md overflow-hidden mt-4">
          <div
            onClick={() => toggleSectionExpand('platforms')}
            className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <Server className="w-5 h-5" />
              平台管理
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddPlatformModal(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                添加平台
              </button>
              {expandedSections.includes('platforms') ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </div>
          </div>
          
          {expandedSections.includes('platforms') && (
            <div className="p-6">
              <div className="space-y-3">
                {config.platforms.map(platform => (
                  <div key={platform.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div
                      onClick={() => togglePlatformExpand(platform.id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${platform.id === config.activePlatformId ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div className="text-left">
                          <div className="font-semibold text-gray-800">{platform.name}</div>
                          <div className="text-sm text-gray-500">{platform.baseUrl}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePlatform(platform.id);
                          }}
                          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                            platform.id === config.activePlatformId
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {platform.id === config.activePlatformId ? '当前' : '设为当前'}
                        </button>
                        {config.platforms.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`确定要删除平台 "${platform.name}" 吗？`)) {
                                removePlatform(platform.id);
                              }
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {expandedPlatforms.includes(platform.id) ? (
                          <ChevronUp className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                    </div>
                    
                    {expandedPlatforms.includes(platform.id) && (
                      <div className="p-4 space-y-4 bg-white">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">平台名称</label>
                            <input
                              type="text"
                              value={platform.name}
                              onChange={(e) => handlePlatformUpdate(platform.id, 'name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">基础 URL</label>
                            <input
                              type="text"
                              value={platform.baseUrl}
                              onChange={(e) => handlePlatformUpdate(platform.id, 'baseUrl', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                          <input
                            type="password"
                            value={platform.apiKey}
                            onChange={(e) => handlePlatformUpdate(platform.id, 'apiKey', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="请输入API Key"
                          />
                        </div>
                        
                        <div className="border-t border-gray-200 pt-4">
                          <h4 className="font-medium text-gray-700 mb-3">接口配置</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">创建视频接口</label>
                              <input
                                type="text"
                                value={platform.endpoints.createVideo}
                                onChange={(e) => handlePlatformUpdate(platform.id, 'endpoints', {
                                  ...platform.endpoints,
                                  createVideo: e.target.value
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">查询任务接口</label>
                              <input
                                type="text"
                                value={platform.endpoints.queryTask}
                                onChange={(e) => handlePlatformUpdate(platform.id, 'endpoints', {
                                  ...platform.endpoints,
                                  queryTask: e.target.value
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
                              />
                            </div>
                          </div>
                          {platform.endpoints.downloadVideo && (
                            <div className="mt-3">
                              <label className="block text-sm font-medium text-gray-700 mb-1">下载视频接口</label>
                              <input
                                type="text"
                                value={platform.endpoints.downloadVideo}
                                onChange={(e) => handlePlatformUpdate(platform.id, 'endpoints', {
                                  ...platform.endpoints,
                                  downloadVideo: e.target.value
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono"
                              />
                            </div>
                          )}
                        </div>

                        <div className="border-t border-gray-200 pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-700">模型列表</h4>
                            <button
                              onClick={() => {
                                setNewModelPlatformId(platform.id);
                                setShowAddModelModal(true);
                              }}
                              className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-700"
                            >
                              <Plus className="w-4 h-4" />
                              添加模型
                            </button>
                          </div>
                          <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                            <div className="grid grid-cols-2 gap-3">
                              {platform.models.map(model => (
                                <div
                                  key={model.id}
                                  className={`p-3 rounded-lg border transition-colors ${
                                    platform.defaultModel === model.id
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium text-gray-800 font-mono text-sm">{model.id}</div>
                                      {model.price && (
                                        <div className="text-xs text-green-600 mt-0.5">💰 {model.price}</div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handlePlatformUpdate(platform.id, 'defaultModel', model.id)}
                                        className={`text-xs px-2 py-1 rounded transition-colors ${
                                          platform.defaultModel === model.id
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                        }`}
                                      >
                                        {platform.defaultModel === model.id ? '默认' : '设为默认'}
                                      </button>
                                      <button
                                        onClick={() => openEditModelModal(model, platform.id)}
                                        className="p-1 text-gray-400 hover:text-blue-500"
                                        title="编辑"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      {model.modelConfigId && (
                                        <button
                                          onClick={() => openConstraintModal(model, platform.id)}
                                          className="p-1 text-gray-400 hover:text-purple-500"
                                          title="参数约束"
                                        >
                                          <Settings className="w-4 h-4" />
                                        </button>
                                      )}
                                      {platform.models.length > 1 && (
                                        <button
                                          onClick={() => handleRemoveModel(platform.id, model.id)}
                                          className="p-1 text-gray-400 hover:text-red-500"
                                          title="删除"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {model.supportedModes.map(mode => (
                                      <span
                                        key={mode}
                                        className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
                                      >
                                        {generationModes.find(m => m.value === mode)?.label || mode}
                                      </span>
                                    ))}
                                    {(model.supportedApiFormats || ['unified']).map(format => (
                                      <span
                                        key={format}
                                        className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded"
                                      >
                                        {format === 'unified' ? '统一格式' : 'OpenAI'}
                                      </span>
                                    ))}
                                    {model.modelConfigId && (
                                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-600 rounded">已关联</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">注意事项</p>
              <ul className="mt-2 space-y-1 list-disc list-inside text-amber-700">
                <li>每个平台都有独立的API Key和Cookie配置</li>
                <li>选择平台后，生成页面将使用该平台的配置</li>
                <li>配置修改后需点击"保存配置"生效</li>
                <li>自动下载需先设置下载路径</li>
                <li>模型支持的生成模式需要正确配置</li>
                <li>在模型列表点击设置图标可打开参数约束配置弹窗</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {showAddPlatformModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">添加新平台</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">平台ID</label>
                <input
                  type="text"
                  value={newPlatform.id || ''}
                  onChange={(e) => setNewPlatform(prev => ({ ...prev, id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="如: myplatform"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">平台名称</label>
                <input
                  type="text"
                  value={newPlatform.name || ''}
                  onChange={(e) => setNewPlatform(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="如: 我的平台"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">基础URL</label>
                <input
                  type="text"
                  value={newPlatform.baseUrl || ''}
                  onChange={(e) => setNewPlatform(prev => ({ ...prev, baseUrl: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="如: https://api.example.com"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddPlatformModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAddPlatform}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">添加新模型</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目标平台</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                  {config.platforms.find(p => p.id === newModelPlatformId)?.name || '未知平台'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型ID</label>
                <input
                  type="text"
                  value={newModel.id}
                  onChange={(e) => setNewModel(prev => ({ ...prev, id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
                  placeholder="如: veo-3.1-fast"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">价格描述</label>
                <input
                  type="text"
                  value={newModel.price || ''}
                  onChange={(e) => setNewModel(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="如: ¥0.01/秒"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">支持的生成模式</label>
                <div className="flex flex-wrap gap-2">
                  {generationModes.map(mode => (
                    <button
                      key={mode.value}
                      onClick={() => handleModeToggle(mode.value)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        newModel.supportedModes.includes(mode.value)
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">支持的API格式</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleApiFormatToggle('unified')}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      newModel.supportedApiFormats.includes('unified')
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    统一格式
                  </button>
                  <button
                    onClick={() => handleApiFormatToggle('openai')}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      newModel.supportedApiFormats.includes('openai')
                        ? 'border-purple-500 bg-purple-50 text-purple-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    OpenAI格式
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关联模型配置</label>
                <select
                  value={newModel.modelConfigId || ''}
                  onChange={(e) => setNewModel(prev => ({ ...prev, modelConfigId: e.target.value || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">不关联（使用默认配置）</option>
                  {modelConfigs.map(config => (
                    <option key={config.modelId} value={config.modelId}>
                      {config.modelName}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  选择一个模型配置，该模型将使用所选配置的参数映射规则
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModelModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAddModel}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">编辑模型</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型ID</label>
                <input
                  type="text"
                  value={newModel.id}
                  onChange={(e) => setNewModel(prev => ({ ...prev, id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
                  placeholder="如: veo-3.1-fast"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">价格描述</label>
                <input
                  type="text"
                  value={newModel.price || ''}
                  onChange={(e) => setNewModel(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="如: ¥0.01/秒"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">支持的生成模式</label>
                <div className="flex flex-wrap gap-2">
                  {generationModes.map(mode => (
                    <button
                      key={mode.value}
                      onClick={() => handleModeToggle(mode.value)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        newModel.supportedModes.includes(mode.value)
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">支持的API格式</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleApiFormatToggle('unified')}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      newModel.supportedApiFormats.includes('unified')
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    统一格式
                  </button>
                  <button
                    onClick={() => handleApiFormatToggle('openai')}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      newModel.supportedApiFormats.includes('openai')
                        ? 'border-purple-500 bg-purple-50 text-purple-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    OpenAI格式
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关联模型配置</label>
                <select
                  value={newModel.modelConfigId || ''}
                  onChange={(e) => setNewModel(prev => ({ ...prev, modelConfigId: e.target.value || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="">不关联（使用默认配置）</option>
                  {modelConfigs.map(config => (
                    <option key={config.modelId} value={config.modelId}>
                      {config.modelName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModelModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleEditModel}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {showConstraintModal && selectedModelForConstraints && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">参数约束配置</h3>
                <p className="text-sm text-gray-500 mt-0.5">模型: {selectedModelForConstraints.id}</p>
              </div>
              <button
                onClick={() => setShowConstraintModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={constraintSearchQuery}
                      onChange={(e) => setConstraintSearchQuery(e.target.value)}
                      placeholder="搜索参数..."
                      className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-64"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                      value={constraintFilterType}
                      onChange={(e) => setConstraintFilterType(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="all">全部</option>
                      <option value="hidden">已隐藏</option>
                      <option value="fixed">已固定</option>
                      <option value="constrained">有约束</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedModelForConstraints.autoSyncConfig !== false}
                    onChange={(e) => {
                      setSelectedModelForConstraints(prev => ({
                        ...prev!,
                        autoSyncConfig: e.target.checked,
                      }));
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">自动同步</span>
                </label>
                
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-500">
                    当前版本: <span className="font-medium">{selectedModelForConstraints.modelConfigVersion || 0}</span>
                  </div>

                  <button
                    onClick={() => setShowJsonPreview(!showJsonPreview)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      showJsonPreview
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <FileJson className="w-4 h-4" />
                    请求结构
                  </button>

                  {(selectedModelForConstraints.versionHistory?.length || 0) > 0 && (
                    <button
                      onClick={() => setShowVersionHistory(!showVersionHistory)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        showVersionHistory
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <History className="w-4 h-4" />
                      版本历史
                      <span className="ml-1 text-xs opacity-75">({selectedModelForConstraints.versionHistory?.length || 0})</span>
                    </button>
                  )}
                </div>
              </div>
              
              {showSyncIndicator && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <RefreshCw className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">检测到模型配置更新</span>
                    {pendingNewParams.length > 0 && (
                      <button
                        onClick={mergeAllNewParams}
                        className="ml-2 px-2 py-0.5 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                      >
                        合并全部新增
                      </button>
                    )}
                    {pendingDeletedParams.length > 0 && (
                      <>
                        <button
                          onClick={removeDeletedParams}
                          className="ml-1 px-2 py-0.5 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                        >
                          清理删除
                        </button>
                        <button
                          onClick={keepDeletedParams}
                          className="ml-1 px-2 py-0.5 bg-gray-400 text-white rounded text-xs hover:bg-gray-500 transition-colors"
                        >
                          保留删除
                        </button>
                      </>
                    )}
                  </div>
                  <div className="space-y-2 text-xs">
                    {pendingNewParams.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-green-600">+ 新增 {pendingNewParams.length} 个参数</span>
                          {selectedNewParams.length > 0 && (
                            <button
                              onClick={mergeSelectedParams}
                              className="px-2 py-0.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                            >
                              合并选中 ({selectedNewParams.length})
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 ml-4">
                          {pendingNewParams.map(param => (
                            <label key={param} className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={selectedNewParams.includes(param)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedNewParams(prev => [...prev, param]);
                                  } else {
                                    setSelectedNewParams(prev => prev.filter(p => p !== param));
                                  }
                                }}
                                className="w-3 h-3 rounded text-green-600"
                              />
                              <span className="text-gray-700">{param}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {pendingDeletedParams.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-red-600">- 已删除 {pendingDeletedParams.length} 个参数</span>
                        <span className="text-gray-400 text-xs">（约束中仍保留）</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {showJsonPreview && (
                <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">请求结构预览</span>
                    <div className="flex items-center gap-1">
                      {generationModes.map(mode => (
                        <button
                          key={mode.value}
                          onClick={() => setPreviewMode(mode.value)}
                          className={`px-2 py-1 rounded text-xs transition-colors ${
                            previewMode === mode.value
                              ? 'bg-green-500 text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 overflow-auto max-h-48">
                    <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono">
                      {JSON.stringify(generatePreviewJson(previewMode), null, 2)}
                    </pre>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="text-gray-400">注：</span>
                    实际请求时用户输入的参数将替换此处留空的值
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                  {filteredConstraints.length === 0 ? (
                    <div className="text-center py-8">
                      <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">暂无约束配置</p>
                      <p className="text-gray-400 text-sm mt-1">该模型未关联模型配置，无法显示参数</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredConstraints.map((constraint, index) => {
                        const mappedParams = getMappedParams();
                        const paramMapping = mappedParams.find(m => m.unifiedParam === constraint.unifiedParam);
                        const paramLabel = paramMapping?.uiLabel || paramMapping?.description || constraint.unifiedParam;
                        const isExpanded = expandedConstraints.has(constraint.unifiedParam);
                        
                        return (
                          <div key={index} className="bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div 
                              className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50 cursor-pointer"
                              onClick={() => {
                                setExpandedConstraints(prev => {
                                  const next = new Set(prev);
                                  if (next.has(constraint.unifiedParam)) {
                                    next.delete(constraint.unifiedParam);
                                  } else {
                                    next.add(constraint.unifiedParam);
                                  }
                                  return next;
                                });
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <ChevronDown 
                                  className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                />
                                <code className="text-sm font-semibold text-gray-800">{constraint.unifiedParam}</code>
                                <span className="text-xs text-gray-500">({paramLabel})</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteModelConstraint(index);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  title="删除约束"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div 
                              className={`overflow-hidden transition-all duration-200 ${
                                isExpanded ? 'max-h-none opacity-100' : 'max-h-0 opacity-0'
                              }`}
                            >
                              <div className="p-3 space-y-3">
                                <div className="flex flex-wrap items-center gap-4 border-b border-gray-100 pb-3">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500 mr-1">启用:</span>
                                    <button
                                      onClick={() => updateModelConstraint(constraint.unifiedParam, { enabled: true })}
                                      className={`p-2 rounded-lg transition-all ${
                                        constraint.enabled !== false
                                          ? 'bg-green-100 text-green-600'
                                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                      }`}
                                      title="启用参数 - 参数将作为请求参数发送（隐藏时需填写固定值）"
                                    >
                                      <Power className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => updateModelConstraint(constraint.unifiedParam, { enabled: false })}
                                      className={`p-2 rounded-lg transition-all ${
                                        constraint.enabled === false
                                          ? 'bg-red-100 text-red-600'
                                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                      }`}
                                      title="禁用参数 - 参数不作为请求参数，UI也不显示"
                                    >
                                      <Power className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs text-gray-500 ml-1">
                                      {constraint.enabled === false ? '已禁用' : '已启用'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500 mr-1">显示:</span>
                                    <button
                                      onClick={() => updateModelConstraint(constraint.unifiedParam, { hidden: false })}
                                      className={`p-2 rounded-lg transition-all ${
                                        !constraint.hidden && constraint.enabled !== false
                                          ? 'bg-blue-100 text-blue-600'
                                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                      }`}
                                      title="UI显示 - 参数将在生成页面显示"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => updateModelConstraint(constraint.unifiedParam, { hidden: true })}
                                      className={`p-2 rounded-lg transition-all ${
                                        constraint.hidden || constraint.enabled === false
                                          ? 'bg-red-100 text-red-600'
                                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                      }`}
                                      title="隐藏参数 - 参数将不显示在UI中（启用时需填写固定值）"
                                    >
                                      <EyeOff className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs text-gray-500 ml-1">
                                      {constraint.enabled === false ? '已禁用' : (constraint.hidden ? '已隐藏' : '显示')}
                                    </span>
                                  </div>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={constraint.fixed !== undefined}
                                      onChange={(e) => {
                                        if (e.target.checked && !constraint.fixed) {
                                          updateModelConstraint(constraint.unifiedParam, { fixed: '' });
                                        } else {
                                          updateModelConstraint(constraint.unifiedParam, { fixed: undefined });
                                        }
                                      }}
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                    />
                                <span className="text-sm text-gray-700">固定值</span>
                                    {constraint.enabled === true && constraint.hidden && constraint.fixed === undefined && (
                                      <span className="text-xs text-red-500 ml-2">隐藏启用状态必须填写固定值</span>
                                    )}
                                  </label>
                                  {constraint.fixed !== undefined && (
                                <input
                                  type="text"
                                  value={String(constraint.fixed)}
                                  onChange={(e) => updateModelConstraint(constraint.unifiedParam, { fixed: e.target.value })}
                                  className="px-2 py-1 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-32"
                                  placeholder="固定值"
                                />
                              )}
                              {paramMapping && (
                                <label className="flex items-center gap-2 cursor-pointer ml-auto">
                                  <input
                                    type="checkbox"
                                    checked={constraint.useModelDefaults || false}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        updateModelConstraint(constraint.unifiedParam, { 
                                          useModelDefaults: true,
                                          defaultValue: paramMapping.defaultValue,
                                          enumValues: paramMapping.enumValues,
                                          presetOptions: paramMapping.presetOptions,
                                        });
                                      } else {
                                        updateModelConstraint(constraint.unifiedParam, { useModelDefaults: false });
                                      }
                                    }}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-blue-600 font-medium">使用模型默认</span>
                                </label>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">可选值</label>
                                {constraint.useModelDefaults && paramMapping?.enumValues ? (
                                  <div className="px-3 py-2 text-sm bg-gray-100 rounded-md text-gray-600">
                                    {paramMapping.enumValues.join(', ')}
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    value={constraint.enumValues?.join(',') || ''}
                                    onChange={(e) => {
                                      const values = e.target.value.split(',').map(v => v.trim()).filter(v => v);
                                      updateModelConstraint(constraint.unifiedParam, { enumValues: values.length > 0 ? values : undefined });
                                    }}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="逗号分隔多个值"
                                  />
                                )}
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">默认值</label>
                                {constraint.useModelDefaults && paramMapping?.defaultValue !== undefined ? (
                                  <div className="px-3 py-2 text-sm bg-gray-100 rounded-md text-gray-600">
                                    {String(paramMapping.defaultValue)}
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    value={constraint.defaultValue !== undefined ? String(constraint.defaultValue) : ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateModelConstraint(constraint.unifiedParam, { defaultValue: val === '' ? undefined : val });
                                    }}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="参数默认值"
                                  />
                                )}
                              </div>
                            </div>
                            <div className="mt-3">
                              <label className="block text-xs font-medium text-gray-500 mb-1">预设选项（逗号分隔）</label>
                              {constraint.useModelDefaults && paramMapping?.presetOptions ? (
                                <div className="px-3 py-2 text-sm bg-gray-100 rounded-md text-gray-600">
                                  {paramMapping.presetOptions.map(o => o.label).join(', ')}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={(constraint.presetOptions || []).map(o => o.label).join(', ')}
                                  onChange={(e) => {
                                    const values = e.target.value.split(',').map(v => v.trim()).filter(v => v);
                                    const options = values.map(v => ({ label: v, value: v }));
                                    updateModelConstraint(constraint.unifiedParam, { presetOptions: options.length > 0 ? options : undefined });
                                  }}
                                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                  placeholder="选项1, 选项2, 选项3"
                                />
                              )}
                            </div>
                            
                            <div className="pt-2 border-t border-gray-100">
                              <label className="block text-xs font-medium text-gray-500 mb-2">
                                适用模式
                                {!constraint.modes?.length && (
                                  <span className="font-normal text-gray-400 ml-1">（未选择，约束适用于所有模式）</span>
                                )}
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {generationModes.map(mode => (
                                  <button
                                    key={mode.value}
                                    onClick={() => {
                                      const currentModes = constraint.modes || [];
                                      const newModes = currentModes.includes(mode.value)
                                        ? currentModes.filter(m => m !== mode.value)
                                        : [...currentModes, mode.value];
                                      updateModelConstraint(constraint.unifiedParam, { modes: newModes.length > 0 ? newModes : undefined });
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                      (constraint.modes || []).includes(mode.value)
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                  >
                                    {mode.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {(selectedModelForConstraints.versionHistory?.length || 0) > 0 && (
                <div className={`border-l border-gray-200 transition-all duration-200 ${showVersionHistory ? 'w-72' : 'w-0'}`}>
                  <div className={`h-full flex flex-col bg-gray-50 overflow-hidden ${showVersionHistory ? 'w-72' : 'w-0'}`}>
                    <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-white">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">版本历史</span>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                          {selectedModelForConstraints.versionHistory?.length || 0}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowVersionHistory(false)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    
                    <div className="p-2 border-b border-gray-200">
                      <input
                        type="text"
                        value={versionFilterQuery}
                        onChange={(e) => setVersionFilterQuery(e.target.value)}
                        placeholder="筛选版本..."
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {selectedModelForConstraints.versionHistory
                        ?.filter(h => {
                          if (!versionFilterQuery) return true;
                          const query = versionFilterQuery.toLowerCase();
                          return (
                            h.version.toString().includes(query) ||
                            h.description?.toLowerCase().includes(query) ||
                            new Date(h.syncedAt).toLocaleString('zh-CN').includes(query)
                          );
                        })
                        .map((history, index) => (
                          <div key={index} className="p-2 bg-white rounded-lg border border-gray-100 hover:shadow-sm transition-shadow">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                history.restoredFromVersion ? 'bg-green-500' : 'bg-blue-500'
                              }`}></div>
                              <span className="text-sm font-medium text-gray-800">v{history.version}</span>
                              <span className="text-xs text-gray-400">
                                {new Date(history.syncedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            {history.restoredFromVersion && (
                              <div className="text-xs text-green-600 mb-1">
                                ← 从v{history.restoredFromVersion}还原
                              </div>
                            )}
                            {history.description && (
                              <p className="text-xs text-gray-500 mb-2 line-clamp-2">{history.description}</p>
                            )}
                            <div className="flex items-center gap-1">
                              {history.paramsSnapshot && history.paramsSnapshot.length > 0 && (
                                <button
                                  onClick={() => showVersionDiff(history)}
                                  className="flex-1 text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                                >
                                  比对
                                </button>
                              )}
                              <button
                                onClick={() => restoreFromVersion(history)}
                                className="flex-1 text-xs px-2 py-1 bg-amber-100 text-amber-600 rounded hover:bg-amber-200 transition-colors"
                              >
                                还原
                              </button>
                              <button
                                onClick={() => deleteVersion(index)}
                                className="text-xs px-1.5 py-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="删除版本"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowConstraintModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveConstraints}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                保存约束
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiffModal && diffHistory && selectedModelForConstraints && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[70vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">版本差异比对</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  版本 {diffHistory.version} vs 当前版本
                </p>
              </div>
              <button
                onClick={() => setShowDiffModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[55vh]">
              {diffHistory.paramsSnapshot && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      历史版本 {diffHistory.version}
                    </h4>
                    <div className="space-y-1 max-h-[30vh] overflow-y-auto">
                      {diffHistory.paramsSnapshot.map((param, index) => (
                        <div key={index} className="text-xs text-gray-600">
                          {param}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      当前版本
                    </h4>
                    <div className="space-y-1 max-h-[30vh] overflow-y-auto">
                      {selectedModelForConstraints.parameterConstraints?.map((constraint, index) => (
                        <div key={index} className="text-xs text-gray-600">
                          {constraint.unifiedParam}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {diffHistory.paramsSnapshot && selectedModelForConstraints.parameterConstraints && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-700 mb-2">差异分析</h4>
                  <div className="space-y-2">
                    {(() => {
                      const historyParams = diffHistory.paramsSnapshot || [];
                      const currentParams = selectedModelForConstraints.parameterConstraints.map(c => c.unifiedParam);
                      const added = currentParams.filter(p => !historyParams.includes(p));
                      const removed = historyParams.filter(p => !currentParams.includes(p));

                      return (
                        <>
                          {added.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-green-600 font-medium">+ 新增:</span>
                              <span className="text-xs text-gray-600">{added.join(', ')}</span>
                            </div>
                          )}
                          {removed.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs text-red-600 font-medium">- 删除:</span>
                              <span className="text-xs text-gray-600">{removed.join(', ')}</span>
                            </div>
                          )}
                          {added.length === 0 && removed.length === 0 && (
                            <div className="text-xs text-gray-500">参数无变化</div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigPage;
