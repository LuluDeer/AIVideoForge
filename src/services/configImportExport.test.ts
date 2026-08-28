import { describe, expect, it } from 'vitest';
import { parseImportedConfigText, serializeConfigForExport } from './configImportExport';
import { createImportedConfig, hasPollutionKey } from './configSchema';
import type { AppConfig } from '../types';

const currentConfig: AppConfig = {
  schemaVersion: 2,
  activePlatformId: 'geekai',
  platforms: [{ platformId: 'geekai', apiKey: 'current-api-key' }],
  customPlatforms: [{
    id: 'custom-old',
    name: 'Old Custom',
    baseUrl: 'https://old.example.com',
    apiKey: 'current-custom-key',
    endpoints: { createVideo: '/create', queryTask: '/query' },
    apiFormat: 'unified',
  }],
  downloadPath: 'D:/downloads',
  autoDownload: true,
  useSystemProxy: false,
  httpProxy: 'http://127.0.0.1:7890',
  uploadCk: 'current-upload-cookie',
  cloudreveApiKey: 'current-cloudreve-key',
  imageUploadMode: 'geekai',
};

describe('config import/export safety', () => {
  it('export 只包含平台/自定义平台与模型，不含系统配置和密钥', () => {
    const exported = JSON.parse(serializeConfigForExport(currentConfig)) as AppConfig;
    expect(Object.keys(exported).sort()).toEqual(['customPlatforms', 'platforms', 'schemaVersion']);
    expect(exported.schemaVersion).toBe(2);
    expect(exported.platforms[0].apiKey).toBe('');
    expect(exported.customPlatforms?.[0].apiKey).toBe('');
    // 系统配置不出现在导出文件中
    expect(exported.uploadCk).toBeUndefined();
    expect(exported.cloudreveApiKey).toBeUndefined();
    expect(exported.activePlatformId).toBeUndefined();
    expect(exported.downloadPath).toBeUndefined();
    expect(exported.autoDownload).toBeUndefined();
    expect(exported.useSystemProxy).toBeUndefined();
    expect(exported.httpProxy).toBeUndefined();
    expect(exported.imageUploadMode).toBeUndefined();
    // 不污染当前配置
    expect(currentConfig.uploadCk).toBe('current-upload-cookie');
    expect(currentConfig.platforms[0].apiKey).toBe('current-api-key');
  });

  it('import 不覆盖系统配置，保留当前密钥，合并平台与模型', async () => {
    const incoming = {
      activePlatformId: 'apizzz',
      downloadPath: 'E:/safe',
      autoDownload: false,
      useSystemProxy: true,
      httpProxy: 'http://127.0.0.1:1080',
      uploadCk: 'file-upload-cookie',
      imageUploadMode: 'url',
      platforms: [{
        platformId: 'geekai',
        apiKey: 'file-api-key',
        baseUrl: 'https://api.example.com',
        paramOverrides: { duration: { defaultValue: 5 } },
        extraModels: [{ id: 'm1', name: 'M1', label: 'M1', modes: ['text'] }],
      }, {
        platformId: 'new-builtin',
        apiKey: 'file-new-builtin-key',
        baseUrl: 'https://new.example.com',
      }],
      customPlatforms: [{
        id: 'custom-old',
        name: 'Imported Custom',
        baseUrl: 'https://custom.example.com',
        apiKey: 'file-custom-key',
        endpoints: { createVideo: '/create', queryTask: '/query' },
        apiFormat: 'openai',
        models: [{ id: 'cm1', name: 'CM1', label: 'CM1', modes: ['image'] }],
      }, {
        id: 'custom-new',
        name: 'New Custom',
        baseUrl: 'https://newcustom.example.com',
        apiKey: 'file-new-custom-key',
        endpoints: { createVideo: '/create', queryTask: '/query' },
        apiFormat: 'unified',
      }],
    };
    const result = await parseImportedConfigText(JSON.stringify(incoming), currentConfig);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // 系统配置保留当前值
    expect(result.config.activePlatformId).toBe('geekai');
    expect(result.config.downloadPath).toBe('D:/downloads');
    expect(result.config.autoDownload).toBe(true);
    expect(result.config.useSystemProxy).toBe(false);
    expect(result.config.httpProxy).toBe('http://127.0.0.1:7890');
    expect(result.config.imageUploadMode).toBe('geekai');
    expect(result.config.uploadCk).toBe('current-upload-cookie');
    expect(result.config.cloudreveApiKey).toBe('current-cloudreve-key');

    // 已有平台：密钥保留，其他配置合并
    const geekai = result.config.platforms.find(p => p.platformId === 'geekai');
    expect(geekai?.apiKey).toBe('current-api-key');
    expect(geekai?.baseUrl).toBe('https://api.example.com');
    expect(geekai?.extraModels?.length).toBe(1);
    expect(geekai?.paramOverrides).toEqual({ duration: { defaultValue: 5 } });

    // 新内置平台：直接新建但不带密钥
    const newBuiltin = result.config.platforms.find(p => p.platformId === 'new-builtin');
    expect(newBuiltin?.baseUrl).toBe('https://new.example.com');
    expect(newBuiltin?.apiKey).toBe('');

    // 已有自定义平台：密钥保留，其他配置合并
    const oldCustom = result.config.customPlatforms?.find(p => p.id === 'custom-old');
    expect(oldCustom?.apiKey).toBe('current-custom-key');
    expect(oldCustom?.name).toBe('Imported Custom');
    expect(oldCustom?.baseUrl).toBe('https://custom.example.com');
    expect(oldCustom?.apiFormat).toBe('openai');
    expect(oldCustom?.models?.length).toBe(1);

    // 新自定义平台：直接新建但不带密钥
    const newCustom = result.config.customPlatforms?.find(p => p.id === 'custom-new');
    expect(newCustom?.name).toBe('New Custom');
    expect(newCustom?.baseUrl).toBe('https://newcustom.example.com');
    expect(newCustom?.apiKey).toBe('');

    expect(result.summary.customModels).toBe(2);
    expect(result.summary.paramOverrides).toBe(1);
    expect(result.summary.ignoredSecretFields).toBe(5); // uploadCk + 2 平台 key + 2 自定义平台 key
    expect(result.summary.message).toContain('保留本机当前值');
    expect(result.summary.message).toContain('导入不会恢复 API Key / uploadCk');
  });

  it('rejects malformed or pollution-prone config input', async () => {
    expect((await parseImportedConfigText('not json', currentConfig)).ok).toBe(false);
    const polluted = JSON.parse('{"platforms":[],"__proto__":{"polluted":true}}') as unknown;
    expect(hasPollutionKey(polluted)).toBe(true);
    expect(createImportedConfig(polluted, currentConfig)).toMatchObject({
      uploadCk: currentConfig.uploadCk,
      activePlatformId: currentConfig.activePlatformId,
    });
  });
});
