import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Config, PlatformConfig } from '../types';
import { defaultPlatforms } from '../types';

const defaultConfig: Config = {
  downloadPath: '',
  autoDownload: false,
  platforms: defaultPlatforms,
  activePlatformId: 'geekai',
  uploadCk: '',
};

interface ConfigContextType {
  config: Config;
  setConfig: (config: Config) => void;
  updateConfig: (updates: Partial<Config>) => void;
  saveConfig: () => void;
  loadConfig: () => void;
  saveSuccess: boolean;
  activePlatform: PlatformConfig;
  updatePlatform: (platformId: string, updates: Partial<PlatformConfig>) => void;
  addPlatform: (platform: PlatformConfig) => void;
  removePlatform: (platformId: string) => void;
  setActivePlatform: (platformId: string) => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    try {
      const saved = localStorage.getItem('geekai_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig({ 
          ...defaultConfig, 
          ...parsed,
          platforms: parsed.platforms?.map((p: PlatformConfig) => ({
            ...p,
            endpoints: p.endpoints || {
              createVideo: '/v1/videos/generations',
              queryTask: '/v1/videos/{id}',
            },
            models: p.models?.map((m) => ({
              ...m,
              supportedApiFormats: m.supportedApiFormats || ['unified'],
            })) || [],
          })) || defaultPlatforms,
        });
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  const updateConfig = (updates: Partial<Config>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setSaveSuccess(false);
  };

  const updatePlatform = (platformId: string, updates: Partial<PlatformConfig>) => {
    setConfig(prev => ({
      ...prev,
      platforms: prev.platforms.map(p => 
        p.id === platformId ? { ...p, ...updates } : p
      ),
    }));
    setSaveSuccess(false);
  };

  const addPlatform = (platform: PlatformConfig) => {
    const newPlatform: PlatformConfig = {
      ...platform,
      endpoints: platform.endpoints || {
        createVideo: '/v1/videos/generations',
        queryTask: '/v1/videos/{id}',
      },
    };
    setConfig(prev => ({
      ...prev,
      platforms: [...prev.platforms, newPlatform],
    }));
    setSaveSuccess(false);
  };

  const removePlatform = (platformId: string) => {
    setConfig(prev => ({
      ...prev,
      platforms: prev.platforms.filter(p => p.id !== platformId),
      activePlatformId: prev.activePlatformId === platformId 
        ? prev.platforms.find(p => p.id !== platformId)?.id || prev.platforms[0]?.id || '' 
        : prev.activePlatformId,
    }));
    setSaveSuccess(false);
  };

  const setActivePlatform = (platformId: string) => {
    setConfig(prev => ({ ...prev, activePlatformId: platformId }));
    setSaveSuccess(false);
  };

  const saveConfig = async () => {
    try {
      localStorage.setItem('geekai_config', JSON.stringify(config));
      
      if (config.uploadCk) {
        if (window.electronAPI) {
          const result = await window.electronAPI.setCookies(config.uploadCk);
          console.log('Cookies set via Electron API:', result);
        } else {
          const cookieParts = config.uploadCk.split(';');
          cookieParts.forEach((part: string) => {
            const trimmed = part.trim();
            if (trimmed) {
              const [name, ...valueParts] = trimmed.split('=');
              const value = valueParts.join('=');
              if (name && value) {
                document.cookie = `${name}=${value}; domain=.geekai.co; path=/; secure`;
              }
            }
          });
          console.log('Cookies set via document.cookie');
        }
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('保存配置失败:', error);
    }
  };

  const activePlatform = useMemo(() => {
    return config.platforms.find(p => p.id === config.activePlatformId) || config.platforms[0];
  }, [config.platforms, config.activePlatformId]);

  return (
    <ConfigContext.Provider 
      value={{ 
        config, 
        setConfig, 
        updateConfig, 
        saveConfig, 
        loadConfig, 
        saveSuccess,
        activePlatform,
        updatePlatform,
        addPlatform,
        removePlatform,
        setActivePlatform,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};
