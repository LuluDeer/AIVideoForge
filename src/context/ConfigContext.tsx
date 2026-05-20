import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Config } from '../types';

const defaultConfig: Config = {
  apiKey: '',
  ck: '',
  defaultModel: 'veo-3.1-fast-generate-preview',
  aspectRatio: '16:9',
  resolution: '720p',
  duration: 4,
  downloadPath: '',
  autoDownload: false,
};

interface ConfigContextType {
  config: Config;
  setConfig: (config: Config) => void;
  updateConfig: (updates: Partial<Config>) => void;
  saveConfig: () => void;
  loadConfig: () => void;
  saveSuccess: boolean;
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
        setConfig({ ...defaultConfig, ...parsed });
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  const updateConfig = (updates: Partial<Config>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setSaveSuccess(false);
  };

  const saveConfig = async () => {
    try {
      localStorage.setItem('geekai_config', JSON.stringify(config));
      
      if (config.ck) {
        if ((window as any).electronAPI) {
          const result = await (window as any).electronAPI.setCookies(config.ck);
          console.log('Cookies set via Electron API:', result);
        } else {
          const cookieParts = config.ck.split(';');
          cookieParts.forEach(part => {
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

  return (
    <ConfigContext.Provider value={{ config, setConfig, updateConfig, saveConfig, loadConfig, saveSuccess }}>
      {children}
    </ConfigContext.Provider>
  );
};
