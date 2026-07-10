import { createContext } from 'react';
import type { OfflineQueueItem } from './offlineQueueUtils';

export interface OfflineQueueContextType {
  queue: OfflineQueueItem[];
  isOnline: boolean;
  isProcessing: boolean;
  enqueueOfflineTask: (item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retryCount' | 'lastError' | 'lastAttemptAt'>) => OfflineQueueItem;
  removeOfflineTask: (id: string) => void;
  clearOfflineQueue: () => void;
  retryOfflineTask: (id: string) => Promise<void>;
  processOfflineQueue: () => Promise<void>;
}

export const OfflineQueueContext = createContext<OfflineQueueContextType | undefined>(undefined);
