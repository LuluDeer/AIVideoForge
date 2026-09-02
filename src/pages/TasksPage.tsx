import React, { useState, useMemo } from 'react';
import {
  Download, Trash2, ExternalLink, Loader2, Video, CheckCircle2, Clock,
  Copy, Check, RefreshCw, XCircle, CloudDownload, Film, Search, ArrowUpDown,
  X, CheckSquare, Square, RotateCcw, FolderOpen
} from 'lucide-react';
import { useTasks } from '../context/useTasks';
import { useConfig } from '../context/useConfig';
import AppSelect from '../components/AppSelect';
import AssetAwareImage from '../components/AssetAwareImage';
import DateRangePicker from '../components/DateRangePicker';
import { canCancelTask, canDeleteTask, canRetryTask, createTaskStats, getActionableErrorAdvice, formatErrorWithAdvice, getAutoDownloadBadge, getModelStats, getTaskStatusColor, getTaskStatusText, isTaskActive, isTaskRunning, matchesTaskStatusFilter } from '../context/taskUtils';
import { getApiSafeMessage } from '../services/api/errorNormalizer';
import { logger } from '../utils/logger';
import type { Task } from '../types';
import { formatTaskDate, getModeText, getModelColor, getTaskEmptyState, getTaskVideoResultHint } from './tasks/taskPresentation';
import { ModeIcon } from './tasks/modeIcon';

type StatusFilter = 'all' | 'running' | 'succeed' | 'failed' | 'cancelled';
type SortField = 'created_at' | 'status';
type SortOrder = 'asc' | 'desc';

const TasksPage: React.FC = () => {
  const { tasks, removeTask, clearTasks, updateTask, refreshTask, cancelTask, fetchRemoteTasks, retryTask, requestReuseTask, storageWarning } = useTasks();
  const { runtimePlatforms, activePlatform } = useConfig();

  const getPlatformName = (platformId: string): string =>
    runtimePlatforms.find(p => p.id === platformId)?.name ?? platformId;

  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  // 新增：搜索、排序、批量选择、详情弹窗
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [contextMenu, setContextMenu] = useState<{ task: Task; x: number; y: number } | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  // 详情弹窗按 id 从最新 tasks 派生，保证轮询更新后弹窗内容同步刷新，删除任务后弹窗自动关闭
  const detailTask = useMemo(() => tasks.find(t => t.id === detailTaskId) ?? null, [tasks, detailTaskId]);
  const [batchRetrying, setBatchRetrying] = useState(false);
  const [batchRetryMsg, setBatchRetryMsg] = useState<string | null>(null);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [openingPathIds, setOpeningPathIds] = useState<Set<string>>(new Set());
  const [openPathMessage, setOpenPathMessage] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');

  React.useEffect(() => {
    const focus = () => searchInputRef.current?.focus();
    const refresh = () => { void handleSyncRemote(); };
    window.addEventListener('aivideoforge:focus-task-search', focus);
    window.addEventListener('aivideoforge:refresh-tasks', refresh);
    return () => { window.removeEventListener('aivideoforge:focus-task-search', focus); window.removeEventListener('aivideoforge:refresh-tasks', refresh); };
  }, []);

  const getTaskPlatform = (task: Task) => task.platformId
    ? (runtimePlatforms.find(p => p.id === task.platformId) ?? activePlatform)
    : activePlatform;

  const formatTaskError = (message: unknown, fallback = '任务失败', fallbackAdvice?: string) =>
    formatErrorWithAdvice(getApiSafeMessage(message, fallback), fallbackAdvice);

  const canCancelRemotely = (task: Task) => !!getTaskPlatform(task)?.apiKey && !!getTaskPlatform(task)?.endpoints.deleteTask;

  const getCancelConfirmText = (task: Task) => {
    if (canCancelRemotely(task)) {
      return '确认取消此任务并请求云端取消？如云端取消失败，将仅本地停止跟踪。';
    }
    return '确认停止跟踪此任务？平台未提供云端取消接口，仅本地停止跟踪，云端可能继续生成。';
  };

  const visibleFailedTasks = useMemo(() => {
    const failed = tasks.filter(t => canRetryTask(t));
    if (selectedIds.size > 0) return failed.filter(t => selectedIds.has(t.id));
    return failed;
  }, [tasks, selectedIds]);

  const handleBatchRetry = async () => {
    setBatchRetrying(true);
    setBatchRetryMsg(null);
    try {
      let success = 0;
      let failed = 0;
      const failureSummaries: string[] = [];
      for (const t of visibleFailedTasks) {
        try {
          await retryTask(t.id);
          success++;
        } catch (e) {
          failed++;
          const message = getApiSafeMessage(e, '未知错误');
          const advice = getActionableErrorAdvice(message);
          failureSummaries.push(advice ? `${message}（${advice}）` : message);
          setBatchRetryMsg(`正在重试 ${success + failed}/${visibleFailedTasks.length} 个任务，失败 ${failed} 个`);
          logger.warn('TasksPage', '批量重试单个任务失败', e);
        }
      }
      const summary = failureSummaries.slice(-2).join('；');
      setBatchRetryMsg(failed > 0
        ? `成功重试 ${success}/${visibleFailedTasks.length} 个任务，失败 ${failed} 个${summary ? `：${summary}` : ''}`
        : `成功重试 ${success}/${visibleFailedTasks.length} 个任务`);
      setSelectedIds(new Set());
    } finally { setBatchRetrying(false); }
  };

  const handleRefreshTask = async (taskId: string) => {
    setRefreshingIds(prev => new Set(prev).add(taskId));
    try {
      await refreshTask(taskId);
    } finally {
      setRefreshingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
    }
  };

  const handleCancelTask = async (task: Task) => {
    if (!window.confirm(getCancelConfirmText(task))) return;
    setCancellingIds(prev => new Set(prev).add(task.id));
    try {
      await cancelTask(task.id);
    } catch (e) {
      logger.warn('TasksPage', '取消任务失败', e);
    } finally {
      setCancellingIds(prev => { const s = new Set(prev); s.delete(task.id); return s; });
    }
  };

  const handleRetryTask = async (taskId: string) => {
    setRetryingIds(prev => new Set(prev).add(taskId));
    setRetryMessage(null);
    try {
      await retryTask(taskId);
      setRetryMessage('重试已提交');
    } catch (e) {
      const message = getApiSafeMessage(e, '未知错误');
      setRetryMessage(`重试失败：${formatErrorWithAdvice(message, '手动刷新任务')}`);
      logger.warn('TasksPage', '重试任务失败', e);
    } finally {
      setRetryingIds(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      setTimeout(() => setRetryMessage(null), 4000);
    }
  };

  const handleSyncRemote = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      await fetchRemoteTasks();
      setSyncMessage('同步成功');
    } catch (e) {
      const message = getApiSafeMessage(e, '未知错误');
      setSyncMessage(`同步失败：${formatErrorWithAdvice(message, '手动刷新任务')}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 3000);
    }
  };

  // 过滤逻辑：状态 -> 模型 -> 搜索词
  const filteredTasks = useMemo(() => {
    let result = tasks.filter(task => matchesTaskStatusFilter(task.status, filter));

    if (selectedModels.length > 0) {
      result = result.filter(task => selectedModels.includes(task.model || '未知模型'));
    }

    if (dateFrom) result = result.filter(task => task.created_at >= new Date(`${dateFrom}T00:00:00`).getTime());
    if (dateTo) result = result.filter(task => task.created_at <= new Date(`${dateTo}T23:59:59.999`).getTime());
    if (platformFilter !== 'all') result = result.filter(task => (task.platformId || '') === platformFilter);
    if (modeFilter !== 'all') result = result.filter(task => task.mode === modeFilter);
    if (tagFilter !== 'all') result = result.filter(task => (task.tags || []).includes(tagFilter));

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(task =>
        task.prompt?.toLowerCase().includes(q) ||
        task.id.toLowerCase().includes(q) ||
        task.model?.toLowerCase().includes(q)
      );
    }

    // 排序
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'created_at') {
        cmp = a.created_at - b.created_at;
      } else if (sortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [tasks, filter, selectedModels, searchQuery, dateFrom, dateTo, platformFilter, modeFilter, tagFilter, sortField, sortOrder]);

  // 模型统计（基于当前状态过滤后的任务）
  const modelStats = useMemo(() => getModelStats(tasks, filter), [tasks, filter]);

  // 增量渲染：任务卡片较重（缩略图/进度/操作按钮），全量渲染在数百条时明显掉帧。
  // 默认渲染前 50 条，筛选条件变化时重置。
  const TASK_PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(TASK_PAGE_SIZE);
  React.useEffect(() => {
    setVisibleCount(TASK_PAGE_SIZE);
  }, [filter, selectedModels, searchQuery, dateFrom, dateTo, platformFilter, modeFilter, tagFilter, sortField, sortOrder]);
  const renderedTasks = useMemo(() => filteredTasks.slice(0, visibleCount), [filteredTasks, visibleCount]);

  const toggleModel = (model: string) => {
    setSelectedModels(prev =>
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    );
  };

  const handleDownload = (url: string | undefined) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = url.split('/').pop() || 'video.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // 不标记 downloaded：跨源 URL 的 download 属性可能被忽略，实际保存结果无法在此确认，
    // 避免误标导致自动下载/补充下载永久跳过该任务
  };

  const handleOpenDownloadTarget = async (task: Task) => {
    const targetPath = task.download_file_path || task.download_path;
    if (!targetPath) return;
    if (!window.electronAPI) {
      setOpenPathMessage('当前环境不支持打开本地文件夹，请在桌面客户端中使用。');
      return;
    }
    setOpeningPathIds(prev => new Set(prev).add(task.id));
    setOpenPathMessage(null);
    try {
      const result = await window.electronAPI.openPath(targetPath);
      if (!result.success) setOpenPathMessage(result.error || '打开目标文件夹失败');
    } finally {
      setOpeningPathIds(prev => { const s = new Set(prev); s.delete(task.id); return s; });
      setTimeout(() => setOpenPathMessage(null), 3000);
    }
  };

  const writeClipboard = async (text: string) => {
    if (!navigator.clipboard) {
      throw new Error('当前环境不支持剪贴板写入');
    }
    await navigator.clipboard.writeText(text);
  };

  const showCopyError = (message: string) => {
    setCopyError(message);
    setTimeout(() => setCopyError(null), 3000);
  };

  const handleCopyId = async (id: string) => {
    try {
      await writeClipboard(id);
      setCopyError(null);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      logger.warn('TasksPage', '复制任务 ID 失败', error);
      showCopyError('复制失败，请手动选择任务 ID');
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await writeClipboard(url);
      setCopyError(null);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      logger.warn('TasksPage', '复制视频链接失败', error);
      showCopyError('复制失败，请手动复制视频链接');
    }
  };

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'running', label: '生成中' },
    { value: 'succeed', label: '已完成' },
    { value: 'failed', label: '失败' },
    { value: 'cancelled', label: '已取消' },
  ];

  const stats = createTaskStats(tasks);
  const emptyState = getTaskEmptyState(tasks.length, filteredTasks.length);

  const pausedPollingTasks = tasks.filter(t => isTaskActive(t.status) && t.poll_paused);

  // 批量操作
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确认删除选中的 ${selectedIds.size} 个任务？`)) return;
    selectedIds.forEach(id => removeTask(id));
    setSelectedIds(new Set());
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const commitTaskTags = (task: Task, tags: string[]) => {
    updateTask(task.id, { tags: tags.length ? tags : undefined });
  };

  const addTaskTag = (task: Task) => {
    const value = tagDraft.trim();
    if (!value) return;
    const current = task.tags ?? [];
    if (!current.includes(value)) commitTaskTags(task, [...current, value]);
    setTagDraft('');
  };

  return (
    <div className="tasks-page page-shell">
      <div>
        {/* 顶栏 */}
        <div className="page-hero">
          <div>
            <h2>任务管理</h2>
            <p>查看生成队列、筛选模型与状态、预览结果视频，并对失败任务执行批量重试或参数复用。</p>
          </div>
          <div className="hero-actions flex items-center gap-2">
            {activePlatform?.endpoints.queryTaskList && (
              <button
                onClick={handleSyncRemote}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                title="从当前平台同步云端任务列表"
              >
                <CloudDownload className={`w-4 h-4 ${syncing ? 'animate-bounce' : ''}`} />
                {syncing ? '同步中...' : '同步云端任务'}
              </button>
            )}
            {syncMessage && (
              <span className={`text-xs px-2 py-1 rounded ${syncMessage.includes('失败') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {syncMessage}
              </span>
            )}
            {tasks.length > 0 && (
              <button
                onClick={() => { if (confirm(`确认清空全部 ${tasks.length} 个任务？此操作不可恢复`)) clearTasks(); }}
                className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                title="清空本地任务历史，不会取消云端任务"
              >
                <Trash2 className="w-4 h-4" />
                清空全部
              </button>
            )}
          </div>
        </div>

        {pausedPollingTasks.length > 0 && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            <Clock className="w-4 h-4 shrink-0" />
            <span>有 {pausedPollingTasks.length} 个任务自动轮询已暂停，云端状态未知，请手动刷新或同步云端。</span>
          </div>
        )}

        {storageWarning && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{storageWarning}</span>
          </div>
        )}

        {/* 状态统计 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {statusFilters.map(s => (
            <button
              key={s.value}
              type="button"
              className={`task-status-filter min-h-[88px] rounded-xl border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                filter === s.value
                  ? 'task-status-filter--active border-blue-500 bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200/70 ring-2 ring-blue-100'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50/60'
              }`}
              onClick={() => setFilter(s.value)}
            >
              <div className={`text-2xl font-bold leading-normal ${filter === s.value ? 'text-white' : 'text-gray-800'}`}>{stats[s.value]}</div>
              <div className={`text-sm leading-normal ${filter === s.value ? 'text-blue-50' : 'text-gray-500'}`}>{s.label}</div>
            </button>
          ))}
        </div>

        {/* 搜索栏 + 筛选条件 */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索 Prompt、任务 ID 或模型名称..."
              className="task-control w-full pl-9 pr-3 h-10 text-sm rounded-lg"
            />
          </div>

          {/* 日期范围选择 */}
          <DateRangePicker
            value={{ from: dateFrom, to: dateTo }}
            onChange={(v) => { setDateFrom(v.from); setDateTo(v.to); }}
          />

          <AppSelect
            value={platformFilter}
            onChange={e => setPlatformFilter(e.target.value)}
            className="min-w-[120px]"
            options={[{ value: 'all', label: '全部平台' }, ...runtimePlatforms.map(p => ({ value: p.id, label: p.name }))]} />
          <AppSelect
            value={modeFilter}
            onChange={e => setModeFilter(e.target.value)}
            className="min-w-[120px]"
            options={[{ value: 'all', label: '全部模式' }, ...(['text', 'image', 'imageTail', 'multiImage', 'multiModal'] as Task['mode'][]).map(mode => ({ value: mode, label: getModeText(mode) }))]} />
          <AppSelect
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="min-w-[120px]"
            options={[{ value: 'all', label: '全部标签' }, ...Array.from(new Set(tasks.flatMap(task => task.tags ?? []))).sort().map(tag => ({ value: tag, label: tag }))]} />

          <button
            onClick={() => toggleSort('created_at')}
            className="task-control flex items-center gap-1 px-3 h-10 text-sm rounded-lg whitespace-nowrap"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            时间
            {sortField === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          <button
            onClick={() => toggleSort('status')}
            className="task-control flex items-center gap-1 px-3 h-10 text-sm rounded-lg whitespace-nowrap"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            状态
            {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-1 px-3 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600"
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除选中 ({selectedIds.size})
            </button>
          )}
          {visibleFailedTasks.length > 0 && (
            <button
              onClick={handleBatchRetry}
              disabled={batchRetrying}
              className="flex items-center gap-1 px-3 py-2 text-sm text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {batchRetrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              重试失败 ({visibleFailedTasks.length})
            </button>
          )}
          {batchRetryMsg && (
            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">{batchRetryMsg}</span>
          )}
          {retryMessage && (
            <span className={`text-xs px-2 py-1 rounded ${retryMessage.includes('失败') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{retryMessage}</span>
          )}
          {copyError && (
            <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">{copyError}</span>
          )}
          {openPathMessage && (
            <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700">{openPathMessage}</span>
          )}
        </div>

        {/* 模型筛选 */}
        {Object.keys(modelStats).length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-600">模型筛选:</span>
              {Object.entries(modelStats).map(([model, count]) => (
                <button
                  key={model}
                  onClick={() => toggleModel(model)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedModels.includes(model)
                      ? `${getModelColor(model, modelStats)} text-white`
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {model} ({count})
                </button>
              ))}
              {selectedModels.length > 0 && (
                <button
                  onClick={() => setSelectedModels([])}
                  className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  清除筛选
                </button>
              )}
            </div>
          </div>
        )}

        {/* 任务列表 */}
        {filteredTasks.length === 0 ? (
          <div className="task-empty-card bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-gray-400">
              <ExternalLink className="w-16 h-16 mx-auto mb-4" />
              <p className="text-lg">{emptyState.title}</p>
              <p className="text-sm">{emptyState.description}</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {/* 全选 */}
            <div className="flex items-center gap-2 px-2">
              <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700" title="选择或取消选择当前列表中的全部任务">
                {selectedIds.size === filteredTasks.length && filteredTasks.length > 0
                  ? <CheckSquare className="w-4 h-4 text-blue-500" />
                  : <Square className="w-4 h-4" />
                }
                全选
              </button>
            </div>
            {renderedTasks.map(task => (
              <div
                key={task.id}
                onContextMenu={e => {
                  e.preventDefault();
                  setContextMenu({ task, x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 160) });
                }}
                className={`task-card bg-white rounded-xl shadow-sm p-3 hover:shadow-md transition-shadow border ${
                  selectedIds.has(task.id) ? 'border-blue-400 bg-blue-50/30' : 'border-transparent'
                }`}
              >
                <div className="mb-3">
                  {/* 第一行：勾选 + 状态徽章 + 平台 | 操作按钮 + 日期 */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleSelect(task.id)} className="text-gray-400 hover:text-blue-500" title="选择此任务" aria-label={`选择任务 ${task.id}`}>
                        {selectedIds.has(task.id) ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                      </button>
                      <span className={`task-status-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getTaskStatusColor(task.status)}`}>
                        {isTaskRunning(task.status) && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                        {getTaskStatusText(task.status)}
                      </span>
                      {task.platformId && (
                        <span className="task-platform-badge inline-flex min-h-6 items-center rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-xs leading-normal text-indigo-600 break-all">
                          {getPlatformName(task.platformId)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {task.auto_download && (() => {
                        const badge = getAutoDownloadBadge(task);
                        const icon = task.download_status === 'downloading'
                          ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          : task.download_status === 'failed' || task.download_error
                            ? <XCircle className="w-3 h-3 mr-1" />
                            : task.downloaded
                              ? <CheckCircle2 className="w-3 h-3 mr-1" />
                              : <Clock className="w-3 h-3 mr-1" />;
                        return (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`task-download-badge inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.className}`} title={task.download_error || task.download_path || undefined}>
                              {icon}
                              {badge.text}
                              {task.download_status === 'downloading' && typeof task.download_progress === 'number' && (
                                <span className="ml-1 tabular-nums">{task.download_progress}%</span>
                              )}
                            </span>
                            {task.download_status === 'downloading' && typeof task.download_progress === 'number' && (
                              <span className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden" role="progressbar" aria-valuenow={task.download_progress} aria-valuemin={0} aria-valuemax={100} aria-label={`任务 ${task.id} 下载进度`}>
                                <span className="block h-full bg-blue-500 transition-all duration-300" style={{ width: `${task.download_progress}%` }} />
                              </span>
                            )}
                          </span>
                        );
                      })()}
                      {canCancelTask(task) && (
                        <button onClick={() => handleRefreshTask(task.id)} disabled={refreshingIds.has(task.id)}
                          className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors disabled:opacity-50" title="手动刷新任务状态" aria-label={`刷新任务 ${task.id} 状态`}>
                          <RefreshCw className={`w-3.5 h-3.5 ${refreshingIds.has(task.id) ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      {canCancelTask(task) && (
                        <button onClick={() => handleCancelTask(task)} disabled={cancellingIds.has(task.id)}
                          className="p-1 text-gray-400 hover:text-orange-500 rounded transition-colors disabled:opacity-50" title={canCancelRemotely(task) ? '取消任务（请求云端取消）' : '停止跟踪任务（仅本地）'} aria-label={canCancelRemotely(task) ? `请求云端取消任务 ${task.id}` : `本地停止跟踪任务 ${task.id}`}>
                          {cancellingIds.has(task.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {canRetryTask(task) && (
                        <button onClick={() => handleRetryTask(task.id)} disabled={retryingIds.has(task.id)}
                          className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors disabled:opacity-50" title="重试任务" aria-label={`重试任务 ${task.id}`}>
                          {retryingIds.has(task.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <span className="text-xs text-gray-400">{formatTaskDate(task.created_at)}</span>
                    </div>
                  </div>
                  {/* 第二行：任务ID + 模式 + 模型 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => handleCopyId(task.id)}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs font-mono text-gray-500 bg-gray-50 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      title="点击复制任务ID" aria-label={`复制任务 ID ${task.id}`}>
                      {copiedId === task.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      <span className="max-w-[200px] truncate">{task.id}</span>
                    </button>
                    <span className="text-gray-300">|</span>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <span><ModeIcon mode={task.mode} /></span>
                      <span>{getModeText(task.mode)}</span>
                    </div>
                    <span className="text-gray-300">|</span>
                    <div className="task-model-summary flex min-w-0 items-start gap-1 rounded-md border px-2 py-1 text-xs text-gray-500">
                      <span className="shrink-0 text-gray-400">模型:</span>
                      <span className="task-model-id break-all text-gray-700 font-medium">{task.model}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setDetailTaskId(task.id)}
                    title="点击查看详情"
                  >
                    <p className="task-prompt-summary rounded-lg border px-3 py-2 text-sm text-gray-800 leading-relaxed line-clamp-2">{task.prompt || '(无 Prompt)'}</p>
                    {task.enhanced_prompt && (
                      <p className="mt-1 text-xs text-gray-400 line-clamp-1">
                        增强提示词: {task.enhanced_prompt}
                      </p>
                    )}
                    {task.last_poll_error && (
                      <p className="task-warning-message mt-1 rounded-md border px-2 py-1 text-xs text-amber-600 line-clamp-1">{formatTaskError(task.last_poll_error, '自动轮询已暂停', '手动刷新或同步云端')}</p>
                    )}
                    {task.error_message && (
                      <p className="mt-1 text-xs text-red-500 line-clamp-1">{formatTaskError(task.error_message)}</p>
                    )}
                    {task.auto_download && task.download_error && (
                      <p className="mt-1 text-xs text-red-500 line-clamp-1">自动下载失败：{formatTaskError(task.download_error, '自动下载失败')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* 参考图缩略图 */}
                    {(task.image_url || task.image_tail_url || (task.image_urls && task.image_urls.length > 0)) && (
                      <div className="flex gap-1 mr-1">
                        {task.image_url && !task.image_tail_url &&(
                          <AssetAwareImage url={task.image_url} platform={getTaskPlatform(task)} className="w-14 h-10 object-cover rounded border" alt="首帧" title="首帧图" />
                        )}
                        {task.image_tail_url && (
                          <>
                            {task.image_url && <AssetAwareImage url={task.image_url} platform={getTaskPlatform(task)} className="w-14 h-10 object-cover rounded border" alt="首帧" title="首帧图" />}
                            <AssetAwareImage url={task.image_tail_url} platform={getTaskPlatform(task)} className="w-14 h-10 object-cover rounded border opacity-80" alt="尾帧" title="尾帧图" />
                          </>
                        )}
                        {task.image_urls?.slice(0, 3).map((url, i) => (
                          <AssetAwareImage key={i} url={url} platform={getTaskPlatform(task)} className="w-10 h-10 object-cover rounded border" alt={`参考图${i + 1}`} />
                        ))}
                      </div>
                    )}
                    {task.video_url && (
                      <>
                        <button
                          onClick={() => setDetailTaskId(task.id)}
                          className="task-media-action task-media-action--play flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors"
                          title="在详情弹窗中加载并播放视频，避免列表批量加载视频资源"
                        >
                          <Video className="w-3.5 h-3.5" />查看/播放视频
                        </button>
                        <button
                          onClick={() => task.video_url && handleCopyUrl(task.video_url)}
                          className="task-media-action task-media-action--copy p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="复制视频链接"
                        >
                          {copiedUrl === task.video_url ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDownload(task.video_url)}
                          className="task-media-action task-media-action--download p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="下载视频"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {(task.download_file_path || task.download_path) && (
                          <button
                            onClick={() => handleOpenDownloadTarget(task)}
                            disabled={openingPathIds.has(task.id)}
                            className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-50"
                            title={task.download_file_path ? '在文件夹中显示已下载视频' : '打开自动下载目标文件夹'}
                          >
                            {openingPathIds.has(task.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                          </button>
                        )}
                        {task.saved_params && (
                          <button
                            onClick={() => requestReuseTask(task.id)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="复用参数生成变体"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                    {task.last_frame_url && (
                      <a
                        href={task.last_frame_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="下载尾帧图"
                      >
                        <Film className="w-4 h-4" />
                      </a>
                    )}
                    {canDeleteTask(task) && (
                      <button
                        onClick={() => removeTask(task.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除任务"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {visibleCount < filteredTasks.length && (
              <button
                onClick={() => setVisibleCount(prev => prev + TASK_PAGE_SIZE)}
                className="task-control w-full py-2.5 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                加载更多（已显示 {renderedTasks.length} / {filteredTasks.length}）
              </button>
            )}
          </div>
        )}
      </div>

      {contextMenu && <div className="context-menu fixed z-[80] min-w-44 rounded-lg border bg-white p-1 shadow-xl" style={{ left: contextMenu.x, top: contextMenu.y }} onMouseLeave={() => setContextMenu(null)}>
        {canRetryTask(contextMenu.task) && <button className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-blue-50" onClick={() => { void handleRetryTask(contextMenu.task.id); setContextMenu(null); }}>重试任务</button>}
        {contextMenu.task.saved_params && <button className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-blue-50" onClick={() => { requestReuseTask(contextMenu.task.id); setContextMenu(null); }}>复用参数</button>}
        {contextMenu.task.video_url && <button className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-blue-50" onClick={() => { handleDownload(contextMenu.task.video_url); setContextMenu(null); }}>下载视频</button>}
        {canDeleteTask(contextMenu.task) && <button className="block w-full rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => { removeTask(contextMenu.task.id); setContextMenu(null); }}>删除任务</button>}
      </div>}

      {/* 任务详情弹窗 */}
      {detailTask && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setDetailTaskId(null)}
        >
          <div
            className="task-detail-dialog bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">任务详情</h3>
              <button
                onClick={() => setDetailTaskId(null)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="task-detail-content p-4 space-y-4">
              {/* 基本信息 */}
              <div className="task-detail-meta grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">任务 ID:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="task-detail-value font-mono text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded">{detailTask.id}</span>
                    <button onClick={() => handleCopyId(detailTask.id)} className="text-gray-400 hover:text-blue-500">
                      {copiedId === detailTask.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">状态:</span>
                  <div className="mt-1">
                    <span className={`task-status-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getTaskStatusColor(detailTask.status)}`}>
                      {isTaskRunning(detailTask.status) && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      {getTaskStatusText(detailTask.status)}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">模型:</span>
                  <div className="task-detail-value mt-1 rounded-lg border px-2 py-1 text-gray-700 font-medium break-all">{detailTask.model}</div>
                </div>
                <div>
                  <span className="text-gray-500">生成模式:</span>
                  <div className="task-detail-plain-value flex items-center gap-1.5 text-gray-700 mt-1">
                    <ModeIcon mode={detailTask.mode} />
                    {getModeText(detailTask.mode)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">创建时间:</span>
                  <div className="task-detail-plain-value text-gray-700 mt-1">{formatTaskDate(detailTask.created_at)}</div>
                </div>
                <div>
                  <span className="text-gray-500">更新时间:</span>
                  <div className="task-detail-plain-value text-gray-700 mt-1">{formatTaskDate(detailTask.updated_at)}</div>
                </div>
              </div>

              {/* 标签管理 */}
              <div>
                <span className="text-sm text-gray-500">标签</span>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {(detailTask.tags ?? []).map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                      {tag}
                      <button
                        onClick={() => commitTaskTags(detailTask, (detailTask.tags ?? []).filter(t => t !== tag))}
                        className="text-indigo-400 hover:text-indigo-700"
                        title={`移除标签 ${tag}`}
                        aria-label={`移除标签 ${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={tagDraft}
                    onChange={e => setTagDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTaskTag(detailTask); }}
                    onBlur={() => { if (tagDraft.trim()) addTaskTag(detailTask); }}
                    placeholder="输入标签后按回车添加"
                    className="h-7 w-40 rounded-md border border-gray-200 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              {detailTask.auto_download && (() => {
                const badge = getAutoDownloadBadge(detailTask);
                return (
                  <div className="task-detail-section rounded-lg border border-sky-100 bg-sky-50/60 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-gray-600">自动下载</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>{badge.text}</span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      {detailTask.download_path && <div className="break-all">目标目录：{detailTask.download_path}</div>}
                      {detailTask.download_file_path && <div className="break-all">本地文件：{detailTask.download_file_path}</div>}
                      {detailTask.downloaded_at && <div>下载时间：{formatTaskDate(detailTask.downloaded_at)}</div>}
                      {detailTask.download_error && <div className="text-red-600">失败原因：{formatTaskError(detailTask.download_error, '自动下载失败')}</div>}
                    </div>
                    {(detailTask.download_file_path || detailTask.download_path) && (
                      <button
                        onClick={() => handleOpenDownloadTarget(detailTask)}
                        disabled={openingPathIds.has(detailTask.id)}
                        className="mt-2 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-sky-700 bg-white border border-sky-100 rounded-lg hover:bg-sky-50 disabled:opacity-50"
                      >
                        {openingPathIds.has(detailTask.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                        {detailTask.download_file_path ? '在文件夹中显示文件' : '打开目标文件夹'}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Prompt */}
              <div>
                <span className="text-sm text-gray-500">Prompt</span>
                <div className="task-detail-value mt-1 p-3 bg-gray-50 rounded-lg border text-sm text-gray-800 whitespace-pre-wrap">{detailTask.prompt || '(空)'}</div>
              </div>

              {/* 增强提示词 */}
              {detailTask.enhanced_prompt && (
                <div>
                  <span className="text-sm text-gray-500">增强提示词</span>
                  <div className="task-detail-value task-detail-value--accent mt-1 p-3 bg-purple-50 rounded-lg border text-sm text-purple-800 whitespace-pre-wrap">{detailTask.enhanced_prompt}</div>
                </div>
              )}

              {/* 轮询提示 */}
              {detailTask.last_poll_error && (
                <div>
                  <span className="text-sm text-amber-600">轮询提示</span>
                  <div className="task-warning-message mt-1 rounded-lg border p-3 text-sm text-amber-700 whitespace-pre-wrap">{formatTaskError(detailTask.last_poll_error, '自动轮询已暂停', '手动刷新或同步云端')}</div>
                </div>
              )}

              {/* 错误信息 */}
              {detailTask.error_message && (
                <div>
                  <span className="text-sm text-red-500">错误信息</span>
                  <div className="task-error-message mt-1 rounded-lg border p-3 text-sm text-red-700 whitespace-pre-wrap">{formatTaskError(detailTask.error_message)}</div>
                </div>
              )}

              {/* 重试历史 */}
              {detailTask.retry_history && detailTask.retry_history.length > 0 && (
                <div>
                  <span className="text-sm text-gray-500 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" />
                    重试历史 ({detailTask.retry_count} 次)
                  </span>
                  <div className="mt-2 space-y-2">
                    {detailTask.retry_history.map((h, i) => (
                      <div key={i} className="task-detail-section p-2.5 bg-gray-50 rounded-lg text-xs border border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-700">第 {i + 1} 次重试</span>
                          <span className="text-gray-400">{formatTaskDate(h.time)}</span>
                        </div>
                        <div className="text-gray-500">原任务 ID: {h.old_task_id}</div>
                        <div className="text-gray-500">新任务 ID: {h.new_task_id}</div>
                        {h.old_error && (
                          <div className="mt-1 text-red-400">失败原因: {formatTaskError(h.old_error, '任务失败')}</div>
                        )}
                        <div className={`mt-1 font-medium ${h.success ? 'text-green-600' : 'text-orange-600'}`}>
                          {h.success ? '提交成功' : (h.error ? formatErrorWithAdvice(getApiSafeMessage(h.error, '提交失败'), '手动刷新任务') : '提交失败')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 参考图 */}
              {(detailTask.image_url || detailTask.image_tail_url || (detailTask.image_urls && detailTask.image_urls.length > 0)) && (
                <div>
                  <span className="text-sm text-gray-500">参考图片</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detailTask.image_url && (
                      <AssetAwareImage url={detailTask.image_url} platform={getTaskPlatform(detailTask)} className="w-24 h-24 object-cover rounded border" alt="首帧" title="首帧" />
                    )}
                    {detailTask.image_tail_url && (
                      <AssetAwareImage url={detailTask.image_tail_url} platform={getTaskPlatform(detailTask)} className="w-24 h-24 object-cover rounded border" alt="尾帧" title="尾帧" />
                    )}
                    {detailTask.image_urls?.map((url, i) => (
                      <AssetAwareImage key={i} url={url} platform={getTaskPlatform(detailTask)} className="w-24 h-24 object-cover rounded border" alt={`参考图${i+1}`} />
                    ))}
                  </div>
                </div>
              )}

              {/* 视频结果 */}
              {detailTask.video_url ? (
                <div>
                  <span className="text-sm text-gray-500">视频结果</span>
                  <div className="mt-2 flex flex-col gap-2">
                    <video src={detailTask.video_url} controls preload="metadata" className="w-full max-h-64 rounded border bg-black" />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownload(detailTask.video_url)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 bg-green-50 rounded-lg hover:bg-green-100"
                      >
                        <Download className="w-3.5 h-3.5" /> 下载
                      </button>
                      <button
                        onClick={() => detailTask.video_url && handleCopyUrl(detailTask.video_url)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100"
                      >
                        {copiedUrl === detailTask.video_url ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        复制链接
                      </button>
                      {detailTask.saved_params && (
                        <button
                          onClick={() => {
                            requestReuseTask(detailTask.id);
                            setDetailTaskId(null);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> 复用参数
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="task-detail-section rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  {getTaskVideoResultHint(detailTask)}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;
