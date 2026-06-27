import React from 'react';
import { RotateCcw } from 'lucide-react';
import AppSelect from '../../components/AppSelect';
import type { ParamDef, UserParamOverride } from '../../types';

const FIELD_CLASS = 'w-full min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100';
const PILL_CLASS = 'inline-flex min-h-7 items-center rounded-md border px-2 py-1 text-xs leading-relaxed break-all';

const ParamOverrideRow: React.FC<{
  param: ParamDef;
  override?: UserParamOverride;
  onUpdate: (override: Partial<UserParamOverride>) => void;
  onReset: () => void;
}> = ({ param, override = {}, onUpdate, onReset }) => {
  const hasOverride = Object.prototype.hasOwnProperty.call(override, 'defaultValue') || override.disabled === true;
  const isDisabled = override.disabled === true;
  const curVal = Object.prototype.hasOwnProperty.call(override, 'defaultValue') ? override.defaultValue : param.defaultValue;

  const valueInput = () => {
    if (isDisabled) {
      return <div className="min-h-10 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-normal text-gray-400">已禁用：提交请求时不会携带此参数</div>;
    }
    if (param.type === 'boolean') {
      return (
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-normal text-gray-600 cursor-pointer">
          <input type="checkbox" checked={!!curVal} onChange={e => onUpdate({ defaultValue: e.target.checked })} className="h-4 w-4 rounded accent-blue-500" />
          <span>{curVal ? '默认开启' : '默认关闭'}</span>
        </label>
      );
    }
    if (param.type === 'number') {
      return (
        <input
          type="number"
          value={curVal !== undefined ? String(curVal) : ''}
          onChange={e => onUpdate({ defaultValue: e.target.value !== '' ? Number(e.target.value) : undefined })}
          placeholder={`内置默认值: ${param.defaultValue ?? '未设置'}`}
          className={`${FIELD_CLASS} md:max-w-[220px]`}
        />
      );
    }
    if (param.options && param.options.length > 0) {
      return (
        <AppSelect
          value={String(curVal ?? '')}
          onChange={e => onUpdate({ defaultValue: e.target.value })}
          className="md:max-w-[260px]"
          options={param.options.map(o => ({ value: String(o.value), label: o.label }))}
        />
      );
    }
    return (
      <input
        type="text"
        value={String(curVal ?? '')}
        onChange={e => onUpdate({ defaultValue: e.target.value || undefined })}
        placeholder={`内置默认值: ${param.defaultValue ?? '未设置'}`}
        className={FIELD_CLASS}
      />
    );
  };

  return (
    <div className={`rounded-xl border p-4 ${hasOverride ? 'border-blue-200 bg-blue-50/60' : 'border-gray-100 bg-white'}`}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold leading-normal text-gray-800 break-words">{param.label}</span>
            {hasOverride && <span className={`${PILL_CLASS} border-blue-100 bg-blue-100 text-blue-700`}>已调整</span>}
            {param.hidden && <span className={`${PILL_CLASS} border-gray-200 bg-gray-100 text-gray-600`}>默认隐藏</span>}
          </div>
          <div className="space-y-1.5 text-xs leading-normal text-gray-500">
            <p className="break-all"><span className="text-gray-400">请求字段：</span><code className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-700">{param.apiKey ?? param.key}</code></p>
            <p className="break-all"><span className="text-gray-400">内部参数名：</span><code className="rounded-md bg-gray-100 px-1.5 py-0.5 text-gray-600">{param.key}</code></p>
            <p><span className="text-gray-400">参数类型：</span><span className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-gray-600">{param.type}</span></p>
          </div>
        </div>

        <div className="min-w-0">
          <label className="mb-1.5 block text-xs font-medium leading-normal text-gray-600">可输入的默认参数值（按平台 API 手册填写）</label>
          {valueInput()}
          <p className="mt-1.5 text-xs leading-5 text-gray-400 break-words">这里只改“请求时默认带什么值”。左侧字段名和类型仅用于对照 API 手册，不会被修改；生成页仍可按需覆盖可见参数。</p>
        </div>

        <div className="flex items-center justify-end gap-2 lg:pt-6">
          <label className="flex min-h-9 items-center gap-2 rounded-lg border border-red-100 bg-white px-3 py-2 text-sm leading-normal text-red-600 cursor-pointer hover:bg-red-50">
            <input type="checkbox" checked={isDisabled} onChange={e => onUpdate({ disabled: e.target.checked })} className="h-4 w-4 rounded accent-red-500" />
            <span>不提交</span>
          </label>
          {hasOverride && (
            <button onClick={onReset} title="恢复内置默认值" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-normal text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
              <RotateCcw className="h-4 w-4" />重置
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParamOverrideRow;
