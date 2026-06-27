import { describe, expect, it } from 'vitest';
import { formatTaskDate, getModeText, getModelColor, getTaskEmptyState, getTaskVideoResultHint } from './taskPresentation';

describe('taskPresentation helpers', () => {
  it('maps modes and model colors predictably', () => {
    expect(getModeText('text')).toBe('文生视频');
    expect(getModeText('multiImage')).toBe('多图生成');
    expect(getModelColor('b', { a: 1, b: 2 })).toBe('bg-green-500');
    expect(getModelColor('missing', {})).toBe('bg-blue-500');
  });

  it('formats task timestamps for display', () => {
    expect(formatTaskDate(0)).toContain('1970');
  });

  it('returns actionable empty-state copy', () => {
    expect(getTaskEmptyState(0, 0)).toEqual({
      title: '暂无任务',
      description: '到视频生成页提交 Prompt，任务会显示在这里。',
    });
    expect(getTaskEmptyState(3, 0)).toEqual({
      title: '没有匹配结果',
      description: '清除搜索词或筛选条件后再试。',
    });
  });

  it('explains missing video results by task state', () => {
    expect(getTaskVideoResultHint({ status: 'succeed' })).toContain('手动刷新');
    expect(getTaskVideoResultHint({ status: 'failed' })).toContain('查看错误信息');
    expect(getTaskVideoResultHint({ status: 'running', raw_status: 'weird' })).toContain('weird');
    expect(getTaskVideoResultHint({ status: 'running', poll_paused: true })).toContain('轮询已暂停');
  });
});
