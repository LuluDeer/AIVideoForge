import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, Key, Layers, Settings2 } from 'lucide-react';
import AppSelect from '../../components/AppSelect';
import { useConfig } from '../../context/useConfig';
import { PLATFORM_DEFS, buildDefaultParams } from '../../services/modelTemplates';
import type { ApiEndpoints, CustomModelDef, ImageUploadMode } from '../../types';
import CustomModelManager from './CustomModelManager';
import ParamOverrideRow from './ParamOverrideRow';
import { mergeEndpoints } from './utils';

const INPUT_CLASS = 'w-full min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-100';

const BuiltinPlatformCard: React.FC<{ platformId: string }> = ({ platformId }) => {
  const { getUserPlatformConfig, updateUserPlatformConfig, updateParamOverride, resetParamOverride, getParamOverride } = useConfig();
  const def = PLATFORM_DEFS.find(p => p.id === platformId);
  const userConfig = getUserPlatformConfig(platformId);
  const [expanded, setExpanded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [tab, setTab] = useState<'basic' | 'models' | 'params'>('basic');

  const extraModels = userConfig.extraModels ?? [];
  const allModels = useMemo(() => {
    if (!def) return [];
    const map = new Map(def.models.map(model => [model.id, model]));
    extraModels.forEach(model => {
      map.set(model.id, {
        id: model.id,
        platformId: def.id,
        name: model.name,
        label: model.label,
        modes: model.modes,
        apiFormat: model.apiFormat ?? def.models[0]?.apiFormat ?? 'unified',
        params: model.params ?? buildDefaultParams(model.modes),
      });
    });
    return Array.from(map.values());
  }, [def, extraModels]);

  if (!def) return null;

  const endpoints = mergeEndpoints(def.defaultEndpoints, userConfig.endpoints);
  const defaultUploadMode: ImageUploadMode = platformId === 'seedance' ? 'base64' : 'geekai';
  const uploadModeOptions = [
    { value: 'geekai', label: '上传到 GeekAI CDN（需要 ck）' },
    { value: 'cloudreve', label: '上传到 Cloudreve（需要密钥）' },
    { value: 'base64', label: '转为 Base64 内联' },
    { value: 'url', label: '仅 URL 输入（不上传）' },
  ];
  const baseModelsForEditor: CustomModelDef[] = def.models.map(model => ({
    id: model.id,
    name: model.name,
    label: model.label,
    modes: model.modes,
    apiFormat: model.apiFormat,
    params: model.params,
  }));

  const updateEndpoints = (updates: Partial<ApiEndpoints>) => {
    updateUserPlatformConfig(platformId, { endpoints: { ...endpoints, ...updates } });
  };

  const toggleDisabled = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    updateUserPlatformConfig(platformId, { disabled: !userConfig.disabled });
  };

  return (
    <div className={`config-platform-card rounded-xl border transition-shadow ${expanded ? 'border-blue-200 shadow-md' : 'border-gray-200'}`}>
      <div className="config-platform-card__header flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${userConfig.disabled ? 'bg-red-400 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]' : 'bg-green-400 shadow-[0_0_0_4px_rgba(34,197,94,0.12)]'}`} title={userConfig.disabled ? '平台已停用' : '平台已启用'} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-normal text-gray-800 break-words">{def.name}</p>
          <p className="text-xs leading-normal text-gray-400 break-all">{userConfig.baseUrl || def.defaultBaseUrl}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex min-h-6 items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs leading-normal text-gray-500">{allModels.length} 个模型</span>
          <button type="button" role="switch" aria-checked={!userConfig.disabled} onClick={toggleDisabled} className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100 ${userConfig.disabled ? 'border-red-200 bg-red-100' : 'border-green-200 bg-green-500'}`} title={userConfig.disabled ? '启用平台' : '停用平台'}>
            <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${userConfig.disabled ? 'translate-x-0.5' : 'translate-x-5'}`} />
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
                <div>
                  <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">API Key <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input type={showKey ? 'text' : 'password'} value={userConfig.apiKey} onChange={e => updateUserPlatformConfig(platformId, { apiKey: e.target.value })} placeholder="sk-..." className="w-full min-h-11 rounded-lg border border-gray-200 px-3 py-2.5 pr-10 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-100" />
                    <button onClick={() => setShowKey(v => !v)} className="api-key-visibility-button absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600" type="button">
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">Base URL <span className="text-gray-400 font-normal">留空使用默认</span></label>
                  <input type="url" value={userConfig.baseUrl ?? ''} onChange={e => updateUserPlatformConfig(platformId, { baseUrl: e.target.value || undefined })} placeholder={def.defaultBaseUrl} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">图片上传方式</label>
                  <AppSelect
                    value={userConfig.imageUploadMode ?? defaultUploadMode}
                    onChange={e => updateUserPlatformConfig(platformId, { imageUploadMode: e.target.value as ImageUploadMode })}
                    className="w-full"
                    options={uploadModeOptions}
                  />
                  <p className="mt-1 text-xs leading-5 text-gray-400">GeekAI CDN 需要上传 Cookie；Cloudreve 需要 Cloudreve ApiKey；Base64 会把图片内联到请求中；仅 URL 输入不会上传本地图片。</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">创建任务路径</label>
                    <input type="text" value={endpoints.createVideo} onChange={e => updateEndpoints({ createVideo: e.target.value })} placeholder={def.defaultEndpoints.createVideo} className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">查询任务路径</label>
                    <input type="text" value={endpoints.queryTask} onChange={e => updateEndpoints({ queryTask: e.target.value })} placeholder={def.defaultEndpoints.queryTask} className={INPUT_CLASS} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">下载视频路径（可选）</label>
                    <input type="text" value={endpoints.downloadVideo ?? ''} onChange={e => updateEndpoints({ downloadVideo: e.target.value || undefined })} placeholder="/v1/videos/{task_id}/content.mp4" className={INPUT_CLASS} />
                    <p className="mt-1 text-xs leading-5 text-gray-400">配置后任务成功时可直接用该路径下载；留空则继续使用查询结果中的视频地址。</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">任务列表路径（可选）</label>
                    <input type="text" value={endpoints.queryTaskList ?? ''} onChange={e => updateEndpoints({ queryTaskList: e.target.value || undefined })} placeholder={def.defaultEndpoints.queryTaskList ?? '/v1/videos'} className={INPUT_CLASS} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">取消/删除路径（可选）</label>
                    <input type="text" value={endpoints.deleteTask ?? ''} onChange={e => updateEndpoints({ deleteTask: e.target.value || undefined })} placeholder={def.defaultEndpoints.deleteTask ?? '/v1/videos/{id}'} className={INPUT_CLASS} />
                  </div>
                </div>
              </div>
            )}

            {tab === 'models' && (
              <CustomModelManager
                models={extraModels}
                defaultModel={userConfig.defaultModel ?? def.defaultModel}
                platformApiFormat={def.models[0]?.apiFormat ?? 'unified'}
                baseModels={baseModelsForEditor}
                onChange={(models, defaultModel) => updateUserPlatformConfig(platformId, { extraModels: models, defaultModel })}
              />
            )}

            {tab === 'params' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                  <p className="text-sm font-semibold text-blue-800">参数默认值覆盖</p>
                  <p className="mt-1 text-xs leading-5 text-blue-700">这里用于调整请求时默认值或禁用参数；如果需要修改字段名、类型、固定值、图片限制等完整 schema，请在「模型管理」中展开对应模型编辑。</p>
                </div>
                {allModels.map(model => (
                  <div key={model.id} className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{model.name}</p>
                      <p className="text-xs text-gray-400 break-all">{model.id}</p>
                    </div>
                    {(model.params ?? []).length > 0 ? (
                      (model.params ?? []).map((param, index) => (
                        <ParamOverrideRow
                          key={`${model.id}__${param.key}__${index}`}
                          param={param}
                          override={getParamOverride(platformId, param.key, model.id)}
                          onUpdate={override => updateParamOverride(platformId, param.key, override, model.id)}
                          onReset={() => resetParamOverride(platformId, param.key, model.id)}
                        />
                      ))
                    ) : (
                      <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-sm text-gray-400">该模型暂无参数定义。</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BuiltinPlatformCard;
