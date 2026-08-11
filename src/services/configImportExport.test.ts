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
  imageUploadMode: 'geekai',
};

describe('config import/export safety', () => {
  it('redacts secrets during export without mutating current config', () => {
    const exported = JSON.parse(serializeConfigForExport(currentConfig)) as AppConfig;
    expect(exported.uploadCk).toBe('');
    expect(exported.platforms[0].apiKey).toBe('');
    expect(exported.customPlatforms?.[0].apiKey).toBe('');
    expect(currentConfig.uploadCk).toBe('current-upload-cookie');
    expect(currentConfig.platforms[0].apiKey).toBe('current-api-key');
  });

  it('imports non-secret settings while preserving current secrets', () => {
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
      }],
      customPlatforms: [{
        id: 'custom-old',
        name: 'Imported Custom',
        baseUrl: 'https://custom.example.com',
        apiKey: 'file-custom-key',
        endpoints: { createVideo: '/create', queryTask: '/query' },
        apiFormat: 'openai',
        models: [{ id: 'cm1', name: 'CM1', label: 'CM1', modes: ['image'] }],
      }],
    };
    const result = parseImportedConfigText(JSON.stringify(incoming), currentConfig);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.uploadCk).toBe('current-upload-cookie');
    expect(result.config.platforms[0].apiKey).toBe('current-api-key');
    expect(result.config.customPlatforms?.[0].apiKey).toBe('current-custom-key');
    expect(result.config.activePlatformId).toBe('apizzz');
    expect(result.config.useSystemProxy).toBe(true);
    expect(result.config.httpProxy).toBe('http://127.0.0.1:1080');
    expect(result.summary.ignoredSecretFields).toBe(3);
    expect(result.summary.message).toContain('导入不会恢复 API Key / uploadCk');
    expect(result.summary.customModels).toBe(2);
    expect(result.summary.paramOverrides).toBe(1);
  });

  it('rejects malformed or pollution-prone config input', () => {
    expect(parseImportedConfigText('not json', currentConfig).ok).toBe(false);
    const polluted = JSON.parse('{"platforms":[],"__proto__":{"polluted":true}}') as unknown;
    expect(hasPollutionKey(polluted)).toBe(true);
    expect(createImportedConfig(polluted, currentConfig)).toMatchObject({
      uploadCk: currentConfig.uploadCk,
      activePlatformId: currentConfig.activePlatformId,
    });
  });
});
