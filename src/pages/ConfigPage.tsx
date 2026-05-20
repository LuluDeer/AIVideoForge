import React, { useState } from 'react';
import { Save, RotateCcw, AlertCircle, CheckCircle, FolderOpen, Plus, Trash2, ChevronDown, ChevronUp, Settings, Server } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import type { PlatformConfig, ModelInfo, ApiEndpoints, GenerationMode, ApiFormatType } from '../types';

const ConfigPage: React.FC = () => {
  const { config, updateConfig, saveConfig, loadConfig, saveSuccess, updatePlatform, addPlatform, removePlatform, setActivePlatform, activePlatform } = useConfig();
  const [expandedPlatforms, setExpandedPlatforms] = useState<string[]>([config.activePlatformId]);
  const [showAddPlatformModal, setShowAddPlatformModal] = useState(false);
  const [showAddModelModal, setShowAddModelModal] = useState(false);
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
  });
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [showEditModelModal, setShowEditModelModal] = useState(false);

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
    if (!newModel.id || !newModel.name) {
      alert('请填写模型ID和名称');
      return;
    }
    
    const currentModels = activePlatform.models || [];
    if (currentModels.some(m => m.id === newModel.id)) {
      alert('该模型ID已存在');
      return;
    }
    
    handlePlatformUpdate(activePlatform.id, 'models', [...currentModels, newModel]);
    resetModelForm();
    setShowAddModelModal(false);
  };

  const handleEditModel = () => {
    if (!newModel.id || !newModel.name) {
      alert('请填写模型ID和名称');
      return;
    }
    
    const platform = config.platforms.find(p => p.id === activePlatform.id);
    if (platform) {
      const updatedModels = platform.models.map(m => 
        m.id === editingModelId ? { ...newModel } : m
      );
      handlePlatformUpdate(activePlatform.id, 'models', updatedModels);
    }
    
    resetModelForm();
    setShowEditModelModal(false);
    setEditingModelId(null);
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
    });
  };

  const openEditModelModal = (model: ModelInfo) => {
    setNewModel({ ...model });
    setEditingModelId(model.id);
    setShowEditModelModal(true);
  };

  const generationModes: { value: GenerationMode; label: string }[] = [
    { value: 'text', label: '文生视频' },
    { value: 'image', label: '图生视频' },
    { value: 'imageTail', label: '首尾帧' },
    { value: 'multiImage', label: '多图生成' },
  ];

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
            <div className="p-6 space-y-6">
            
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
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">API格式</label>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handlePlatformUpdate(platform.id, 'apiFormat', 'unified')}
                            className={`px-4 py-2 rounded-lg border transition-colors ${
                              platform.apiFormat === 'unified'
                                ? 'border-blue-500 bg-blue-50 text-blue-600'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            统一视频格式
                          </button>
                          <button
                            onClick={() => handlePlatformUpdate(platform.id, 'apiFormat', 'openai')}
                            className={`px-4 py-2 rounded-lg border transition-colors ${
                              platform.apiFormat === 'openai'
                                ? 'border-blue-500 bg-blue-50 text-blue-600'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            OpenAI 视频格式
                          </button>
                        </div>
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
                        <h4 className="font-medium text-gray-700 mb-3">功能开关</h4>
                        <div className="flex flex-wrap gap-3">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={platform.enableEnhancePrompt || false}
                              onChange={(e) => handlePlatformUpdate(platform.id, 'enableEnhancePrompt', e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">提示词增强</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={platform.enableUpsample || false}
                              onChange={(e) => handlePlatformUpdate(platform.id, 'enableUpsample', e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">超分</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={platform.enableWatermark || false}
                              onChange={(e) => handlePlatformUpdate(platform.id, 'enableWatermark', e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">水印</span>
                          </label>
                        </div>
                      </div>
                      
                      <div className="border-t border-gray-200 pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-700">模型列表</h4>
                          {platform.id === config.activePlatformId && (
                            <button
                              onClick={() => setShowAddModelModal(true)}
                              className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-700"
                            >
                              <Plus className="w-4 h-4" />
                              添加模型
                            </button>
                          )}
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
                                  <div className="font-medium text-gray-800">{model.name}</div>
                                  <div className="text-xs text-gray-500 font-mono">{model.id}</div>
                                </div>
                                <div className="flex items-center gap-2">
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
                                  {platform.id === config.activePlatformId && (
                                    <button
                                      onClick={() => openEditModelModal(model)}
                                      className="p-1 text-gray-400 hover:text-blue-500"
                                      title="编辑"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">API格式</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setNewPlatform(prev => ({ ...prev, apiFormat: 'unified' }))}
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                      newPlatform.apiFormat === 'unified'
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    统一视频格式
                  </button>
                  <button
                    onClick={() => setNewPlatform(prev => ({ ...prev, apiFormat: 'openai' }))}
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                      newPlatform.apiFormat === 'openai'
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    OpenAI 格式
                  </button>
                </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">模型ID</label>
                <input
                  type="text"
                  value={newModel.id}
                  onChange={(e) => setNewModel(prev => ({ ...prev, id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="如: veo-3.1-fast"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型名称</label>
                <input
                  type="text"
                  value={newModel.name}
                  onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="如: Veo 3.1 Fast"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">显示标签</label>
                <input
                  type="text"
                  value={newModel.label}
                  onChange={(e) => setNewModel(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="如: Veo 3.1 Fast (推荐)"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">支持的API格式</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleApiFormatToggle('unified')}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      newModel.supportedApiFormats.includes('unified')
                        ? 'border-purple-500 bg-purple-50 text-purple-600'
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
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  resetModelForm();
                  setShowAddModelModal(false);
                }}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="如: veo-3.1-fast"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型名称</label>
                <input
                  type="text"
                  value={newModel.name}
                  onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="如: Veo 3.1 Fast"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">显示标签</label>
                <input
                  type="text"
                  value={newModel.label}
                  onChange={(e) => setNewModel(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="如: Veo 3.1 Fast (推荐)"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">支持的API格式</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleApiFormatToggle('unified')}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      newModel.supportedApiFormats.includes('unified')
                        ? 'border-purple-500 bg-purple-50 text-purple-600'
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
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  resetModelForm();
                  setShowEditModelModal(false);
                  setEditingModelId(null);
                }}
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
    </div>
  );
};

export default ConfigPage;
