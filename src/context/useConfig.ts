import { useContext } from 'react';
import { ConfigContext } from './configContextValue';
import type { ConfigContextType } from './configContextValue';

export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within a ConfigProvider');
  return context;
};
