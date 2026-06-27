import type { AppConfig } from '../types';
import { createImportedConfig, createSafeExportConfig, isSafeConfigLike, MAX_IMPORT_FILE_SIZE } from './configSchema';
import { parseJson } from '../utils/storage';

export { MAX_IMPORT_FILE_SIZE };

export const SAFE_CONFIG_EXPORT_FILENAME = 'video-gen-config.safe.json';

export interface ConfigImportSummary {
  platformConfigs: number;
  customPlatforms: number;
  customModels: number;
  paramOverrides: number;
  systemSettings: string[];
  ignoredSecretFields: number;
  message: string;
}

export type ConfigImportResult =
  | { ok: true; config: AppConfig; summary: ConfigImportSummary }
  | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const nonEmptyString = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

function buildImportSummary(parsed: unknown, config: AppConfig): ConfigImportSummary {
  const parsedRecord = isRecord(parsed) ? parsed : {};
  const rawPlatforms = Array.isArray(parsedRecord.platforms) ? parsedRecord.platforms.filter(isRecord) : [];
  const rawPlatformIds = new Set(rawPlatforms.map(platform => String(platform.platformId || platform.id || '')).filter(Boolean));
  const importedPlatforms = config.platforms.filter(platform => rawPlatformIds.has(platform.platformId));

  const rawCustomPlatforms = Array.isArray(parsedRecord.customPlatforms) ? parsedRecord.customPlatforms.filter(isRecord) : [];
  const rawCustomPlatformIds = new Set(rawCustomPlatforms.map(platform => String(platform.id || '')).filter(Boolean));
  const importedCustomPlatforms = (config.customPlatforms ?? []).filter(platform => rawCustomPlatformIds.has(platform.id));

  const extraModels = importedPlatforms.reduce((total, platform) => total + (platform.extraModels?.length ?? 0), 0);
  const customPlatformModels = importedCustomPlatforms.reduce((total, platform) => total + (platform.models?.length ?? 0), 0);
  const paramOverrides = importedPlatforms.reduce((total, platform) => total + Object.keys(platform.paramOverrides ?? {}).length, 0);

  const systemSettings: string[] = [];
  if (hasOwn(parsedRecord, 'activePlatformId')) systemSettings.push('当前平台');
  if (hasOwn(parsedRecord, 'downloadPath')) systemSettings.push('下载目录');
  if (hasOwn(parsedRecord, 'autoDownload')) systemSettings.push('自动下载');
  if (hasOwn(parsedRecord, 'imageUploadMode')) systemSettings.push('图片上传方式');

  const platformSecretCount = rawPlatforms.filter(platform => nonEmptyString(platform.apiKey)).length;
  const customPlatformSecretCount = rawCustomPlatforms.filter(platform => nonEmptyString(platform.apiKey)).length;
  const ignoredSecretFields = (nonEmptyString(parsedRecord.uploadCk) ? 1 : 0) + platformSecretCount + customPlatformSecretCount;

  const summary: Omit<ConfigImportSummary, 'message'> = {
    platformConfigs: importedPlatforms.length,
    customPlatforms: importedCustomPlatforms.length,
    customModels: extraModels + customPlatformModels,
    paramOverrides,
    systemSettings,
    ignoredSecretFields,
  };

  const parts: string[] = [];
  if (summary.platformConfigs > 0) parts.push(`内置平台配置 ${summary.platformConfigs} 个`);
  if (summary.customPlatforms > 0) parts.push(`自定义平台 ${summary.customPlatforms} 个`);
  if (summary.customModels > 0) parts.push(`自定义模型 ${summary.customModels} 个`);
  if (summary.paramOverrides > 0) parts.push(`参数覆盖 ${summary.paramOverrides} 项`);
  if (summary.systemSettings.length > 0) parts.push(`系统设置（${summary.systemSettings.join('、')}）`);

  const importedText = parts.length > 0 ? parts.join('、') : '未发现可导入的非敏感配置，已保留当前配置';
  const ignoredText = summary.ignoredSecretFields > 0 ? `已忽略文件中的 ${summary.ignoredSecretFields} 个敏感字段。` : '';

  return {
    ...summary,
    message: `配置已导入：${importedText}。${ignoredText}导入不会恢复 API Key / uploadCk，需要在配置页重新填写。`,
  };
}

export function serializeConfigForExport(config: AppConfig): string {
  return JSON.stringify(createSafeExportConfig(config), null, 2);
}

export function parseImportedConfigText(raw: string, current: AppConfig): ConfigImportResult {
  const parsed = parseJson<unknown | null>(raw, null, isSafeConfigLike);
  if (!parsed) return { ok: false, error: '文件格式错误，请选择有效且安全的 JSON 配置文件' };
  const config = createImportedConfig(parsed, current);
  return { ok: true, config, summary: buildImportSummary(parsed, config) };
}
