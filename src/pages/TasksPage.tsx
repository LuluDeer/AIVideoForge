import React, { useState } from 'react';
import { Download, Trash2, ExternalLink, Loader2, Video, Image, CheckCircle2, Clock, Copy, Check } from 'lucide-react';
import { useTasks } from '../context/TaskContext';
import type { GenerationMode } from '../types';

type StatusFilter = 'all' | 'running' | 'succeed' | 'failed';

const TasksPage: React.FC = () => {
  const { tasks, removeTask, clearTasks } = useTasks();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const filteredByStatus = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const modelStats = filteredByStatus.reduce((acc, task) => {
    const model = task.model || '未知模型';
    acc[model] = (acc[model] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredTasks = filteredByStatus.filter(task => {
    if (selectedModels.length === 0) return true;
    const model = task.model || '未知模型';
    return selectedModels.includes(model);
  });

  const toggleModel = (model: string) => {
    setSelectedModels(prev => {
      if (prev.includes(model)) {
        return prev.filter(m => m !== model);
      }
      return [...prev, model];
    });
  };

  const modelColors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
    'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-red-500'
  ];

  const getModelColor = (model: string) => {
    const index = Object.keys(modelStats).indexOf(model) % modelColors.length;
    return modelColors[index];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-blue-100 text-blue-800';
      case 'running': return 'bg-yellow-100 text-yellow-800';
      case 'succeed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '排队中';
      case 'running': return '生成中';
      case 'succeed': return '已完成';
      case 'failed': return '失败';
      default: return status || '未知';
    }
  };

  const getModeText = (mode: GenerationMode) => {
    switch (mode) {
      case 'text': return '文生视频';
      case 'image': return '图生视频';
      case 'imageTail': return '首尾帧';
      case 'multiImage': return '多图生成';
      default: return '未知';
    }
  };

  const getModeIcon = (mode: GenerationMode) => {
    switch (mode) {
      case 'text':
        return <Video className="w-4 h-4" />;
      case 'image':
      case 'imageTail':
      case 'multiImage':
        return <Image className="w-4 h-4" />;
      default:
        return <Video className="w-4 h-4" />;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleDownload = (url: string | undefined) => {
    if (!url) return;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = url.split('/').pop() || 'video.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    });
  };

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'running', label: '生成中' },
    { value: 'succeed', label: '已完成' },
    { value: 'failed', label: '失败' },
  ];

  const stats = {
    all: tasks.length,
    running: tasks.filter(t => t.status === 'running').length,
    succeed: tasks.filter(t => t.status === 'succeed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">任务管理</h2>
          {tasks.length > 0 && (
            <button
              onClick={clearTasks}
              className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              清空全部
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {statusFilters.map(s => (
            <div
              key={s.value}
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                filter === s.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              onClick={() => setFilter(s.value)}
            >
              <div className="text-2xl font-bold text-gray-800">{stats[s.value]}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-600">模型筛选:</span>
            {Object.entries(modelStats).map(([model, count]) => (
              <button
                key={model}
                onClick={() => toggleModel(model)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedModels.includes(model)
                    ? `${getModelColor(model)} text-white`
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

        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-gray-400">
              <ExternalLink className="w-16 h-16 mx-auto mb-4" />
              <p className="text-lg">暂无任务</p>
              <p className="text-sm">在视频生成页面创建任务后，会在这里显示</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredTasks.map(task => (
              <div
                key={task.id}
                className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleCopyId(task.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-gray-600 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      title="点击复制任务ID"
                    >
                      {copiedId === task.id ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span className="max-w-xs truncate">{task.id}</span>
                    </button>
                    <div className="text-sm text-gray-500">
                      {formatDate(task.created_at)}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <span className="text-gray-400">{getModeIcon(task.mode)}</span>
                      <span>{getModeText(task.mode)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <span className="text-gray-400">模型:</span>
                      <span className="text-gray-700 font-medium">{task.model}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.auto_download && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        task.downloaded ? 'bg-green-100 text-green-700' :
                        task.status === 'succeed' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {task.downloaded ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                        {task.downloaded ? '已下载' : task.status === 'succeed' ? '下载中' : '等待下载'}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                      {task.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      {getStatusText(task.status)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-relaxed">
                      {task.prompt}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {task.video_url && (
                      <>
                        <button
                          onClick={() => task.video_url && handleCopyUrl(task.video_url)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
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
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="下载视频"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.open(task.video_url, '_blank')}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="预览视频"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => removeTask(task.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="删除任务"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TasksPage;
