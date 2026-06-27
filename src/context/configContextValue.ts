import { createContext } from 'react';
import type { AppConfig, RuntimePlatform, UserPlatformConfig, UserParamOverride, CustomPlatformDef } from '../types';

export interface ConfigContextType {
  appConfig: AppConfig;
  updateAppConfig: (updates: Partial<AppConfig>) => void;
  saveConfig: () => void;
  saveSuccess: boolean;
  activePlatform: RuntimePlatform;
  setActivePlatformId: (id: string) => void;
  runtimePlatforms: RuntimePlatform[];
  getUserPlatformConfig: (platformId: string) => UserPlatformConfig;
  updateUserPlatformConfig: (platformId: string, updates: Partial<UserPlatformConfig>) => void;
  updateParamOverride: (platformId: string, paramKey: string, override: Partial<UserParamOverride>, modelId?: string) => void;
  resetParamOverride: (platformId: string, paramKey: string, modelId?: string) => void;
  getParamOverride: (platformId: string, paramKey: string, modelId?: string) => UserParamOverride | undefined;
  addCustomPlatform: (def: CustomPlatformDef) => void;
  updateCustomPlatform: (id: string, updates: Partial<CustomPlatformDef>) => void;
  removeCustomPlatform: (id: string) => void;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(undefined);
