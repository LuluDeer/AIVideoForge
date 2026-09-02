import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AppConfig, RuntimePlatform, UserPlatformConfig, UserParamOverride, CustomPlatformDef } from '../types';
import { PLATFORM_DEFS, buildDefaultParams } from '../services/modelTemplates';
import { readJsonStorage, writeJsonStorage } from '../utils/storage';
import { logger } from '../utils/logger';
import { DEFAULT_APP_CONFIG, migrateLegacyConfig, normalizeAppConfig } from '../services/configSchema';
import { encryptAppConfigForStorage, decryptAppConfigFromStorage, isEncryptedSecret } from '../utils/secureStorage';
import { ConfigContext } from './configContextValue';
import type { ConfigContextType } from './configContextValue';

const STORAGE_KEY = 'video_gen_app_config';

function mergeToRuntime(platformId: string, userConfig?: UserPlatformConfig): RuntimePlatform {
  const def = PLATFORM_DEFS.find(p => p.id === platformId);
  if (!def) {
    return {
      id: platformId,
      name: platformId,
      baseUrl: userConfig?.baseUrl ?? '',
      apiKey: userConfig?.apiKey ?? '',
      endpoints: { createVideo: '', queryTask: '' },
      defaultModel: '',
      models: [],
      paramOverrides: userConfig?.paramOverrides ?? {},
    };
  }
  return {
    id: def.id,
    name: def.name,
    baseUrl: userConfig?.baseUrl ?? def.defaultBaseUrl,
    apiKey: userConfig?.apiKey ?? '',
    endpoints: {
      createVideo: userConfig?.endpoints?.createVideo ?? def.defaultEndpoints.createVideo,
      queryTask: userConfig?.endpoints?.queryTask ?? def.defaultEndpoints.queryTask,
      downloadVideo: userConfig?.endpoints?.downloadVideo ?? def.defaultEndpoints.downloadVideo,
      queryTaskList: userConfig?.endpoints?.queryTaskList ?? def.defaultEndpoints.queryTaskList,
      deleteTask: userConfig?.endpoints?.deleteTask ?? def.defaultEndpoints.deleteTask,
    },
    defaultModel: def.defaultModel,
    models: def.models,
    paramOverrides: userConfig?.paramOverrides ?? {},
    imageUploadMode: userConfig?.imageUploadMode ?? (def.id === 'seedance' ? 'base64' : 'geekai'),
    imageUploadConfig: (userConfig?.imageUploadConfig || def.imageUploadConfig)
      ? { ...def.imageUploadConfig, ...userConfig?.imageUploadConfig }
      : undefined,
  };
}

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = readJsonStorage<unknown | null>(STORAGE_KEY, null);
      const legacy = readJsonStorage<unknown | null>('geekai_config', null);
      let config: AppConfig | null = null;
      if (saved) {
        config = normalizeAppConfig(saved, { current: DEFAULT_APP_CONFIG });
      } else if (legacy) {
        config = migrateLegacyConfig(legacy);
      }
      if (config) {
        // 落盘时敏感字段以 enc: 密文存储，加载必须解密还原为明文，否则请求会带出密文 Key
        const secretFields = (value: AppConfig): string[] => [
          ...value.platforms.map(p => p.apiKey),
          ...(value.customPlatforms ?? []).map(p => p.apiKey),
          value.uploadCk,
          value.cloudreveApiKey,
        ];
        const before = secretFields(config);
        config = await decryptAppConfigFromStorage(config);
        const after = secretFields(config);
        const failedCount = before.filter((value, index) => isEncryptedSecret(value) && !after[index]).length;
        if (failedCount > 0) {
          logger.warn('ConfigContext', `有 ${failedCount} 个已保存的加密密钥无法解密（可能更换了系统账户或密钥库不可用），请重新填写`);
        }
      }
      if (cancelled) return;
      if (config) setAppConfig(config);
      setInitialized(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!initialized) return;
    let cancelled = false;
    // 防抖：避免逐字符键入时高频加密与写盘；加密为异步 IPC，完成后需确认仍是最新配置才落盘
    const timer = window.setTimeout(() => {
      void (async () => {
        const normalized = normalizeAppConfig(appConfig, { current: DEFAULT_APP_CONFIG });
        let payload: AppConfig;
        try {
          payload = await encryptAppConfigForStorage(normalized);
        } catch (error) {
          logger.warn('ConfigContext', '加密配置失败，本次以明文保存', error);
          payload = normalized;
        }
        if (cancelled) return;
        const ok = writeJsonStorage(STORAGE_KEY, payload, error => {
          logger.warn('ConfigContext', '自动保存配置失败', error);
        });
        if (!ok) return;
        if (window.electronAPI) {
          void window.electronAPI.setHttpProxyConfig({
            useSystemProxy: normalized.useSystemProxy,
            httpProxy: normalized.httpProxy ?? '',
          }).catch(error => {
            logger.warn('ConfigContext', '同步代理配置失败', error);
          });
        }
        setSaveSuccess(true);
        window.setTimeout(() => setSaveSuccess(false), 2000);
      })();
    }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [appConfig, initialized]);

  const updateAppConfig = useCallback((updates: Partial<AppConfig>) => {
    setAppConfig(prev => normalizeAppConfig({ ...prev, ...updates }, { current: prev }));
    setSaveSuccess(false);
  }, []);

  const getUserPlatformConfig = useCallback((platformId: string): UserPlatformConfig => {
    const direct = appConfig.platforms.find(p => p.platformId === platformId);
    if (direct) return direct;
    if (platformId === 'seedance') {
      const legacyOfficial = appConfig.platforms.find(p => p.platformId === 'doubao-official');
      if (legacyOfficial) return { ...legacyOfficial, platformId: 'seedance' };
    }
    return { platformId, apiKey: '' };
  }, [appConfig.platforms]);

  const updateUserPlatformConfig = useCallback((platformId: string, updates: Partial<UserPlatformConfig>) => {
    setAppConfig(prev => {
      const existing = prev.platforms.find(p => p.platformId === platformId);
      const updated: UserPlatformConfig = existing ? { ...existing, ...updates } : { platformId, apiKey: '', ...updates };
      const platforms = existing ? prev.platforms.map(p => p.platformId === platformId ? updated : p) : [...prev.platforms, updated];
      return normalizeAppConfig({ ...prev, platforms }, { current: prev });
    });
    setSaveSuccess(false);
  }, []);

  const updateParamOverride = useCallback((platformId: string, paramKey: string, override: Partial<UserParamOverride>, modelId?: string) => {
    const storageKey = modelId ? `${modelId}__${paramKey}` : paramKey;
    setAppConfig(prev => {
      const existing = prev.platforms.find(p => p.platformId === platformId);
      const currentOverrides = existing?.paramOverrides ?? {};
      const updatedOverride = { ...(currentOverrides[storageKey] ?? {}), ...override };
      const isEffectivelyEmpty = Object.values(updatedOverride).every(v => v === undefined || v === false);
      const newOverrides = isEffectivelyEmpty
        ? (() => { const o = { ...currentOverrides }; delete o[storageKey]; return o; })()
        : { ...currentOverrides, [storageKey]: updatedOverride };
      const platforms = existing
        ? prev.platforms.map(p => p.platformId === platformId ? { ...p, paramOverrides: newOverrides } : p)
        : [...prev.platforms, { platformId, apiKey: '', paramOverrides: newOverrides }];
      return normalizeAppConfig({ ...prev, platforms }, { current: prev });
    });
    setSaveSuccess(false);
  }, []);

  const resetParamOverride = useCallback((platformId: string, paramKey: string, modelId?: string) => {
    const storageKey = modelId ? `${modelId}__${paramKey}` : paramKey;
    setAppConfig(prev => {
      const existing = prev.platforms.find(p => p.platformId === platformId);
      if (!existing?.paramOverrides) return prev;
      const newOverrides = { ...existing.paramOverrides };
      delete newOverrides[storageKey];
      const platforms = prev.platforms.map(p => p.platformId === platformId ? { ...p, paramOverrides: newOverrides } : p);
      return normalizeAppConfig({ ...prev, platforms }, { current: prev });
    });
    setSaveSuccess(false);
  }, []);

  const getParamOverride = useCallback((platformId: string, paramKey: string, modelId?: string): UserParamOverride | undefined => {
    const userConfig = appConfig.platforms.find(p => p.platformId === platformId);
    if (!userConfig?.paramOverrides) return undefined;
    const overrides = userConfig.paramOverrides;
    if (modelId) {
      const modelKey = `${modelId}__${paramKey}`;
      if (overrides[modelKey]) return overrides[modelKey];
    }
    return overrides[paramKey];
  }, [appConfig.platforms]);

  const addCustomPlatform = useCallback((def: CustomPlatformDef) => {
    setAppConfig(prev => normalizeAppConfig({ ...prev, customPlatforms: [...(prev.customPlatforms ?? []), def] }, { current: prev }));
    setSaveSuccess(false);
  }, []);

  const updateCustomPlatform = useCallback((id: string, updates: Partial<CustomPlatformDef>) => {
    setAppConfig(prev => normalizeAppConfig({
      ...prev,
      customPlatforms: (prev.customPlatforms ?? []).map(cp => cp.id === id ? { ...cp, ...updates } : cp),
    }, { current: prev }));
    setSaveSuccess(false);
  }, []);

  const removeCustomPlatform = useCallback((id: string) => {
    setAppConfig(prev => normalizeAppConfig({
      ...prev,
      customPlatforms: (prev.customPlatforms ?? []).filter(cp => cp.id !== id),
      activePlatformId: prev.activePlatformId === id ? (PLATFORM_DEFS[0]?.id ?? prev.activePlatformId) : prev.activePlatformId,
    }, { current: prev }));
    setSaveSuccess(false);
  }, []);

  const addPlatformAccount = useCallback((platformId: string, label: string, apiKey: string) => {
    setAppConfig(prev => {
      const existing = prev.platforms.find(p => p.platformId === platformId);
      const accountId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const newAccount = { id: accountId, label, apiKey };
      const accounts = [...(existing?.accounts ?? []), newAccount];
      const updated = existing
        ? { ...existing, accounts }
        : { platformId, apiKey: '', accounts };
      const platforms = existing ? prev.platforms.map(p => p.platformId === platformId ? updated : p) : [...prev.platforms, updated];
      return normalizeAppConfig({ ...prev, platforms }, { current: prev });
    });
    setSaveSuccess(false);
  }, []);

  const removePlatformAccount = useCallback((platformId: string, accountId: string) => {
    setAppConfig(prev => {
      const existing = prev.platforms.find(p => p.platformId === platformId);
      if (!existing?.accounts) return prev;
      const accounts = existing.accounts.filter(a => a.id !== accountId);
      let activeAccountId = existing.activeAccountId;
      let apiKey = existing.apiKey;
      if (existing.activeAccountId === accountId) {
        const next = accounts[0];
        activeAccountId = next?.id;
        apiKey = next?.apiKey ?? apiKey;
      }
      const updated = { ...existing, accounts, activeAccountId, apiKey };
      const platforms = prev.platforms.map(p => p.platformId === platformId ? updated : p);
      return normalizeAppConfig({ ...prev, platforms }, { current: prev });
    });
    setSaveSuccess(false);
  }, []);

  const setActivePlatformAccount = useCallback((platformId: string, accountId: string) => {
    setAppConfig(prev => {
      const existing = prev.platforms.find(p => p.platformId === platformId);
      if (!existing?.accounts) return prev;
      const target = existing.accounts.find(a => a.id === accountId);
      if (!target) return prev;
      const updated = { ...existing, activeAccountId: accountId, apiKey: target.apiKey };
      const platforms = prev.platforms.map(p => p.platformId === platformId ? updated : p);
      return normalizeAppConfig({ ...prev, platforms }, { current: prev });
    });
    setSaveSuccess(false);
  }, []);

  const runtimePlatforms = useMemo(() => {
    const codePlatforms = PLATFORM_DEFS.flatMap(def => {
      const userConfig = appConfig.platforms.find(p => p.platformId === def.id);
      if (userConfig?.disabled) return [];
      const runtime = mergeToRuntime(def.id, userConfig);
      if (userConfig?.extraModels && userConfig.extraModels.length > 0) {
        const extraAsModelDef = userConfig.extraModels.map(m => ({
          id: m.id,
          platformId: def.id,
          name: m.name,
          label: m.label,
          modes: m.modes,
          apiFormat: m.apiFormat ?? def.models[0]?.apiFormat ?? 'unified',
          params: m.params ?? buildDefaultParams(m.modes),
        }));
        const disabledModelIds = new Set(userConfig.extraModels.filter(model => model.disabled).map(model => model.id));
        const extraById = new Map(extraAsModelDef.map(model => [model.id, model]));
        const mergedModels = runtime.models
          .map(model => extraById.get(model.id) ?? model)
          .filter(model => !disabledModelIds.has(model.id));
        const builtinIds = new Set(runtime.models.map(model => model.id));
        runtime.models = [
          ...mergedModels,
          ...extraAsModelDef.filter(model => !builtinIds.has(model.id) && !disabledModelIds.has(model.id)),
        ];
      }
      if (userConfig?.defaultModel) runtime.defaultModel = userConfig.defaultModel;
      if (!runtime.models.some(model => model.id === runtime.defaultModel)) {
        runtime.defaultModel = runtime.models[0]?.id ?? '';
      }
      return [runtime];
    });
    const customRuntimes: RuntimePlatform[] = (appConfig.customPlatforms ?? [])
      .filter(cp => !cp.disabled)
      .map(cp => {
        const models = (cp.models ?? [])
          .filter(m => !m.disabled)
          .map(m => ({
            id: m.id,
            platformId: cp.id,
            name: m.name,
            label: m.label,
            modes: m.modes,
            apiFormat: m.apiFormat ?? cp.apiFormat,
            params: m.params ?? buildDefaultParams(m.modes),
          }));
        return {
          id: cp.id,
          name: cp.name,
          baseUrl: cp.baseUrl,
          apiKey: cp.apiKey,
          endpoints: cp.endpoints,
          defaultModel: models.some(model => model.id === cp.defaultModel) ? (cp.defaultModel ?? '') : (models[0]?.id ?? ''),
          models,
          paramOverrides: {},
          imageUploadMode: cp.imageUploadMode ?? 'url',
          apiFormat: cp.apiFormat,
        };
      });
    return [...codePlatforms, ...customRuntimes];
  }, [appConfig.platforms, appConfig.customPlatforms]);

  const activePlatform = useMemo(() => runtimePlatforms.find(p => p.id === appConfig.activePlatformId) ?? runtimePlatforms[0], [runtimePlatforms, appConfig.activePlatformId]);

  // 开启 webSecurity 后，渲染进程跨源调用平台 API 依赖主进程按域注入 CORS 头；
  // 把已启用平台的 baseUrl 同步给主进程，自定义中转站域同样纳入注入列表。
  useEffect(() => {
    if (!window.electronAPI?.setCorsOrigins) return;
    const origins = runtimePlatforms.map(p => p.baseUrl).filter(Boolean);
    void window.electronAPI.setCorsOrigins(origins).catch(error => {
      logger.warn('ConfigContext', '同步 CORS 域失败', error);
    });
  }, [runtimePlatforms]);

  const setActivePlatformId = useCallback((id: string) => {
    updateAppConfig({ activePlatformId: id });
  }, [updateAppConfig]);

  const saveConfig = useCallback(async (): Promise<void> => {
    try {
      const normalized = normalizeAppConfig(appConfig, { current: DEFAULT_APP_CONFIG });
      // 落盘前加密敏感字段；setCookies 仍使用明文 uploadCk
      const encrypted = await encryptAppConfigForStorage(normalized);
      let storageError: unknown;
      const ok = writeJsonStorage(STORAGE_KEY, encrypted, error => { storageError = error; });
      if (!ok) throw storageError ?? new Error('localStorage 不可用');
      if (window.electronAPI) {
        if (normalized.uploadCk) {
          await window.electronAPI.setCookies(normalized.uploadCk);
        } else if (window.electronAPI.clearCookies) {
          // uploadCk 被清空时同步清理 Electron session 中的 GeekAI Cookie，保证登出语义完整
          await window.electronAPI.clearCookies().catch(error => {
            logger.warn('ConfigContext', '清理会话 Cookie 失败', error);
          });
        }
        await window.electronAPI.setHttpProxyConfig({
          useSystemProxy: normalized.useSystemProxy,
          httpProxy: normalized.httpProxy ?? '',
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      logger.error('ConfigContext', '保存配置失败', error);
      setSaveSuccess(false);
      throw error;
    }
  }, [appConfig]);

  const contextValue = useMemo<ConfigContextType>(() => ({
    appConfig,
    updateAppConfig,
    saveConfig,
    saveSuccess,
    activePlatform,
    setActivePlatformId,
    runtimePlatforms,
    getUserPlatformConfig,
    updateUserPlatformConfig,
    updateParamOverride,
    resetParamOverride,
    getParamOverride,
    addCustomPlatform,
    updateCustomPlatform,
    removeCustomPlatform,
    addPlatformAccount,
    removePlatformAccount,
    setActivePlatformAccount,
  }), [appConfig, updateAppConfig, saveConfig, saveSuccess, activePlatform, setActivePlatformId, runtimePlatforms, getUserPlatformConfig, updateUserPlatformConfig, updateParamOverride, resetParamOverride, getParamOverride, addCustomPlatform, updateCustomPlatform, removeCustomPlatform, addPlatformAccount, removePlatformAccount, setActivePlatformAccount]);

  return <ConfigContext.Provider value={contextValue}>{children}</ConfigContext.Provider>;
};
