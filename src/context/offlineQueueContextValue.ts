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
  /** 将指定 id 的离线项在队列中上移（direction: 'up'）或下移（direction: 'down'） */
  reorderOfflineTask: (id: string, direction: 'up' | 'down') => void;
}

export const OfflineQueueContext = createContext<OfflineQueueContextType | undefined>(undefined);
