import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Key, Layers, Settings2, Trash2 } from 'lucide-react';
import AppSelect from '../../components/AppSelect';
import { buildDefaultParams } from '../../services/modelTemplates';
import type { ApiEndpoints, ApiFormatType, CustomModelDef, CustomPlatformDef, ParamDef } from '../../types';
import { API_FORMATS } from './constants';
import CustomModelManager from './CustomModelManager';
import ParamSchemaEditor from './ParamSchemaEditor';
import { defaultEndpointsForFormat } from './utils';

const CustomPlatformCard: React.FC<{
  platform: CustomPlatformDef;
  onUpdate: (updates: Partial<CustomPlatformDef>) => void;
  onRemove: () => void;
}> = ({ platform, onUpdate, onRemove }) => {
  const [expanded, setExpanded] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [tab, setTab] = useState<'basic' | 'models' | 'params'>('basic');
  const models = platform.models ?? [];

  const updateEndpoints = (updates: Partial<ApiEndpoints>) => onUpdate({ endpoints: { ...platform.endpoints, ...updates } });
  const updateFormat = (format: ApiFormatType) => {
    onUpdate({ apiFormat: format, endpoints: defaultEndpointsForFormat(format) });
  };
  const updateModels = (nextModels: CustomModelDef[], defaultModel = platform.defaultModel) => onUpdate({ models: nextModels, defaultModel });
  const updateModelParams = (modelId: string, params: ParamDef[]) => {
    updateModels(models.map(model => model.id === modelId ? { ...model, params } : model));
  };

  return (
    <div className="border border-orange-200 rounded-xl bg-white shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3 bg-orange-50/70">
        <button type="button" onClick={() => setExpanded(v => !v)} className="rounded-lg p-1 text-orange-500 hover:bg-orange-100">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${platform.disabled ? 'bg-red-400 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]' : 'bg-green-400 shadow-[0_0_0_4px_rgba(34,197,94,0.12)]'}`} title={platform.disabled ? '平台已停用' : '平台已启用'} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-normal text-gray-800 break-words">{platform.name || '自定义平台'}</p>
          <p className="text-xs leading-normal text-gray-400 break-all">{platform.baseUrl || '未填写 Base URL'}</p>
        </div>
        <span className="inline-flex min-h-6 items-center rounded-md bg-white px-2 py-0.5 text-xs leading-normal text-orange-600 border border-orange-100">{platform.apiFormat}</span>
        <button type="button" role="switch" aria-checked={!platform.disabled} onClick={() => onUpdate({ disabled: !platform.disabled })} className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-orange-100 ${platform.disabled ? 'border-red-200 bg-red-100' : 'border-green-200 bg-green-500'}`} title={platform.disabled ? '启用平台' : '停用平台'}>
          <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${platform.disabled ? 'translate-x-0.5' : 'translate-x-5'}`} />
        </button>
        <button onClick={onRemove} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500" title="删除平台">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {expanded && (
        <div>
          <div className="flex flex-wrap gap-1 bg-gray-50 border-y border-gray-100 px-2 pt-2">
            {([['basic', '基础配置', Key], ['models', '模型管理', Layers], ['params', '参数设置', Settings2]] as const).map(([targetTab, label, Icon]) => (
              <button key={targetTab} onClick={() => setTab(targetTab)} className={`inline-flex min-h-10 items-center gap-1.5 rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium leading-normal ${tab === targetTab ? 'border-orange-200 text-orange-700 bg-white' : 'border-transparent text-gray-500 hover:bg-white hover:text-gray-700'}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
          <div className="p-4">
            {tab === 'basic' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs leading-normal text-gray-500">平台 ID</label>
                    <input value={platform.id} onChange={e => onUpdate({ id: e.target.value.trim() })} className="w-full min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-orange-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs leading-normal text-gray-500">平台名称</label>
                    <input value={platform.name} onChange={e => onUpdate({ name: e.target.value })} className="w-full min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-orange-100" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs leading-normal text-gray-500">Base URL</label>
                  <input type="url" value={platform.baseUrl} onChange={e => onUpdate({ baseUrl: e.target.value })} placeholder="https://api.example.com" className="w-full min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-100" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs leading-normal text-gray-500">API Key</label>
                  <div className="relative">
                    <input type={showKey ? 'text' : 'password'} value={platform.apiKey} onChange={e => onUpdate({ apiKey: e.target.value })} placeholder="sk-..." className="w-full min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 pr-10 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-100" />
                    <button type="button" onClick={() => setShowKey(v => !v)} className="api-key-visibility-button absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs leading-normal text-gray-500">API 格式</label>
                  <AppSelect
                    value={platform.apiFormat}
                    onChange={e => updateFormat(e.target.value as ApiFormatType)}
                    className="w-full"
                    options={API_FORMATS.map(format => ({ value: format.value, label: `${format.label} - ${format.desc}` }))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs leading-normal text-gray-500">创建任务路径</label>
                    <input value={platform.endpoints.createVideo} onChange={e => updateEndpoints({ createVideo: e.target.value })} className="w-full min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs leading-normal text-gray-500">查询任务路径</label>
                    <input value={platform.endpoints.queryTask} onChange={e => updateEndpoints({ queryTask: e.target.value })} className="w-full min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-100" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs leading-normal text-gray-500">任务列表路径（可选）</label>
                    <input value={platform.endpoints.queryTaskList ?? ''} onChange={e => updateEndpoints({ queryTaskList: e.target.value || undefined })} className="w-full min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs leading-normal text-gray-500">取消/删除路径（可选）</label>
                    <input value={platform.endpoints.deleteTask ?? ''} onChange={e => updateEndpoints({ deleteTask: e.target.value || undefined })} className="w-full min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-100" />
                  </div>
                </div>
              </div>
            )}
            {tab === 'models' && (
              <CustomModelManager models={models} defaultModel={platform.defaultModel} platformApiFormat={platform.apiFormat} onChange={updateModels} hideParamEditor />
            )}
            {tab === 'params' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-orange-100 bg-orange-50/70 px-4 py-3">
                  <p className="text-sm font-semibold text-orange-800">参数设置</p>
                  <p className="mt-1 text-xs leading-5 text-orange-700">自定义平台的参数会直接写入对应模型 schema，生成页会按这里的字段名、类型、默认值和适用模式渲染并提交请求。</p>
                </div>
                {models.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">请先在「模型管理」中新增模型，再配置参数。</div>
                ) : models.map(model => {
                  const params = model.params ?? buildDefaultParams(model.modes);
                  return (
                    <div key={model.id} className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{model.name}</p>
                        <p className="text-xs text-gray-400 break-all">{model.id}</p>
                      </div>
                      <ParamSchemaEditor params={params} modelModes={model.modes} onChange={nextParams => updateModelParams(model.id, nextParams)} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomPlatformCard;
