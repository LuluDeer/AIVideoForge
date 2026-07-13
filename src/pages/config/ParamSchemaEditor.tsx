import React from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import AppSelect from '../../components/AppSelect';
import type { GenerationMode, ParamDef, ParamOption } from '../../types';
import { ALL_MODES } from './constants';

const FIELD_CLASS = 'w-full min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100';
const MINI_BUTTON_CLASS = 'inline-flex min-h-10 items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium leading-relaxed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100';

const COMMON_TYPES = [
  { value: 'string', label: 'string 文本' },
  { value: 'number', label: 'number 数字' },
  { value: 'boolean', label: 'boolean 开关' },
  { value: 'image', label: 'image 单图' },
  { value: 'image-multi', label: 'image-multi 多图' },
  { value: 'video', label: 'video 单视频' },
  { value: 'video-multi', label: 'video-multi 多视频' },
  { value: 'audio', label: 'audio 单音频' },
  { value: 'audio-multi', label: 'audio-multi 多音频' },
  { value: 'array', label: 'array 数组/自定义' },
  { value: 'object', label: 'object 对象/自定义' },
];

const optionText = (options?: ParamOption[]) => (options ?? []).map(opt => `${opt.label}=${String(opt.value)}`).join('\n');

const parseOptionValue = (value: string): string | number => {
  const trimmed = value.trim();
  if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
  return trimmed;
};

const parseOptions = (text: string): ParamOption[] | undefined => {
  const options = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [labelPart, ...valueParts] = line.split('=');
      const label = labelPart.trim();
      const rawValue = valueParts.length > 0 ? valueParts.join('=').trim() : label;
      return { label, value: parseOptionValue(rawValue) };
    })
    .filter(opt => opt.label);
  return options.length ? options : undefined;
};

const toInputValue = (value: unknown) => value === undefined || value === null ? '' : String(value);

const parseTypedValue = (type: string, raw: string): unknown => {
  if (raw.trim() === '') return undefined;
  if (type === 'number') {
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  }
  if (type === 'boolean') return raw === 'true';
  return raw;
};

const normalizeParamForModes = (param: ParamDef, fallbackModes: GenerationMode[]): ParamDef => ({
  ...param,
  modes: param.modes && param.modes.length > 0 ? param.modes : fallbackModes,
});

const getNextParamKey = (params: ParamDef[]): string => {
  const used = new Set(params.map(param => param.key));
  let index = params.length + 1;
  while (used.has(`custom_param_${index}`)) index += 1;
  return `custom_param_${index}`;
};

const ParamSchemaEditor: React.FC<{
  params: ParamDef[];
  modelModes: GenerationMode[];
  onChange: (params: ParamDef[]) => void;
}> = ({ params, modelModes, onChange }) => {
  const normalizedParams = params.map(param => normalizeParamForModes(param, modelModes));
  const [openParamIds, setOpenParamIds] = React.useState<Record<string, boolean>>({});
  const toggleParamOpen = (index: number) => {
    setOpenParamIds(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const updateParam = (index: number, patch: Partial<ParamDef>) => {
    const safePatch = { ...patch };
    if (patch.key !== undefined) {
      const key = patch.key.trim();
      if (!key || normalizedParams.some((param, i) => i !== index && param.key === key)) return;
      safePatch.key = key;
    }
    onChange(normalizedParams.map((param, i) => i === index ? { ...param, ...safePatch } : param));
  };

  const removeParam = (index: number) => {
    onChange(normalizedParams.filter((_, i) => i !== index));
  };

  const addParam = () => {
    const key = getNextParamKey(normalizedParams);
    const labelIndex = normalizedParams.length + 1;
    onChange([
      ...normalizedParams,
      {
        key,
        apiKey: key,
        label: `自定义参数 ${labelIndex}`,
        type: 'string',
        modes: modelModes,
      },
    ]);
  };

  const toggleMode = (index: number, mode: GenerationMode) => {
    const param = normalizedParams[index];
    const modes = param.modes ?? [];
    const nextModes = modes.includes(mode) ? modes.filter(item => item !== mode) : [...modes, mode];
    updateParam(index, { modes: nextModes.length ? nextModes : undefined });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-indigo-800">参数定义</p>
          <p className="mt-1 text-xs leading-5 text-indigo-700">可以新增参数，也可以修改参数名称、请求字段、类型、默认值、选项和适用模式。请求字段为空时默认使用内部参数名。</p>
        </div>
        <button type="button" onClick={addParam} className={`${MINI_BUTTON_CLASS} border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100 active:bg-indigo-100`}>
          <Plus className="mr-1.5 h-4 w-4" />新增参数
        </button>
      </div>

      {normalizedParams.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">暂无参数，点击“新增参数”添加。</div>
      )}

      {normalizedParams.map((param, index) => {
        const typeIsCommon = COMMON_TYPES.some(item => item.value === param.type);
        const typeSelectValue = typeIsCommon ? param.type : '__custom__';
        const isOpen = openParamIds[index] ?? false;
        return (
          <div key={index} className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 p-4">
              <button type="button" onClick={() => toggleParamOpen(index)} className="flex min-w-0 flex-1 items-start gap-2 text-left">
                {isOpen ? <ChevronDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" /> : <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 break-words">{param.label || param.key || `参数 ${index + 1}`}</p>
                  <p className="mt-0.5 text-xs text-gray-400 break-all">请求字段：{param.apiKey || param.key || '未填写'} · 类型：{param.type}</p>
                </div>
              </button>
              <button type="button" onClick={() => removeParam(index)} className={`${MINI_BUTTON_CLASS} border-red-100 bg-white text-red-500 hover:bg-red-50 active:bg-red-50`} title="删除参数">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {isOpen && (
              <div className="space-y-3 border-t border-gray-100 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">内部参数名 / key <span className="text-red-500">*</span></label>
                    <input value={param.key} onChange={e => updateParam(index, { key: e.target.value })} placeholder="duration" className={`${FIELD_CLASS} font-mono`} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">请求字段名 / apiKey</label>
                    <input value={param.apiKey ?? ''} onChange={e => updateParam(index, { apiKey: e.target.value.trim() || undefined })} placeholder="留空则使用 key" className={`${FIELD_CLASS} font-mono`} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">显示名称 <span className="text-red-500">*</span></label>
                    <input value={param.label} onChange={e => updateParam(index, { label: e.target.value })} placeholder="时长" className={FIELD_CLASS} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">参数类型</label>
                    <div className="flex gap-2">
                      <AppSelect
                        value={typeSelectValue}
                        onChange={e => updateParam(index, { type: e.target.value === '__custom__' ? (typeIsCommon ? 'custom' : param.type) : e.target.value })}
                        className="w-full"
                        options={[...COMMON_TYPES.map(type => ({ value: type.value, label: type.label })), { value: '__custom__', label: '自定义类型' }]}
                      />
                      {typeSelectValue === '__custom__' && (
                        <input value={param.type} onChange={e => updateParam(index, { type: e.target.value.trim() || 'string' })} placeholder="如 enum/json" className={`${FIELD_CLASS} max-w-[150px]`} />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">默认值</label>
                    {param.type === 'boolean' ? (
                      <AppSelect
                        value={String(param.defaultValue ?? false)}
                        onChange={e => updateParam(index, { defaultValue: e.target.value === 'true' })}
                        className="w-full"
                        options={[{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }]}
                      />
                    ) : (
                      <input type={param.type === 'number' ? 'number' : 'text'} value={toInputValue(param.defaultValue)} onChange={e => updateParam(index, { defaultValue: parseTypedValue(param.type, e.target.value) })} placeholder="不填则不设置默认值" className={FIELD_CLASS} />
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">固定提交值</label>
                    <input type={param.type === 'number' ? 'number' : 'text'} value={toInputValue(param.fixedValue)} onChange={e => updateParam(index, { fixedValue: parseTypedValue(param.type, e.target.value) })} placeholder="不填则允许用户在生成页填写" className={FIELD_CLASS} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-600">选项列表</label>
                    <textarea value={optionText(param.options)} onChange={e => updateParam(index, { options: parseOptions(e.target.value) })} placeholder="每行一个：显示名=提交值\n例如：16:9=16:9" className="w-full min-h-[88px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-normal text-gray-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-600">适用模式</label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_MODES.map(mode => (
                          <label key={mode.value} className="flex min-h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
                            <input type="checkbox" checked={(param.modes ?? []).includes(mode.value)} onChange={() => toggleMode(index, mode.value)} className="h-3.5 w-3.5 rounded accent-blue-500" />
                            <span>{mode.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex min-h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
                        <input type="checkbox" checked={!!param.hidden} onChange={e => updateParam(index, { hidden: e.target.checked || undefined })} className="h-4 w-4 rounded accent-blue-500" />默认隐藏
                      </label>
                      <label className="flex min-h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
                        <input type="checkbox" checked={!!param.required} onChange={e => updateParam(index, { required: e.target.checked || undefined })} className="h-4 w-4 rounded accent-blue-500" />必填
                      </label>
                    </div>
                    {(param.type === 'image-multi' || param.type === 'video-multi' || param.type === 'audio-multi') && (
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" value={param.imageLimits?.min ?? ''} onChange={e => updateParam(index, { imageLimits: { ...param.imageLimits, min: e.target.value ? Number(e.target.value) : undefined } })} placeholder="最少数量" className={FIELD_CLASS} />
                        <input type="number" value={param.imageLimits?.max ?? ''} onChange={e => updateParam(index, { imageLimits: { ...param.imageLimits, max: e.target.value ? Number(e.target.value) : undefined } })} placeholder="最多数量" className={FIELD_CLASS} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ParamSchemaEditor;
