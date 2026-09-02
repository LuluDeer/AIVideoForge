import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_CONFIG, createImportedConfig, normalizeAppConfig } from './configSchema';
import type { AppConfig } from '../types';

const baseConfig: AppConfig = {
  ...DEFAULT_APP_CONFIG,
  platforms: [{
    platformId: 'geekai',
    apiKey: 'sk-test',
    accounts: [{ id: 'acc-1', label: '账号一', apiKey: 'sk-account' }],
    activeAccountId: 'acc-1',
    imageUploadConfig: { cosBucket: 'custom.cos.example.com' },
  }],
};

describe('normalizeAppConfig 字段保真', () => {
  it('往返保留 accounts / activeAccountId / imageUploadConfig', () => {
    const normalized = normalizeAppConfig(baseConfig, { current: DEFAULT_APP_CONFIG });
    const platform = normalized.platforms[0];
    expect(platform.accounts).toEqual([{ id: 'acc-1', label: '账号一', apiKey: 'sk-account' }]);
    expect(platform.activeAccountId).toBe('acc-1');
    expect(platform.imageUploadConfig).toEqual({ cosBucket: 'custom.cos.example.com' });
  });

  it('多次 normalize 不丢失 accounts（回归：曾因重建对象丢字段）', () => {
    let config = normalizeAppConfig(baseConfig, { current: DEFAULT_APP_CONFIG });
    config = normalizeAppConfig(config, { current: config });
    config = normalizeAppConfig(config, { current: config });
    expect(config.platforms[0].accounts?.length).toBe(1);
    expect(config.platforms[0].activeAccountId).toBe('acc-1');
  });

  it('导入配置不携带 accounts 中的密钥，但保留结构', () => {
    const imported = createImportedConfig(baseConfig, DEFAULT_APP_CONFIG);
    const platform = imported.platforms[0];
    expect(platform.accounts).toEqual([{ id: 'acc-1', label: '账号一', apiKey: '' }]);
    expect(platform.apiKey).toBe('');
  });

  it('拒绝含原型污染键的 accounts 条目值', () => {
    const dirty = {
      ...baseConfig,
      platforms: [{
        platformId: 'geekai',
        apiKey: 'sk',
        accounts: [{ id: 'a', label: 'l', apiKey: 'k', __proto__: { evil: true } }],
      }],
    };
    const normalized = normalizeAppConfig(dirty, { current: DEFAULT_APP_CONFIG });
    expect((normalized.platforms[0].accounts?.[0] as Record<string, unknown>)?.evil).toBeUndefined();
  });
});
