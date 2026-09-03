import React, { useMemo, useState } from 'react';
import { WifiOff, RefreshCw, Trash2, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import { getApiSafeMessage } from '../../services/api/errorNormalizer';
import type { OfflineQueueItem } from '../../context/offlineQueueUtils';

interface OfflineQueueBannerProps {
  queue: OfflineQueueItem[];
  isOnline: boolean;
  isProcessing: boolean;
  onRetry: (id: string) => Promise<void>;
  onRemove: (id: string) => void;
  onReorder?: (id: string, direction: 'up' | 'down') => void;
}

/** 离线队列横幅：展示因网络异常暂存待提交的任务，支持手动重试/移除/重排 */
const OfflineQueueBanner: React.FC<OfflineQueueBannerProps> = ({ queue, isOnline, isProcessing, onRetry, onRemove, onReorder }) => {
  const [actionError, setActionError] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  const errorGroups = useMemo(() => {
    const buckets = new Map<string, { count: number; sample: string }>();
    queue.forEach(item => {
      const message = getApiSafeMessage(item.lastError, '未知错误').trim();
      if (!message) return;
      const key = message.length > 40 ? `${message.slice(0, 40)}…` : message;
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        buckets.set(key, { count: 1, sample: message });
      }
    });
    return Array.from(buckets.entries())
      .map(([key, info]) => ({ key, ...info }))
      .sort((a, b) => b.count - a.count);
  }, [queue]);

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
        {errorGroups.length > 0 && (
          <button
            type="button"
            onClick={() => setShowErrors(v => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
            title={showErrors ? '收起错误归类' : '展开错误归类'}
          >
            <AlertCircle className="h-3 w-3" />
            错误归类 {errorGroups.length} 类
          </button>
        )}
        {actionError && <span className="text-red-600 text-xs">{actionError}</span>}
      </div>

      {showErrors && errorGroups.length > 0 && (
        <div className="mt-2 grid gap-1.5 rounded-md border border-amber-100 bg-amber-50/50 p-2 text-[11px]">
          {errorGroups.map(group => (
            <div key={group.key} className="flex items-center justify-between gap-2">
              <span className="truncate text-amber-900" title={group.sample}>{group.sample}</span>
              <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-amber-700">{group.count} 条</span>
            </div>
          ))}
        </div>
      )}

      <div className="offline-queue-banner__list">
        {queue.map((item, index) => (
          <div key={item.id} className="offline-queue-banner__item">
            <span className="offline-queue-banner__item-text" title={item.prompt}>
              [{item.model}] {item.prompt || '（无 Prompt）'}
            </span>
            {item.retryCount > 0 && (
              <span className="text-[11px] text-amber-600 shrink-0">已重试 {item.retryCount} 次</span>
            )}
            {item.lastError && (
              <span
                className="hidden max-w-[180px] truncate text-[11px] text-red-500 sm:inline"
                title={getApiSafeMessage(item.lastError, '未知错误')}
              >
                {getApiSafeMessage(item.lastError, '未知错误')}
              </span>
            )}
            {onReorder && (
              <>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => onReorder(item.id, 'up')}
                  title="上移到队首（更快提交）"
                  aria-label={`将 ${item.model} 的离线项上移`}
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                  disabled={index === queue.length - 1}
                  onClick={() => onReorder(item.id, 'down')}
                  title="下移到队尾"
                  aria-label={`将 ${item.model} 的离线项下移`}
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </>
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
