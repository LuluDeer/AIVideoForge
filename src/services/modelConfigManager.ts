/**
 * modelConfigManager.ts
 * 将代码侧 ParamDef 与用户参数覆盖（UserParamOverride）合并，返回最终生效值。
 *
 * 注意：用户覆盖的持久化由 ConfigContext 的 paramOverrides 统一管理，
 * 本模块只保留纯合并逻辑，不再维护独立的 localStorage 副本。
 */
import type { ParamDef, UserParamOverride, ParamOption } from '../types';

/**
 * 优先级：userOverride > codeDef
 */
export function resolveParam(
  codeDef: ParamDef,
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
