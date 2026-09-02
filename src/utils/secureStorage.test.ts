import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptAppConfigFromStorage, encryptAppConfigForStorage, isEncryptedSecret } from './secureStorage';
import { DEFAULT_APP_CONFIG } from '../services/configSchema';
import type { AppConfig } from '../types';

/** 模拟 Electron safeStorage：base64 加/解密，加密值带 enc: 前缀由 secureStorage 负责 */
const installMockElectronApi = () => {
  const api = {
    encryptString: vi.fn(async (plain: string) => ({ success: true, encrypted: Buffer.from(plain, 'utf-8').toString('base64'), available: true })),
    decryptString: vi.fn(async (encrypted: string) => ({ success: true, decrypted: Buffer.from(encrypted, 'base64').toString('utf-8') })),
  };
  (globalThis as Record<string, unknown>).window = { electronAPI: api };
  return api;
};

const baseConfig: AppConfig = {
  ...DEFAULT_APP_CONFIG,
  uploadCk: 'geekai_session=abc',
  cloudreveApiKey: 'cr-key',
  platforms: [{
    platformId: 'geekai',
    apiKey: 'sk-secret',
    accounts: [{ id: 'acc-1', label: '主账号', apiKey: 'sk-account' }],
  }],
  customPlatforms: [{
    id: 'relay',
    name: '中转站',
    baseUrl: 'https://relay.example.com',
    apiKey: 'sk-relay',
    endpoints: { createVideo: '/v1/create', queryTask: '/v1/query' },
    apiFormat: 'openai',
  }],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe('secureStorage 加密往返', () => {
  it('加密后所有敏感字段带 enc: 前缀，解密可完整还原（含多账号与自定义平台）', async () => {
    installMockElectronApi();
    const encrypted = await encryptAppConfigForStorage(baseConfig);

    expect(isEncryptedSecret(encrypted.platforms[0].apiKey)).toBe(true);
    expect(isEncryptedSecret(encrypted.platforms[0].accounts?.[0].apiKey)).toBe(true);
    expect(isEncryptedSecret(encrypted.customPlatforms?.[0].apiKey ?? '')).toBe(true);
    expect(isEncryptedSecret(encrypted.uploadCk)).toBe(true);
    expect(isEncryptedSecret(encrypted.cloudreveApiKey)).toBe(true);

    const decrypted = await decryptAppConfigFromStorage(encrypted);
    expect(decrypted.platforms[0].apiKey).toBe('sk-secret');
    expect(decrypted.platforms[0].accounts?.[0].apiKey).toBe('sk-account');
    expect(decrypted.customPlatforms?.[0].apiKey).toBe('sk-relay');
    expect(decrypted.uploadCk).toBe('geekai_session=abc');
    expect(decrypted.cloudreveApiKey).toBe('cr-key');
  });

  it('重复加密幂等：已加密字段不会被二次加密', async () => {
    installMockElectronApi();
    const once = await encryptAppConfigForStorage(baseConfig);
    const twice = await encryptAppConfigForStorage(once);
    expect(twice.platforms[0].apiKey).toBe(once.platforms[0].apiKey);
    expect(twice.platforms[0].accounts?.[0].apiKey).toBe(once.platforms[0].accounts?.[0].apiKey);
  });

  it('历史明文配置向后兼容：无前缀字段解密时原样返回', async () => {
    installMockElectronApi();
    const decrypted = await decryptAppConfigFromStorage(baseConfig);
    expect(decrypted.platforms[0].apiKey).toBe('sk-secret');
    expect(decrypted.uploadCk).toBe('geekai_session=abc');
  });

  it('加密不可用时回退明文，保证配置仍可用', async () => {
    (globalThis as Record<string, unknown>).window = {
      electronAPI: { encryptString: async () => ({ success: false, available: false, error: '不可用' }) },
    };
    const encrypted = await encryptAppConfigForStorage(baseConfig);
    expect(encrypted.platforms[0].apiKey).toBe('sk-secret');
  });
});
