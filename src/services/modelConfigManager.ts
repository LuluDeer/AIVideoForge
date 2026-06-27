/**
 * modelConfigManager.ts
 * 管理用户对模型参数的个人覆盖（UserParamOverride）。
 * 不再存储完整的参数 schema——那些都在 modelTemplates.ts 里。
 *
 * localStorage key: 'video_gen_param_overrides'
 * 结构: { [platformId]: { [paramKey]: UserParamOverride } }
 *
 * 注意：paramOverrides 是平台级别的（同一平台所有模型共享覆盖），
 * 如果需要模型级别的隔离可以扩展为 { [platformId_modelId]: ... }，
 * 但实际上大多数覆盖（如默认宽高比偏好）是跨模型一致的。
 */
import type { UserParamOverride, ParamOption } from '../types';
import { readJsonStorage, writeJsonStorage } from '../utils/storage';

const STORAGE_KEY = 'video_gen_param_overrides';

type PlatformOverrides = Record<string, UserParamOverride>;
type AllOverrides = Record<string, PlatformOverrides>;

function loadAll(): AllOverrides {
  return readJsonStorage<AllOverrides>(STORAGE_KEY, {});
}

function saveAll(data: AllOverrides): void {
  writeJsonStorage(STORAGE_KEY, data);
}

/** 读取某平台的全部参数覆盖 */
export function getPlatformOverrides(platformId: string): PlatformOverrides {
  return loadAll()[platformId] ?? {};
}

/** 读取某平台某参数的覆盖 */
export function getParamOverride(
  platformId: string,
  paramKey: string,
): UserParamOverride | undefined {
  return getPlatformOverrides(platformId)[paramKey];
}

/** 设置某参数的覆盖（merge 方式） */
export function setParamOverride(
  platformId: string,
  paramKey: string,
  override: UserParamOverride,
): void {
  const all = loadAll();
  if (!all[platformId]) all[platformId] = {};
  all[platformId][paramKey] = { ...all[platformId][paramKey], ...override };
  saveAll(all);
}

/** 删除某参数的覆盖（恢复代码默认） */
export function resetParamOverride(platformId: string, paramKey: string): void {
  const all = loadAll();
  if (all[platformId]) {
    delete all[platformId][paramKey];
    if (Object.keys(all[platformId]).length === 0) delete all[platformId];
    saveAll(all);
  }
}

/** 删除某平台所有覆盖 */
export function resetPlatformOverrides(platformId: string): void {
  const all = loadAll();
  delete all[platformId];
  saveAll(all);
}

/** 批量更新某平台的覆盖 */
export function setPlatformOverrides(
  platformId: string,
  overrides: PlatformOverrides,
): void {
  const all = loadAll();
  all[platformId] = overrides;
  saveAll(all);
}

/**
 * 将代码侧 ParamDef 与用户覆盖合并，返回最终生效的值。
 * 优先级：userOverride > codeDef
 */
export function resolveParam(
  codeDef: import('../types').ParamDef,
  override?: UserParamOverride,
): {
  hidden: boolean;
  fixedValue: unknown;
  defaultValue: unknown;
  options: ParamOption[] | undefined;
} {
  if (!override) {
    return {
      hidden: codeDef.hidden ?? false,
      fixedValue: codeDef.fixedValue,
      defaultValue: codeDef.defaultValue,
      options: codeDef.options,
    };
  }

  return {
    // disabled 直接等价于 hidden
    hidden: override.disabled ?? codeDef.hidden ?? false,
    // fixedValue 不允许用户覆盖（安全设计）
    fixedValue: codeDef.fixedValue,
    defaultValue: override.defaultValue !== undefined ? override.defaultValue : codeDef.defaultValue,
    options: override.options && override.options.length > 0 ? override.options : codeDef.options,
  };
}
