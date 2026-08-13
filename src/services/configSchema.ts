import type { ApiFormatType, AppConfig, CustomModelDef, CustomPlatformDef, GenerationMode, ParamDef, UserParamOverride, UserPlatformConfig } from '../types';

export const CURRENT_CONFIG_SCHEMA_VERSION = 2;
export const MAX_IMPORT_FILE_SIZE = 512 * 1024;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MODES: GenerationMode[] = ['text', 'image', 'imageTail', 'multiImage', 'multiModal'];

export const DEFAULT_APP_CONFIG: AppConfig = {
  schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
  activePlatformId: 'geekai',
  platforms: [],
  downloadPath: '',
  autoDownload: false,
  useSystemProxy: false,
  httpProxy: '',
  uploadCk: '',
  imageUploadMode: 'geekai',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const hasPollutionKey = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasPollutionKey);
  return Object.keys(value).some(key => FORBIDDEN_KEYS.has(key) || hasPollutionKey((value as Record<string, unknown>)[key]));
};

export const isSafeConfigLike = (value: unknown): value is Partial<AppConfig> => isRecord(value) && !hasPollutionKey(value);

const str = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const optionalStr = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value : undefined;
const bool = (value: unknown, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback;
const stripUndefined = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const apiFormat = (value: unknown, fallback: ApiFormatType = 'unified'): ApiFormatType =>
  value === 'openai' || value === 'seedance' || value === 'unified' ? value : fallback;

const optionalApiFormat = (value: unknown): ApiFormatType | undefined =>
  value === 'openai' || value === 'seedance' || value === 'unified' ? value : undefined;

const imageUploadMode = (value: unknown, fallback: AppConfig['imageUploadMode']): AppConfig['imageUploadMode'] =>
  value === 'geekai' || value === 'base64' || value === 'url' ? value : fallback;

const normalizePlatformId = (value: string): string =>
  value === 'doubao-official' ? 'seedance' : value;

const sanitizeOptions = (value: unknown) => Array.isArray(value)
  ? value.filter(isRecord).map(opt => ({
      label: str(opt.label),
      value: typeof opt.value === 'string' || typeof opt.value === 'number' ? opt.value : '',
    })).filter(opt => opt.label)
  : undefined;

const sanitizeParamOverride = (value: unknown): UserParamOverride | undefined => {
  if (!isRecord(value)) return undefined;
  const output: UserParamOverride = {};
  if (typeof value.disabled === 'boolean') output.disabled = value.disabled;
  if (['string', 'number', 'boolean'].includes(typeof value.defaultValue)) output.defaultValue = value.defaultValue;
  const options = sanitizeOptions(value.options);
  if (options?.length) output.options = options;
  return Object.keys(output).length ? output : undefined;
};

const sanitizeOverrides = (value: unknown): Record<string, UserParamOverride> | undefined => {
  if (!isRecord(value)) return undefined;
  const output: Record<string, UserParamOverride> = {};
  for (const [key, override] of Object.entries(value)) {
    if (!key || FORBIDDEN_KEYS.has(key)) continue;
    const safe = sanitizeParamOverride(override);
    if (safe) output[key] = safe;
  }
  return Object.keys(output).length ? output : undefined;
};

const sanitizeParamType = (value: unknown): ParamDef['type'] =>
  typeof value === 'string' && value.trim() ? value.trim() : 'string';

const sanitizeUnknownValue = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (typeof value === 'number' && !Number.isFinite(value)) return undefined;
  if (hasPollutionKey(value)) return undefined;
  return value;
};

const sanitizeImageLimits = (value: unknown): ParamDef['imageLimits'] | undefined => {
  if (!isRecord(value)) return undefined;
  const min = typeof value.min === 'number' && Number.isFinite(value.min) ? value.min : undefined;
  const max = typeof value.max === 'number' && Number.isFinite(value.max) ? value.max : undefined;
  return min !== undefined || max !== undefined ? { min, max } : undefined;
};

const sanitizeParams = (value: unknown): ParamDef[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const params: ParamDef[] = value.filter(isRecord).map(param => stripUndefined({
    key: str(param.key),
    apiKey: optionalStr(param.apiKey),
    label: str(param.label),
    type: sanitizeParamType(param.type),
    modes: Array.isArray(param.modes) ? param.modes.filter((m): m is GenerationMode => MODES.includes(m as GenerationMode)) : undefined,
    hidden: typeof param.hidden === 'boolean' ? param.hidden : undefined,
    fixedValue: Object.prototype.hasOwnProperty.call(param, 'fixedValue') ? sanitizeUnknownValue(param.fixedValue) : undefined,
    defaultValue: Object.prototype.hasOwnProperty.call(param, 'defaultValue') ? sanitizeUnknownValue(param.defaultValue) : undefined,
    options: sanitizeOptions(param.options),
    imageLimits: sanitizeImageLimits(param.imageLimits),
    required: typeof param.required === 'boolean' ? param.required : undefined,
  })).filter(param => param.key && param.label);
  return params.length ? params : undefined;
};

const sanitizeModels = (value: unknown): CustomModelDef[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const models: CustomModelDef[] = value.filter(isRecord).map(model => ({
    id: str(model.id),
    name: str(model.name),
    label: str(model.label),
    modes: Array.isArray(model.modes) ? model.modes.filter((m): m is GenerationMode => MODES.includes(m as GenerationMode)) : (['text'] as GenerationMode[]),
    disabled: typeof model.disabled === 'boolean' ? model.disabled : undefined,
    apiFormat: optionalApiFormat(model.apiFormat),
    params: sanitizeParams(model.params),
  })).filter(model => model.id && model.name && model.label && model.modes.length > 0);
  return models.length ? models : undefined;
};

function sanitizePlatforms(value: unknown, current: UserPlatformConfig[] = [], includeSecrets: boolean): UserPlatformConfig[] {
  if (!Array.isArray(value)) return current;
  return value.filter(isRecord).map(platform => {
    const platformId = str(platform.platformId || platform.id);
    const existing = current.find(p => p.platformId === platformId);
    const endpoints = isRecord(platform.endpoints) ? stripUndefined({
      createVideo: optionalStr(platform.endpoints.createVideo),
      queryTask: optionalStr(platform.endpoints.queryTask),
      queryTaskList: optionalStr(platform.endpoints.queryTaskList),
      deleteTask: optionalStr(platform.endpoints.deleteTask),
    }) : undefined;
    return stripUndefined({
      platformId,
      apiKey: includeSecrets ? str(platform.apiKey, existing?.apiKey ?? '') : (existing?.apiKey ?? ''),
      baseUrl: optionalStr(platform.baseUrl),
      disabled: typeof platform.disabled === 'boolean' ? platform.disabled : existing?.disabled,
      endpoints,
      paramOverrides: sanitizeOverrides(platform.paramOverrides),
      imageUploadMode: imageUploadMode(platform.imageUploadMode, imageUploadMode(existing?.imageUploadMode, 'geekai')),
      extraModels: sanitizeModels(platform.extraModels),
      defaultModel: optionalStr(platform.defaultModel),
    });
  }).filter(platform => platform.platformId);
}

function sanitizeCustomPlatforms(value: unknown, current: CustomPlatformDef[] = [], includeSecrets: boolean): CustomPlatformDef[] | undefined {
  if (!Array.isArray(value)) return current;
  const platforms = value.filter(isRecord).map(platform => {
    const id = str(platform.id);
    const existing = current.find(cp => cp.id === id);
    const endpointsValue = platform.endpoints;
    const endpoints = isRecord(endpointsValue) ? {
      createVideo: str(endpointsValue.createVideo),
      queryTask: str(endpointsValue.queryTask),
      downloadVideo: optionalStr(endpointsValue.downloadVideo),
      queryTaskList: optionalStr(endpointsValue.queryTaskList),
      deleteTask: optionalStr(endpointsValue.deleteTask),
    } : { createVideo: '', queryTask: '' };
    return stripUndefined({
      id,
      name: str(platform.name),
      baseUrl: str(platform.baseUrl),
      apiKey: includeSecrets ? str(platform.apiKey, existing?.apiKey ?? '') : (existing?.apiKey ?? ''),
      disabled: typeof platform.disabled === 'boolean' ? platform.disabled : existing?.disabled,
      endpoints,
      apiFormat: apiFormat(platform.apiFormat),
      imageUploadMode: imageUploadMode(platform.imageUploadMode, imageUploadMode(existing?.imageUploadMode, 'url')),
      defaultModel: optionalStr(platform.defaultModel),
      models: sanitizeModels(platform.models),
    });
  }).filter(platform => platform.id && platform.name);
  return platforms.length ? platforms : undefined;
}

export function normalizeAppConfig(
  value: unknown,
  options: { current?: AppConfig; includeSecrets?: boolean } = {},
): AppConfig {
  const current = options.current ?? DEFAULT_APP_CONFIG;
  const includeSecrets = options.includeSecrets ?? true;
  if (!isSafeConfigLike(value)) return { ...DEFAULT_APP_CONFIG, ...current, schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION };

  return stripUndefined({
    schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
    activePlatformId: normalizePlatformId(str(value.activePlatformId, current.activePlatformId)),
    platforms: sanitizePlatforms(value.platforms, current.platforms, includeSecrets),
    customPlatforms: sanitizeCustomPlatforms(value.customPlatforms, current.customPlatforms, includeSecrets),
    downloadPath: str(value.downloadPath, current.downloadPath),
    autoDownload: bool(value.autoDownload, current.autoDownload),
    useSystemProxy: bool(value.useSystemProxy, current.useSystemProxy),
    httpProxy: str(value.httpProxy, current.httpProxy),
    uploadCk: includeSecrets ? str(value.uploadCk, current.uploadCk) : current.uploadCk,
    imageUploadMode: imageUploadMode(value.imageUploadMode, current.imageUploadMode ?? 'geekai'),
  });
}

export function migrateLegacyConfig(legacy: unknown): AppConfig {
  if (!isRecord(legacy) || hasPollutionKey(legacy)) return DEFAULT_APP_CONFIG;
  const legacyPlatforms = Array.isArray(legacy.platforms)
    ? legacy.platforms.map(p => isRecord(p) ? ({
        platformId: str(p.id || p.platformId, 'geekai'),
        apiKey: str(p.apiKey, str(legacy.apiKey)),
      }) : undefined).filter(Boolean)
    : [];
  return normalizeAppConfig({
    activePlatformId: legacy.activePlatformId,
    uploadCk: legacy.uploadCk,
    useSystemProxy: legacy.useSystemProxy,
    httpProxy: legacy.httpProxy,
    downloadPath: legacy.downloadPath,
    autoDownload: legacy.autoDownload,
    platforms: legacyPlatforms,
  });
}

export function createImportedConfig(parsed: unknown, current: AppConfig): AppConfig {
  return normalizeAppConfig(parsed, { current, includeSecrets: false });
}

export function createSafeExportConfig(config: AppConfig): AppConfig {
  return stripUndefined({
    ...normalizeAppConfig(config),
    schemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
    uploadCk: '',
    platforms: config.platforms.map(platform => ({ ...platform, apiKey: '' })),
    customPlatforms: (config.customPlatforms ?? []).map(platform => ({ ...platform, apiKey: '' })),
  });
}
