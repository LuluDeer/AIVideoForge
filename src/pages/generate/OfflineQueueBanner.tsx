import React, { useState } from 'react';
import { WifiOff, RefreshCw, Trash2 } from 'lucide-react';
import { getApiSafeMessage } from '../../services/api/errorNormalizer';
import type { OfflineQueueItem } from '../../context/offlineQueueUtils';

interface OfflineQueueBannerProps {
  queue: OfflineQueueItem[];
  isOnline: boolean;
  isProcessing: boolean;
  onRetry: (id: string) => Promise<void>;
  onRemove: (id: string) => void;
}

/** 离线队列横幅：展示因网络异常暂存待提交的任务，支持手动重试/移除 */
const OfflineQueueBanner: React.FC<OfflineQueueBannerProps> = ({ queue, isOnline, isProcessing, onRetry, onRemove }) => {
  const [actionError, setActionError] = useState('');
  if (queue.length === 0) return null;

  return (
    <div className="offline-queue-banner">
      <div className="offline-queue-banner__header">
        <WifiOff className="w-4 h-4 shrink-0 text-slate-500" />
        <span className="flex-1">
          {isOnline
            ? `网络已恢复，正在自动提交离线队列中的 ${queue.length} 个任务${isProcessing ? '…' : ''}`
            : `网络异常，${queue.length} 个任务已暂存离线队列，网络恢复后将自动提交`}
        </span>
        {actionError && <span className="text-red-600 text-xs">{actionError}</span>}
      </div>
      <div className="offline-queue-banner__list">
        {queue.map(item => (
          <div key={item.id} className="offline-queue-banner__item">
            <span className="offline-queue-banner__item-text" title={item.prompt}>
              [{item.model}] {item.prompt || '（无 Prompt）'}
            </span>
            {item.retryCount > 0 && (
              <span className="text-[11px] text-amber-600 shrink-0">已重试 {item.retryCount} 次</span>
            )}
            <button
              type="button"
              className="shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-blue-600 hover:bg-blue-50"
              disabled={isProcessing}
              onClick={async () => {
                setActionError('');
                try {
                  await onRetry(item.id);
                } catch (err) {
                  setActionError(getApiSafeMessage(err, '重试提交失败'));
                }
              }}
              title="立即重试提交"
            >
              <RefreshCw className="w-3 h-3" />重试
            </button>
            <button
              type="button"
              className="shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-red-500 hover:bg-red-50"
              onClick={() => onRemove(item.id)}
              title="从离线队列移除，不再自动提交"
            >
              <Trash2 className="w-3 h-3" />移除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OfflineQueueBanner;
