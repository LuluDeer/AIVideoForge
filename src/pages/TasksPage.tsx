import React, { useState } from 'react';
import { Download, Trash2, ExternalLink, Loader2, Video, Image, CheckCircle2, Clock } from 'lucide-react';
import { useTasks } from '../context/TaskContext';
import type { GenerationMode } from '../types';

type StatusFilter = 'all' | 'running' | 'succeed' | 'failed';

const TasksPage: React.FC = () => {
  const { tasks, removeTask, clearTasks } = useTasks();
  const [filter, setFilter] = useState<StatusFilter>('all');

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

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

        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-gray-400">
              <ExternalLink className="w-16 h-16 mx-auto mb-4" />
              <p className="text-lg">暂无任务</p>
              <p className="text-sm">在视频生成页面创建任务后，会在这里显示</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      任务ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      生成模式
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prompt
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      模型
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      自动下载
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      创建时间
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTasks.map(task => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <code className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          {task.id}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{getModeIcon(task.mode)}</span>
                          <span className="text-sm text-gray-700">{getModeText(task.mode)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs truncate text-sm text-gray-800" title={task.prompt}>
                          {task.prompt}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{task.model}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                          {task.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                          {getStatusText(task.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {task.auto_download ? (
                          <div className="flex items-center gap-1">
                            {task.downloaded ? (
                              <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                已下载
                              </span>
                            ) : task.status === 'succeed' ? (
                              <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                <Clock className="w-3 h-3 mr-1" />
                                下载中
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-medium">
                                <Clock className="w-3 h-3 mr-1" />
                                等待中
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">未开启</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500">{formatDate(task.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {task.video_url && (
                            <>
                              <button
                                onClick={() => handleDownload(task.video_url)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="下载视频"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => window.open(task.video_url, '_blank')}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="预览视频"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => removeTask(task.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除任务"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TasksPage;
