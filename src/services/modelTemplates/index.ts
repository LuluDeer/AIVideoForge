import type { GenerationMode, ModelDef, PlatformDef } from '../../types';
import { apizzzPlatformDef } from './apizzz';
import { geekaiPlatformDef } from './geekai';
import { klingPlatformDef } from './kling';
import { doubaoOfficialPlatformDef, seedancePlatformDef } from './seedance';

export { buildDefaultParams } from './commonParams';
export { apizzzPlatformDef } from './apizzz';
export { geekaiPlatformDef } from './geekai';
export { klingPlatformDef } from './kling';
export { createSeedanceModels, doubaoOfficialPlatformDef, seedancePlatformDef } from './seedance';

export const PLATFORM_DEFS: PlatformDef[] = [
  seedancePlatformDef,
  // doubaoOfficialPlatformDef 与 seedancePlatformDef 使用同一套火山方舟/豆包官方 API。
  // 旧配置仍通过 getPlatformDef 兼容，UI 默认不再把它展示成第二个官方平台。
  geekaiPlatformDef,
  apizzzPlatformDef,
  klingPlatformDef,
];

export const COMPAT_PLATFORM_DEFS: PlatformDef[] = [
  ...PLATFORM_DEFS,
  doubaoOfficialPlatformDef,
];

/** 根据 id 查找平台定义 */
export function getPlatformDef(platformId: string): PlatformDef | undefined {
  return COMPAT_PLATFORM_DEFS.find(p => p.id === platformId);
}

/** 根据 platformId + modelId 查找模型定义 */
export function getModelDef(platformId: string, modelId: string): ModelDef | undefined {
  return getPlatformDef(platformId)?.models.find(m => m.id === modelId);
}

/** 获取某平台在指定模式下支持的模型列表 */
export function getModelsForMode(platformId: string, mode: GenerationMode): ModelDef[] {
  return getPlatformDef(platformId)?.models.filter(m => m.modes.includes(mode)) ?? [];
}
