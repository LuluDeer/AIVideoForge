import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Key, Layers, Settings2, Trash2 } from 'lucide-react';
import AppSelect from '../../components/AppSelect';
import { buildDefaultParams } from '../../services/modelTemplates';
import type { ApiEndpoints, ApiFormatType, CustomModelDef, CustomPlatformDef, ImageUploadMode, ParamDef } from '../../types';
import { API_FORMATS } from './constants';
import CustomModelManager from './CustomModelManager';
import ParamSchemaEditor from './ParamSchemaEditor';
import { defaultEndpointsForFormat } from './utils';

const INPUT_CLASS = 'w-full min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-100';
const MONO_INPUT_CLASS = `${INPUT_CLASS} font-mono`;

const CustomPlatformCard: React.FC<{
  platform: CustomPlatformDef;
  onUpdate: (updates: Partial<CustomPlatformDef>) => void;
  onRemove: () => void;
}> = ({ platform, onUpdate, onRemove }) => {
  const [expanded, setExpanded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [tab, setTab] = useState<'basic' | 'models' | 'params'>('basic');
  const [openParamModelId, setOpenParamModelId] = useState<string | null>(null);
  const models = platform.models ?? [];
  const uploadModeOptions = [
    { value: 'geekai', label: '上传到 GeekAI CDN（需要 ck）' },
    { value: 'base64', label: '转为 Base64 内联' },
    { value: 'url', label: '仅 URL 输入（不上传）' },
  ];

  const updateEndpoints = (updates: Partial<ApiEndpoints>) => onUpdate({ endpoints: { ...platform.endpoints, ...updates } });
  const updateFormat = (format: ApiFormatType) => {
    onUpdate({ apiFormat: format, endpoints: defaultEndpointsForFormat(format) });
  };
  const updateModels = (nextModels: CustomModelDef[], defaultModel = platform.defaultModel) => onUpdate({ models: nextModels, defaultModel });
  const updateModelParams = (modelId: string, params: ParamDef[]) => {
    updateModels(models.map(model => model.id === modelId ? { ...model, params } : model));
  };
  const toggleDisabled = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onUpdate({ disabled: !platform.disabled });
  };
  const removePlatform = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onRemove();
  };

  return (
    <div className={`config-platform-card rounded-xl border transition-shadow ${expanded ? 'border-blue-200 shadow-md' : 'border-gray-200'}`}>
      <div className="config-platform-card__header flex cursor-pointer items-center gap-3 px-4 py-3" onClick={() => setExpanded(v => !v)}>
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${platform.disabled ? 'bg-red-400 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]' : 'bg-green-400 shadow-[0_0_0_4px_rgba(34,197,94,0.12)]'}`} title={platform.disabled ? '平台已停用' : '平台已启用'} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-normal text-gray-800 break-words">{platform.name || '自定义平台'}</p>
          <p className="text-xs leading-normal text-gray-400 break-all">{platform.baseUrl || '未填写 Base URL'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex min-h-6 items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs leading-normal text-gray-500">{models.length} 个模型</span>
          <button type="button" role="switch" aria-checked={!platform.disabled} onClick={toggleDisabled} className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100 ${platform.disabled ? 'border-red-200 bg-red-100' : 'border-green-200 bg-green-500'}`} title={platform.disabled ? '启用平台' : '停用平台'}>
            <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${platform.disabled ? 'translate-x-0.5' : 'translate-x-5'}`} />
          </button>
          <button type="button" onClick={removePlatform} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500" title="删除平台">
            <Trash2 className="w-4 h-4" />
          </button>
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100">
          <div className="flex flex-wrap gap-1 bg-gray-50 border-b border-gray-100 px-2 pt-2">
            {([['basic', '基础配置', Key], ['models', '模型管理', Layers], ['params', '参数设置', Settings2]] as const).map(([targetTab, label, Icon]) => (
              <button key={targetTab} type="button" onClick={() => setTab(targetTab)} className={`inline-flex min-h-10 items-center gap-1.5 rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium leading-normal transition-colors ${tab === targetTab ? 'border-blue-200 bg-white text-blue-700' : 'border-transparent text-gray-500 hover:bg-white hover:text-gray-700'}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
          <div className="config-platform-card__body p-4 bg-white">
            {tab === 'basic' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">平台 ID <span className="text-red-500">*</span></label>
                    <input value={platform.id} onChange={e => onUpdate({ id: e.target.value.trim() })} className={MONO_INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">平台名称 <span className="text-red-500">*</span></label>
                    <input value={platform.name} onChange={e => onUpdate({ name: e.target.value })} className={INPUT_CLASS} />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">API Key <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showKey ? 'text' : 'password'} value={platform.apiKey} onChange={e => onUpdate({ apiKey: e.target.value })} placeholder="sk-..." className={`${MONO_INPUT_CLASS} pr-10`} />
                    <button type="button" onClick={() => setShowKey(v => !v)} className="api-key-visibility-button absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600">
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">Base URL <span className="text-red-500">*</span></label>
                  <input type="url" value={platform.baseUrl} onChange={e => onUpdate({ baseUrl: e.target.value })} placeholder="https://api.example.com" className={MONO_INPUT_CLASS} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">API 格式</label>
                  <AppSelect
                    value={platform.apiFormat}
                    onChange={e => updateFormat(e.target.value as ApiFormatType)}
                    className="w-full"
                    options={API_FORMATS.map(format => ({ value: format.value, label: `${format.label} - ${format.desc}` }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">图片上传方式</label>
                  <AppSelect
                    value={platform.imageUploadMode ?? 'url'}
                    onChange={e => onUpdate({ imageUploadMode: e.target.value as ImageUploadMode })}
                    className="w-full"
                    options={uploadModeOptions}
                  />
                  <p className="mt-1 text-xs leading-5 text-gray-400">GeekAI CDN 需要上传 Cookie；Base64 会把图片内联到请求中；仅 URL 输入不会上传本地图片。</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">创建任务路径</label>
                    <input value={platform.endpoints.createVideo} onChange={e => updateEndpoints({ createVideo: e.target.value })} className={MONO_INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">查询任务路径</label>
                    <input value={platform.endpoints.queryTask} onChange={e => updateEndpoints({ queryTask: e.target.value })} className={MONO_INPUT_CLASS} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">任务列表路径（可选）</label>
                    <input value={platform.endpoints.queryTaskList ?? ''} onChange={e => updateEndpoints({ queryTaskList: e.target.value || undefined })} className={MONO_INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">取消/删除路径（可选）</label>
                    <input value={platform.endpoints.deleteTask ?? ''} onChange={e => updateEndpoints({ deleteTask: e.target.value || undefined })} className={MONO_INPUT_CLASS} />
                  </div>
                </div>
              </div>
            )}
            {tab === 'models' && (
              <CustomModelManager models={models} defaultModel={platform.defaultModel} platformApiFormat={platform.apiFormat} onChange={updateModels} hideParamEditor />
            )}
            {tab === 'params' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                  <p className="text-sm font-semibold text-blue-800">参数设置</p>
                  <p className="mt-1 text-xs leading-5 text-blue-700">自定义平台的参数会直接写入对应模型 schema，生成页会按这里的字段名、类型、默认值和适用模式渲染并提交请求。</p>
                </div>
                {models.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">请先在「模型管理」中新增模型，再配置参数。</div>
                ) : models.map(model => {
                  const params = model.params ?? buildDefaultParams(model.modes);
                  const isOpen = openParamModelId === model.id;
                  return (
                    <div key={model.id} className="rounded-xl border border-gray-100 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => setOpenParamModelId(isOpen ? null : model.id)}
                        className="flex w-full items-start gap-2 px-3 py-3 text-left hover:bg-gray-100"
                      >
                        {isOpen ? <ChevronDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" /> : <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800">{model.name}</p>
                          <p className="text-xs text-gray-400 break-all">{model.id}</p>
                          <p className="mt-1 text-xs text-gray-400">{params.length} 个参数</p>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t border-gray-100 p-3">
                          <ParamSchemaEditor params={params} modelModes={model.modes} onChange={nextParams => updateModelParams(model.id, nextParams)} />
                        </div>
                      )}
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
