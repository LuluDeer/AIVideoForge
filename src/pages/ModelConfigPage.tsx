import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Settings, Download, Upload, Copy, Check, Filter, Search, Grid, List, X, Zap, Tag, Hash, Type, ListOrdered, Trash, CheckSquare, Square } from 'lucide-react';
import modelConfigManager from '../services/modelConfigManager';
import type { ModelParameterConfig, ParameterMapping } from '../types/modelConfig';

const ModelConfigPage: React.FC = () => {
  const [configs, setConfigs] = useState<ModelParameterConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<ModelParameterConfig | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'table'>('table');
  const [filterParamType, setFilterParamType] = useState<string>('all');
  const [filterUiType, setFilterUiType] = useState<string>('all');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'index' | 'unifiedParam' | 'paramType'>('index');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedConfigs, setSelectedConfigs] = useState<string[]>([]);
  const [selectedMappings, setSelectedMappings] = useState<number[]>([]);
  const [expandedMappings, setExpandedMappings] = useState<number[]>([]);
  
  const [hasDraft, setHasDraft] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = useCallback(() => {
    setConfigs(modelConfigManager.getAllConfigs());
    setSelectedConfigs([]);
    setSelectedMappings([]);
  }, []);

  const handleAddConfig = () => {
    const newConfig: ModelParameterConfig = {
      modelId: `param_config_${Date.now()}`,
      modelName: '新参数配置',
      parameterMappings: [],
    };
    modelConfigManager.addConfig(newConfig);
    loadConfigs();
    setSelectedConfig(newConfig);
  };

  const handleUpdateConfig = (modelId: string, updates: Partial<ModelParameterConfig>) => {
    if (selectedConfig?.modelId === modelId) {
      setSelectedConfig(prev => {
        if (!prev) return prev;
        return { ...prev, ...updates };
      });
    }
    setHasDraft(true);
  };

  const handleDeleteConfig = (modelId: string) => {
    if (confirm('确定要删除这个参数配置吗？')) {
      modelConfigManager.deleteConfig(modelId);
      loadConfigs();
      if (selectedConfig?.modelId === modelId) {
        setSelectedConfig(null);
      }
    }
  };

  const handleBatchDeleteConfigs = () => {
    if (selectedConfigs.length === 0) return;
    if (confirm(`确定要删除选中的 ${selectedConfigs.length} 个参数配置吗？`)) {
      selectedConfigs.forEach(id => modelConfigManager.deleteConfig(id));
      loadConfigs();
    }
  };

  const handleSelectConfig = (config: ModelParameterConfig) => {
    setSelectedConfig(config);
    setSelectedMappings([]);
  };

  const handleAddMapping = () => {
    if (!selectedConfig) return;

    const newMapping: ParameterMapping = {
      unifiedParam: '',
      modelParam: '',
      paramType: 'string',
      required: false,
      showInUI: true,
    };

    const updatedConfig = {
      ...selectedConfig,
      parameterMappings: [...selectedConfig.parameterMappings, newMapping],
    };

    handleUpdateConfig(selectedConfig.modelId, updatedConfig);
    setSelectedMappings([]);
  };

  const handleUpdateMapping = (index: number, updates: Partial<ParameterMapping>) => {
    if (!selectedConfig) return;

    const updatedMappings = [...selectedConfig.parameterMappings];
    updatedMappings[index] = { ...updatedMappings[index], ...updates };

    handleUpdateConfig(selectedConfig.modelId, { parameterMappings: updatedMappings });
  };

  const handleDeleteMapping = (index: number) => {
    if (!selectedConfig) return;

    const updatedMappings = selectedConfig.parameterMappings.filter((_, i) => i !== index);
    handleUpdateConfig(selectedConfig.modelId, { parameterMappings: updatedMappings });
    setSelectedMappings(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const handleBatchDeleteMappings = () => {
    if (!selectedConfig || selectedMappings.length === 0) return;
    if (confirm(`确定要删除选中的 ${selectedMappings.length} 个参数吗？`)) {
      const updatedMappings = selectedConfig.parameterMappings.filter((_, i) => !selectedMappings.includes(i));
      handleUpdateConfig(selectedConfig.modelId, { parameterMappings: updatedMappings });
      setSelectedMappings([]);
    }
  };

  const handleReorderMappings = (fromIndex: number, toIndex: number) => {
    if (!selectedConfig) return;
    
    const updatedMappings = [...selectedConfig.parameterMappings];
    const [removed] = updatedMappings.splice(fromIndex, 1);
    updatedMappings.splice(toIndex, 0, removed);
    
    handleUpdateConfig(selectedConfig.modelId, { parameterMappings: updatedMappings });
    setSelectedMappings(prev => prev.map(i => {
      if (i === fromIndex) return toIndex;
      if (fromIndex < toIndex) {
        return i > fromIndex && i <= toIndex ? i - 1 : i;
      } else {
        return i >= toIndex && i < fromIndex ? i + 1 : i;
      }
    }));
  };

  const handleExportConfigs = () => {
    const jsonData = modelConfigManager.exportConfigs();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `param_configs_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfigs = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (modelConfigManager.importConfigs(content)) {
          alert('导入成功');
          loadConfigs();
        } else {
          alert('导入失败');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleCopyParamName = (paramName: string) => {
    navigator.clipboard.writeText(paramName);
    setCopySuccess(paramName);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  const handleSaveDraft = () => {
    if (selectedConfig) {
      modelConfigManager.updateConfig(selectedConfig.modelId, selectedConfig);
      loadConfigs();
      setHasDraft(false);
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2000);
    }
  };

  const handleResetDraft = () => {
    if (selectedConfig) {
      const savedConfig = modelConfigManager.getConfig(selectedConfig.modelId);
      if (savedConfig) {
        setSelectedConfig(savedConfig);
      }
    }
    setHasDraft(false);
  };

  const toggleSelectAllConfigs = () => {
    if (selectedConfigs.length === filteredConfigs.length) {
      setSelectedConfigs([]);
    } else {
      setSelectedConfigs(filteredConfigs.map(c => c.modelId));
    }
  };

  const toggleSelectConfig = (modelId: string) => {
    setSelectedConfigs(prev => 
      prev.includes(modelId) ? prev.filter(id => id !== modelId) : [...prev, modelId]
    );
  };

  const toggleSelectAllMappings = () => {
    if (!selectedConfig) return;
    const filtered = filteredAndSortedMappings;
    if (selectedMappings.length === filtered.length) {
      setSelectedMappings([]);
    } else {
      setSelectedMappings(filtered.map((item) => selectedConfig!.parameterMappings.indexOf(item)));
    }
  };

  const toggleSelectMapping = (originalIndex: number) => {
    setSelectedMappings(prev =>
      prev.includes(originalIndex) ? prev.filter(i => i !== originalIndex) : [...prev, originalIndex]
    );
  };

  const filteredConfigs = configs.filter(config =>
    config.modelName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAndSortedMappings = (selectedConfig?.parameterMappings.filter(mapping => {
    if (filterParamType !== 'all' && mapping.paramType !== filterParamType) return false;
    if (filterUiType !== 'all' && mapping.uiType !== filterUiType) return false;
    return true;
  }) || []).sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'index':
        comparison = 0;
        break;
      case 'unifiedParam':
        comparison = (a.unifiedParam || '').localeCompare(b.unifiedParam || '');
        break;
      case 'paramType':
        comparison = (a.paramType || '').localeCompare(b.paramType || '');
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const paramTypes = [
    { value: 'all', label: '全部' },
    { value: 'string', label: '字符串' },
    { value: 'number', label: '数字' },
    { value: 'boolean', label: '布尔值' },
    { value: 'array', label: '数组' },
    { value: 'object', label: '对象' },
  ];

  const uiTypes = [
    { value: 'all', label: '全部' },
    { value: 'input', label: '输入框' },
    { value: 'select', label: '下拉选择' },
    { value: 'checkbox', label: '复选框' },
    { value: 'number', label: '数字输入' },
    { value: 'textarea', label: '多行文本' },
    { value: 'image', label: '图片选择' },
    { value: 'image-multi', label: '多图选择' },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">参数配置管理</h1>
              <p className="text-gray-500 text-sm mt-1">管理模型参数映射规则（与具体平台模型解耦）</p>
            </div>
            {hasDraft && (
              <button
                onClick={handleResetDraft}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition text-sm border border-gray-200"
              >
                <X size={14} />
                重置（恢复上次保存）
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportConfigs}
              className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm border border-gray-200"
            >
              <Download size={14} />
              导出配置
            </button>
            <label className="inline-flex items-center justify-center gap-2 min-w-[92px] px-3 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition cursor-pointer text-sm font-normal outline-none focus:outline-none border border-gray-200">
              <Upload size={14} />
              导入配置
              <input type="file" accept=".json" onChange={handleImportConfigs} className="hidden" />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 space-y-3">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Settings size={16} />
                  参数配置列表
                  <span className="ml-auto text-xs text-gray-400">{configs.length} 个</span>
                </h2>
                {selectedConfigs.length > 0 && (
                  <button
                    onClick={handleBatchDeleteConfigs}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition"
                  >
                    <Trash size={12} />
                    删除选中 ({selectedConfigs.length})
                  </button>
                )}
              </div>
              
              <div className="p-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索配置..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                {filteredConfigs.length === 0 ? (
                  <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center mx-2">
                    <Settings size={32} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 text-sm mb-1">暂无参数配置</p>
                    <p className="text-gray-400 text-xs">点击右上角开始配置</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-2 py-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleSelectAllConfigs}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          {selectedConfigs.length === filteredConfigs.length ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                        <span className="text-xs text-gray-500">全选</span>
                      </div>
                      <button
                        onClick={handleAddConfig}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs"
                      >
                        <Plus size={12} />
                        新增
                      </button>
                    </div>
                    {filteredConfigs.map((config, index) => {
                      const isSelected = selectedConfig?.modelId === config.modelId;
                      const isChecked = selectedConfigs.includes(config.modelId);

                      return (
                        <div
                          key={config.modelId}
                          className={`flex items-center justify-between p-3 border rounded-lg transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-500/15 ring-1 ring-blue-200'
                              : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                          }`}
                          onClick={() => handleSelectConfig(config)}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectConfig(config.modelId);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                            </button>
                            <div className={`w-7 h-7 rounded flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${
                              isSelected ? 'bg-blue-600' : 'bg-gray-400'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className={`text-sm font-medium truncate ${
                                isSelected ? 'text-blue-800' : 'text-gray-700'
                              }`}>
                                {config.modelName}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {config.parameterMappings.length} 个参数
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConfig(config.modelId);
                            }}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="删除配置"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-9 space-y-4">
            {selectedConfig ? (
              <>
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <input
                        type="text"
                        value={selectedConfig.modelName}
                        onChange={(e) => handleUpdateConfig(selectedConfig.modelId, { modelName: e.target.value })}
                        className="text-xl font-bold bg-transparent border-b-2 border-transparent hover:border-white/30 focus:border-white/50 outline-none transition"
                        placeholder="配置名称"
                      />
                      <div className="flex items-center gap-4 mt-1 text-blue-100 text-sm">
                        <span className="flex items-center gap-1">
                          <ListOrdered size={12} />
                          {selectedConfig.parameterMappings.length} 个参数
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setViewMode(viewMode === 'list' ? 'table' : 'list')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition text-sm"
                    >
                      {viewMode === 'list' ? <Grid size={14} /> : <List size={14} />}
                      {viewMode === 'list' ? '表格视图' : '列表视图'}
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-4">
                        <h3 className="font-semibold text-gray-800">参数列表</h3>
                        <div className="flex items-center gap-2">
                          <Filter size={14} className="text-gray-500" />
                          <select
                            value={filterParamType}
                            onChange={(e) => setFilterParamType(e.target.value)}
                            className="text-sm px-2 py-1 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                          >
                            {paramTypes.map(type => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                          <select
                            value={filterUiType}
                            onChange={(e) => setFilterUiType(e.target.value)}
                            className="text-sm px-2 py-1 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                          >
                            {uiTypes.map(type => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="text-xs">排序:</span>
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="text-xs px-2 py-1 border border-gray-200 rounded"
                          >
                            <option value="index">序号</option>
                            <option value="unifiedParam">参数名</option>
                            <option value="paramType">类型</option>
                          </select>
                          <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedMappings.length > 0 && (
                          <button
                            onClick={handleBatchDeleteMappings}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition"
                          >
                            <Trash size={12} />
                            删除选中 ({selectedMappings.length})
                          </button>
                        )}
                        <button
                          onClick={handleAddMapping}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                        >
                          <Plus size={14} />
                          添加参数
                        </button>
                      </div>
                    </div>
                  </div>

                  {viewMode === 'table' ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 sticky top-0">
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-8">
                              <button onClick={toggleSelectAllMappings} className="text-gray-400 hover:text-gray-600">
                                {selectedMappings.length === filteredAndSortedMappings.length && filteredAndSortedMappings.length > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
                              </button>
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-8">#</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-10"></th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                              <div className="flex items-center gap-1">
                                <Tag size={12} />
                                统一参数名
                                <span className="text-gray-400 ml-1">(系统内部标识)</span>
                              </div>
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                              <div className="flex items-center gap-1">
                                <Hash size={12} />
                                模型参数名
                                <span className="text-gray-400 ml-1">(API字段名)</span>
                              </div>
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                              <div className="flex items-center gap-1">
                                <Type size={12} />
                                参数类型
                              </div>
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">UI类型</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">显示</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">必填</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredAndSortedMappings.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="px-4 py-12 text-center">
                                <Settings size={48} className="mx-auto text-gray-300 mb-4" />
                                <p className="text-gray-500 mb-2">暂无参数</p>
                                <p className="text-gray-400 text-sm">点击上方按钮添加参数</p>
                              </td>
                            </tr>
                          ) : (
                            filteredAndSortedMappings.map((mapping, index) => {
                              const originalIndex = selectedConfig.parameterMappings.indexOf(mapping);
                              const isSelected = selectedMappings.includes(originalIndex);
                              return (
                                <tr key={index} className={`hover:bg-gray-50 transition ${isSelected ? 'bg-blue-50' : ''}`}>
                                  <td className="px-4 py-3">
                                    <button onClick={() => toggleSelectMapping(originalIndex)} className="text-gray-400 hover:text-gray-600">
                                      {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-500 font-medium">
                                    {originalIndex + 1}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => originalIndex > 0 && handleReorderMappings(originalIndex, originalIndex - 1)}
                                        className={`p-1 rounded transition ${
                                          originalIndex > 0 
                                            ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' 
                                            : 'text-gray-200 cursor-not-allowed'
                                        }`}
                                        title="上移"
                                      >
                                        <ChevronUp size={14} />
                                      </button>
                                      <button
                                        onClick={() => originalIndex < selectedConfig.parameterMappings.length - 1 && handleReorderMappings(originalIndex, originalIndex + 1)}
                                        className={`p-1 rounded transition ${
                                          originalIndex < selectedConfig.parameterMappings.length - 1 
                                            ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' 
                                            : 'text-gray-200 cursor-not-allowed'
                                        }`}
                                        title="下移"
                                      >
                                        <ChevronDown size={14} />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={mapping.unifiedParam}
                                        onChange={(e) => handleUpdateMapping(originalIndex, { unifiedParam: e.target.value })}
                                        className="w-full max-w-[140px] px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="系统参数名"
                                      />
                                      <button
                                        onClick={() => handleCopyParamName(mapping.unifiedParam)}
                                        className="p-1 text-gray-400 hover:text-blue-600 transition"
                                        title="复制"
                                      >
                                        {copySuccess === mapping.unifiedParam ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={mapping.modelParam}
                                      onChange={(e) => handleUpdateMapping(originalIndex, { modelParam: e.target.value })}
                                      className="w-full max-w-[140px] px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                      placeholder="API字段名"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <select
                                      value={mapping.paramType}
                                      onChange={(e) => handleUpdateMapping(originalIndex, { paramType: e.target.value as any })}
                                      className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                      <option value="string">字符串</option>
                                      <option value="number">数字</option>
                                      <option value="boolean">布尔值</option>
                                      <option value="array">数组</option>
                                      <option value="object">对象</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-3">
                                    <select
                                      value={mapping.uiType || 'input'}
                                      onChange={(e) => handleUpdateMapping(originalIndex, { uiType: e.target.value as any })}
                                      className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                      {uiTypes.filter(t => t.value !== 'all').map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => handleUpdateMapping(originalIndex, { showInUI: !mapping.showInUI })}
                                      className={`p-1.5 rounded-lg transition ${
                                        mapping.showInUI ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                                      }`}
                                      title={mapping.showInUI ? '隐藏' : '显示'}
                                    >
                                      {mapping.showInUI ? <Check size={14} /> : <X size={14} />}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => handleUpdateMapping(originalIndex, { required: !mapping.required })}
                                      className={`p-1.5 rounded-lg transition ${
                                        mapping.required ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'
                                      }`}
                                      title={mapping.required ? '可选' : '必填'}
                                    >
                                      {mapping.required ? <Zap size={14} /> : <Zap size={14} className="opacity-30" />}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => handleDeleteMapping(originalIndex)}
                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                      title="删除"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {filteredAndSortedMappings.length === 0 ? (
                        <div className="text-center py-12">
                          <Settings size={48} className="mx-auto text-gray-300 mb-4" />
                          <p className="text-gray-500 mb-2">暂无参数</p>
                          <p className="text-gray-400 text-sm">点击上方按钮添加参数</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredAndSortedMappings.map((mapping) => {
                            const originalIndex = selectedConfig.parameterMappings.indexOf(mapping);
                            const isSelected = selectedMappings.includes(originalIndex);
                            const isExpanded = expandedMappings.includes(originalIndex);
                            
                            return (
                              <div key={`${mapping.unifiedParam || `param-${originalIndex}`}-${originalIndex}`} className={`border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
                                <div 
                                  className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                                  onClick={() => setExpandedMappings(prev => 
                                    prev.includes(originalIndex) 
                                      ? prev.filter(i => i !== originalIndex)
                                      : [...prev, originalIndex]
                                  )}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSelectMapping(originalIndex);
                                      }} 
                                      className="p-1 text-gray-400 hover:text-gray-600"
                                    >
                                      {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                    </button>
                                    <div className="flex flex-col items-center gap-0.5">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          originalIndex > 0 && handleReorderMappings(originalIndex, originalIndex - 1);
                                        }}
                                        className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                                        title="上移"
                                      >
                                        <ChevronUp size={12} />
                                      </button>
                                      <span className="text-xs text-gray-500 font-medium w-5 text-center">{originalIndex + 1}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          originalIndex < selectedConfig.parameterMappings.length - 1 && handleReorderMappings(originalIndex, originalIndex + 1);
                                        }}
                                        className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                                        title="下移"
                                      >
                                        <ChevronDown size={12} />
                                      </button>
                                    </div>
                                    <div className="w-6 h-6 bg-gray-200 rounded-md flex items-center justify-center text-xs font-medium text-gray-600">
                                      {mapping.paramType.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-medium text-gray-800 truncate">{mapping.unifiedParam || '未命名参数'}</span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCopyParamName(mapping.unifiedParam);
                                          }}
                                          className="p-0.5 text-gray-400 hover:text-blue-600 transition"
                                          title="复制"
                                        >
                                          {copySuccess === mapping.unifiedParam ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                        </button>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                        <span className="text-xs text-gray-500">API: {mapping.modelParam || '-'}</span>
                                        <span className="text-xs px-1.5 py-0.25 bg-gray-200 rounded">{mapping.paramType}</span>
                                        <span className={`text-xs px-1.5 py-0.25 rounded ${
                                          mapping.uiType === 'image'
                                            ? 'bg-purple-100 text-purple-600'
                                            : 'bg-blue-100 text-blue-600'
                                        }`}>
                                          {uiTypes.find(t => t.value === mapping.uiType)?.label || mapping.uiType}
                                        </span>
                                        {mapping.required && (
                                          <span className="text-xs px-1.5 py-0.25 bg-red-100 text-red-600 rounded">必填</span>
                                        )}
                                        {mapping.showInUI && (
                                          <span className="text-xs px-1.5 py-0.25 bg-green-100 text-green-600 rounded">显示</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateMapping(originalIndex, { showInUI: !mapping.showInUI });
                                      }}
                                      className={`px-2 py-0.5 rounded-md text-xs transition ${
                                        mapping.showInUI ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      {mapping.showInUI ? '显示' : '隐藏'}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteMapping(originalIndex);
                                      }}
                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition"
                                      title="删除"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                    <ChevronDown 
                                      size={14} 
                                      className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                    />
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="p-3 bg-white border-t border-gray-100 space-y-3">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">统一参数名 <span className="text-gray-400">(系统内部标识)</span></label>
                                        <input
                                        type="text"
                                        value={mapping.unifiedParam}
                                        onChange={(e) => handleUpdateMapping(originalIndex, { unifiedParam: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="如: prompt"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">模型参数名 <span className="text-gray-400">(API字段名)</span></label>
                                      <input
                                        type="text"
                                        value={mapping.modelParam}
                                        onChange={(e) => handleUpdateMapping(originalIndex, { modelParam: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="如: text_prompt"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">参数类型</label>
                                      <select
                                        value={mapping.paramType}
                                        onChange={(e) => handleUpdateMapping(originalIndex, { paramType: e.target.value as any })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="string">字符串</option>
                                        <option value="number">数字</option>
                                        <option value="boolean">布尔值</option>
                                        <option value="array">数组</option>
                                        <option value="object">对象</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">UI类型</label>
                                      <select
                                        value={mapping.uiType || 'input'}
                                        onChange={(e) => handleUpdateMapping(originalIndex, { uiType: e.target.value as any })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      >
                                        {uiTypes.filter(t => t.value !== 'all').map(type => (
                                          <option key={type.value} value={type.value}>{type.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">默认值</label>
                                      {mapping.paramType === 'boolean' ? (
                                        <select
                                          value={mapping.defaultValue !== undefined ? String(mapping.defaultValue) : ''}
                                          onChange={(e) => {
                                            handleUpdateMapping(originalIndex, { defaultValue: e.target.value === 'true' });
                                          }}
                                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        >
                                          <option value="">请选择</option>
                                          <option value="true">true</option>
                                          <option value="false">false</option>
                                        </select>
                                      ) : (
                                        <input
                                          type="text"
                                          value={mapping.defaultValue !== undefined ? String(mapping.defaultValue) : ''}
                                          onChange={(e) => {
                                            let val: any = e.target.value;
                                            if (mapping.paramType === 'number') val = parseFloat(val);
                                            handleUpdateMapping(originalIndex, { defaultValue: val });
                                          }}
                                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                          placeholder="默认值"
                                        />
                                      )}
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">UI标签 <span className="text-gray-400">(显示给用户)</span></label>
                                      <input
                                        type="text"
                                        value={mapping.uiLabel || ''}
                                        onChange={(e) => handleUpdateMapping(originalIndex, { uiLabel: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="如：提示词"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={mapping.showInUI || false}
                                        onChange={(e) => handleUpdateMapping(originalIndex, { showInUI: e.target.checked })}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      显示在UI
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={mapping.required || false}
                                        onChange={(e) => handleUpdateMapping(originalIndex, { required: e.target.checked })}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      必填参数
                                    </label>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">可选项（逗号分隔）</label>
                                      <input
                                        type="text"
                                        defaultValue={(mapping.enumValues || []).join(', ')}
                                        onBlur={(e) => {
                                          const values = e.target.value.split(',').map(v => v.trim()).filter(v => v);
                                          handleUpdateMapping(originalIndex, { enumValues: values.length > 0 ? values : undefined });
                                        }}
                                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="选项1, 选项2, 选项3"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">预设选项（逗号分隔）</label>
                                      <input
                                        type="text"
                                        defaultValue={(mapping.presetOptions || []).map(o => o.label).join(', ')}
                                        onBlur={(e) => {
                                          const values = e.target.value.split(',').map(v => v.trim()).filter(v => v);
                                          const options = values.map(v => ({ label: v, value: v }));
                                          handleUpdateMapping(originalIndex, { presetOptions: options.length > 0 ? options : undefined });
                                        }}
                                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="选项1, 选项2, 选项3"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">描述 <span className="text-gray-400">(UI提示)</span></label>
                                    <input
                                      type="text"
                                      value={mapping.description || ''}
                                      onChange={(e) => handleUpdateMapping(originalIndex, { description: e.target.value })}
                                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      placeholder="参数说明（用于UI提示）"
                                    />
                                  </div>
                                </div>
                              )}
                              </div> // 这是修复的关键：添加了缺失的闭合标签
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">使用说明</h4>
                    <ul className="text-xs text-blue-600 space-y-1">
                      <li>• <strong>统一参数名</strong>: 系统内部使用的标准参数标识，用于跨平台参数映射</li>
                      <li>• <strong>模型参数名</strong>: API接口实际接收的字段名</li>
                      <li>• <strong>UI类型=图片/多图</strong>: 在视频生成页面选择图片时自动通过图床转URL</li>
                      <li>• <strong>可选项/预设选项</strong>: 在此配置默认值，可在平台模型约束中二次调整</li>
                      <li>• 在系统配置的平台模型中关联此配置后，可对参数进行约束（隐藏、固定值等）</li>
                    </ul>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <Settings size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">请选择一个参数配置进行编辑</p>
              </div>
            )}
          </div>
        </div>
        
        {hasDraft && selectedConfig && (
          <div className="fixed bottom-6 right-6 z-50">
            <button
              onClick={handleSaveDraft}
              className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 transition-all hover:scale-105"
            >
              <Check size={18} />
              保存修改
            </button>
          </div>
        )}
        
        {showSaveToast && (
          <div className="fixed top-6 right-6 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <Check size={18} />
            保存成功
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelConfigPage;