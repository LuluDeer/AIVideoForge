import type { GenerationMode, Task } from '../../types';

export const MODEL_COLOR_CLASSES = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-red-500',
];

export function getModelColor(model: string, modelStats: Record<string, number>): string {
  const index = Object.keys(modelStats).indexOf(model) % MODEL_COLOR_CLASSES.length;
  return MODEL_COLOR_CLASSES[index] ?? MODEL_COLOR_CLASSES[0];
}

export function getModeText(mode: GenerationMode): string {
  switch (mode) {
    case 'text': return '文生视频';
    case 'image': return '图生视频';
    case 'imageTail': return '首尾帧';
    case 'multiImage': return '多图生成';
    case 'multiModal': return '多模态参考';
    default: return '未知';
  }
}

export function formatTaskDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function getTaskEmptyState(totalTasks: number, visibleTasks: number): { title: string; description: string } {
  if (totalTasks === 0) {
    return { title: '暂无任务', description: '到视频生成页提交 Prompt，任务会显示在这里。' };
  }
  if (visibleTasks === 0) {
    return { title: '没有匹配结果', description: '清除搜索词或筛选条件后再试。' };
  }
  return { title: '暂无可显示任务', description: '刷新列表或调整筛选条件。' };
}

export function getTaskVideoResultHint(task: Pick<Task, 'status' | 'poll_paused' | 'raw_status'>): string {
  if (task.poll_paused) return '轮询已暂停。请手动刷新任务，或重试生成。';
  if (task.raw_status && !['pending', 'running', 'succeed', 'failed', 'cancelled'].includes(task.raw_status)) {
    return `状态未知（${task.raw_status}）。请手动刷新确认结果。`;
  }
  if (task.status === 'succeed') return '任务已完成但暂无视频链接。请手动刷新，或检查平台返回结果。';
  if (task.status === 'failed') return '任务失败且暂无视频。查看错误信息后重试。';
  return '暂无视频结果。若仍在生成，请稍后刷新。';
}
