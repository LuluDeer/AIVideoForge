import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, RotateCcw, Trash2 } from 'lucide-react';
import AppSelect from '../../components/AppSelect';
import { buildDefaultParams } from '../../services/modelTemplates';
import type { ApiFormatType, CustomModelDef, GenerationMode, ParamDef } from '../../types';
import { ALL_MODES, API_FORMATS } from './constants';
import ParamSchemaEditor from './ParamSchemaEditor';

const FIELD_CLASS = 'w-full min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100';

const cloneParams = (params?: ParamDef[], modes: GenerationMode[] = ['text']): ParamDef[] => params?.map(param => ({ ...param, options: param.options?.map(opt => ({ ...opt })) })) ?? buildDefaultParams(modes);

const CustomModelManager: React.FC<{
  models: CustomModelDef[];
  defaultModel?: string;
  platformApiFormat: ApiFormatType;
  onChange: (models: CustomModelDef[], defaultModel?: string) => void;
  baseModels?: CustomModelDef[];
  hideParamEditor?: boolean;
}> = ({ models, defaultModel, platformApiFormat, onChange, baseModels = [], hideParamEditor = false }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<Partial<CustomModelDef>>({ modes: ['text'] });
  const [openModelId, setOpenModelId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const displayModels = useMemo(() => {
    const orderedIds: string[] = [];
    const map = new Map<string, CustomModelDef & { builtin?: boolean; customized?: boolean }>();
    baseModels.forEach(model => {
      orderedIds.push(model.id);
      map.set(model.id, { ...model, builtin: true });
    });
    models.forEach(model => {
      if (!orderedIds.includes(model.id)) orderedIds.push(model.id);
      map.set(model.id, { ...model, builtin: baseModels.some(base => base.id === model.id), customized: baseModels.some(base => base.id === model.id) });
    });
    return orderedIds.map(id => map.get(id)).filter(Boolean) as Array<CustomModelDef & { builtin?: boolean; customized?: boolean }>;
  }, [baseModels, models]);

  const updateStoredModel = (model: CustomModelDef, previousId = model.id) => {
    const next: CustomModelDef[] = [];
    let saved = false;
    models.forEach(item => {
      if (item.id === previousId || item.id === model.id) {
        if (!saved) {
          next.push(model);
          saved = true;
        }
        return;
      }
      next.push(item);
    });
    if (!saved) next.push(model);
    const nextDefault = defaultModel === previousId ? model.id : (defaultModel ?? model.id);
    onChange(next, nextDefault);
  };

  const removeStoredModel = (model: CustomModelDef) => {
    const next = models.filter(item => item.id !== model.id);
    const nextDefault = defaultModel === model.id ? (next[0]?.id ?? baseModels[0]?.id) : defaultModel;
    onChange(next, nextDefault);
  };

  const toggleDraftMode = (mode: GenerationMode) => {
    setDraft(prev => {
      const cur = prev.modes ?? [];
      return { ...prev, modes: cur.includes(mode) ? cur.filter(x => x !== mode) : [...cur, mode] };
    });
  };

  const add = () => {
    if (!draft.id?.trim() || !draft.name?.trim()) return;
    const modes: GenerationMode[] = draft.modes?.length ? draft.modes : ['text'];
    const model: CustomModelDef = {
      id: draft.id.trim(),
      name: draft.name.trim(),
      label: draft.label?.trim() || draft.name.trim(),
      modes,
      apiFormat: draft.apiFormat,
      params: buildDefaultParams(modes),
      disabled: false,
    };
    updateStoredModel(model);
    setOpenModelId(model.id);
    setDraft({ modes: ['text'] });
    setShowAdd(false);
  };

  const updateModelField = (model: CustomModelDef, patch: Partial<CustomModelDef>) => {
    const nextId = patch.id !== undefined ? patch.id.trim() : model.id;
    if (!nextId) {
      setError('模型 ID 不能为空。');
      return;
    }
    if (nextId !== model.id && displayModels.some(item => item.id === nextId)) {
      setError(`模型 ID “${nextId}” 已存在，不能覆盖其他模型。`);
      return;
    }
    setError('');
    const nextModes = patch.modes ?? model.modes;
    const nextModel: CustomModelDef = {
      ...model,
      ...patch,
      id: nextId,
      params: patch.modes ? cloneParams(model.params, nextModes) : cloneParams(patch.params ?? model.params, nextModes),
    };
    if (patch.id !== undefined) setOpenModelId(nextModel.id);
    updateStoredModel(nextModel, model.id);
  };

  const toggleModelMode = (model: CustomModelDef, mode: GenerationMode) => {
    const cur = model.modes ?? [];
    const nextModes = cur.includes(mode) ? cur.filter(item => item !== mode) : [...cur, mode];
    updateModelField(model, { modes: nextModes.length ? nextModes : ['text'] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-gray-700">{hideParamEditor ? '模型管理' : '模型与参数'}</span>
          <p className="mt-0.5 text-xs leading-5 text-gray-400">{hideParamEditor ? '可以新增模型，也可以展开模型修改名称、支持模式和 API 格式；参数定义请到「参数设置」页签统一维护。' : '可以新增模型，也可以展开模型修改名称、支持模式、API 格式和完整参数定义。内置模型修改后会保存为用户覆盖，不会改源码。'}</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium leading-normal text-blue-700 hover:bg-blue-100 active:bg-blue-100 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-100">
          <Plus className="w-4 h-4" />{showAdd ? '取消' : '新增模型'}
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      {displayModels.length === 0 && !showAdd && (
        <div className="rounded-xl border border-dashed border-blue-100 bg-blue-50/40 px-4 py-5 text-center">
          <p className="text-sm font-medium text-blue-800">还没有模型</p>
          <p className="mt-1 text-xs leading-5 text-blue-700">点击「新增模型」填写官方模型 ID、支持模式和参数定义。</p>
        </div>
      )}

      {displayModels.map(model => {
        const isOpen = openModelId === model.id;
        const effectiveParams = cloneParams(model.params, model.modes);
        return (
          <div key={model.id} className="rounded-xl border border-gray-100 bg-gray-50">
            <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <button type="button" onClick={() => setOpenModelId(isOpen ? null : model.id)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
                {isOpen ? <ChevronDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" /> : <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold leading-normal text-gray-800 break-words">{model.name}</span>
                    <code className="inline-flex min-h-6 max-w-full items-center break-all rounded-md border bg-white px-2 py-0.5 text-xs leading-normal text-gray-600">{model.id}</code>
                    <span className="inline-flex min-h-6 items-center rounded-md bg-purple-100 px-2 py-0.5 text-xs leading-normal text-purple-700">{model.apiFormat ?? platformApiFormat}</span>
                    {model.builtin && <span className="inline-flex min-h-6 items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs leading-normal text-gray-600">内置</span>}
                    {model.customized && <span className="inline-flex min-h-6 items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs leading-normal text-blue-700">已自定义</span>}
                    {defaultModel === model.id && <span className="inline-flex min-h-6 items-center rounded-md bg-green-100 px-2 py-0.5 text-xs leading-normal text-green-700">默认</span>}
                    <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${model.disabled ? 'bg-red-400 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]' : 'bg-green-400 shadow-[0_0_0_4px_rgba(34,197,94,0.12)]'}`} title={model.disabled ? '模型已停用' : '模型已启用'} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {model.modes.map(mode => <span key={mode} className="inline-flex min-h-6 items-center rounded-md border bg-white px-2 py-0.5 text-xs leading-normal text-gray-600">{ALL_MODES.find(a => a.value === mode)?.label ?? mode}</span>)}
                    <span className="inline-flex min-h-6 items-center rounded-md border bg-white px-2 py-0.5 text-xs leading-normal text-gray-500">{effectiveParams.length} 个参数</span>
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <button type="button" role="switch" aria-checked={!model.disabled} onClick={() => updateStoredModel({ ...model, disabled: !model.disabled })} className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100 ${model.disabled ? 'border-red-200 bg-red-100' : 'border-green-200 bg-green-500'}`} title={model.disabled ? '启用模型' : '停用模型'}>
                  <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${model.disabled ? 'translate-x-0.5' : 'translate-x-5'}`} />
                </button>
                {defaultModel !== model.id && <button onClick={() => onChange(models, model.id)} className="min-h-9 rounded-lg px-3 py-2 text-sm leading-normal text-gray-500 hover:bg-green-50 hover:text-green-600" title="设为默认">设为默认</button>}
                {model.customized ? (
                  <button onClick={() => removeStoredModel(model)} className="inline-flex min-h-9 items-center rounded-lg px-3 py-2 text-gray-400 hover:bg-orange-50 hover:text-orange-600" title="恢复内置模型默认配置">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                ) : !model.builtin && (
                  <button onClick={() => removeStoredModel(model)} className="inline-flex min-h-9 items-center rounded-lg px-3 py-2 text-gray-400 hover:bg-red-50 hover:text-red-500" title="删除模型">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {isOpen && (
              <div className="space-y-4 border-t border-gray-100 bg-white p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">模型 ID <span className="text-red-500">*</span></label>
                    <input type="text" value={model.id} onChange={e => updateModelField(model, { id: e.target.value })} className={`${FIELD_CLASS} font-mono`} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">显示名 <span className="text-red-500">*</span></label>
                    <input type="text" value={model.name} onChange={e => updateModelField(model, { name: e.target.value, label: e.target.value })} className={FIELD_CLASS} />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">支持模式</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_MODES.map(mode => (
                      <label key={mode.value} className="flex min-h-9 items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm leading-normal text-gray-600 cursor-pointer hover:bg-blue-50">
                        <input type="checkbox" checked={(model.modes ?? []).includes(mode.value)} onChange={() => toggleModelMode(model, mode.value)} className="h-4 w-4 rounded accent-blue-500" />
                        <span>{mode.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">API 格式（留空继承平台）</label>
                  <AppSelect
                    value={model.apiFormat ?? ''}
                    onChange={e => updateModelField(model, { apiFormat: (e.target.value || undefined) as ApiFormatType | undefined })}
                    className="w-full"
                    options={[{ value: '', label: '继承平台格式' }, ...API_FORMATS.map(format => ({ value: format.value, label: `${format.label} - ${format.desc}` }))]}
                  />
                </div>
                {hideParamEditor ? (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm leading-6 text-blue-700">参数定义已移到「参数设置」页签统一维护。</div>
                ) : (
                  <ParamSchemaEditor params={effectiveParams} modelModes={model.modes} onChange={params => updateModelField(model, { params })} />
                )}
              </div>
            )}
          </div>
        );
      })}

      {showAdd && (
        <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          <div>
            <p className="text-sm font-semibold leading-normal text-blue-800">新增模型</p>
            <p className="mt-1 text-xs leading-5 text-blue-700">模型 ID 必须与平台 API 手册一致。添加后会生成默认参数，你可以立即展开模型继续新增或修改参数名、类型、默认值。</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">模型 ID <span className="text-red-500">*</span></label>
              <input type="text" value={draft.id ?? ''} onChange={e => setDraft(d => ({ ...d, id: e.target.value }))} placeholder="doubao-seedance-2-0-260128" className={`${FIELD_CLASS} font-mono`} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">显示名 <span className="text-red-500">*</span></label>
              <input type="text" value={draft.name ?? ''} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="例如 Seedance 2.0 新模型" className={FIELD_CLASS} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">支持模式</label>
            <div className="flex flex-wrap gap-2">
              {ALL_MODES.map(mode => (
                <label key={mode.value} className="flex min-h-9 items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm leading-normal text-gray-600 cursor-pointer hover:bg-blue-50">
                  <input type="checkbox" checked={(draft.modes ?? []).includes(mode.value)} onChange={() => toggleDraftMode(mode.value)} className="h-4 w-4 rounded accent-blue-500" />
                  <span>{mode.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">API 格式（留空继承平台）</label>
            <AppSelect
              value={draft.apiFormat ?? ''}
              onChange={e => setDraft(d => ({ ...d, apiFormat: (e.target.value || undefined) as ApiFormatType | undefined }))}
              className="w-full"
              options={[{ value: '', label: '继承平台格式' }, ...API_FORMATS.map(format => ({ value: format.value, label: `${format.label} - ${format.desc}` }))]}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => { setShowAdd(false); setDraft({ modes: ['text'] }); }} className="min-h-10 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm leading-normal text-gray-600 hover:bg-gray-50">取消</button>
            <button onClick={add} disabled={!draft.id?.trim() || !draft.name?.trim()} className="min-h-10 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold leading-normal text-white hover:bg-blue-700 active:bg-blue-700 disabled:opacity-40">{hideParamEditor ? '添加模型' : '添加并编辑参数'}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomModelManager;
