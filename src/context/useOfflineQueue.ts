import { useContext } from 'react';
import { OfflineQueueContext } from './offlineQueueContextValue';
import type { OfflineQueueContextType } from './offlineQueueContextValue';

export const useOfflineQueue = (): OfflineQueueContextType => {
  const context = useContext(OfflineQueueContext);
  if (!context) throw new Error('useOfflineQueue must be used within an OfflineQueueProvider');
  return context;
};
