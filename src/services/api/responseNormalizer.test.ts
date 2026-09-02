import { describe, expect, it } from 'vitest';
import { normalizeResponse } from './responseNormalizer';

describe('responseNormalizer', () => {
  it('失败任务的 error 字段只是失败原因，不应抛异常（status: failed + error 对象）', () => {
    const result = normalizeResponse({
      id: 'task_yPpKjL0DmWi3oxPtT4JjmWAZ6uLk7EAp',
      status: 'failed',
      model: 'xinyao-2.0-720p-TJ',
      progress: 100,
      error: {
        code: '生成失败：模型服务没有返回具体原因。请先检查提示词和参考素材；确认无敏感内容后重试',
        message: '生成失败：模型服务返回了无法识别的错误，请检查提示词、参数和参考素材后重试',
      },
    });
    expect(result.task_id).toBe('task_yPpKjL0DmWi3oxPtT4JjmWAZ6uLk7EAp');
    expect(result.task_status).toBe('failed');
    expect(result.error_message).toContain('模型服务返回了无法识别的错误');
  });

  it('failed 任务的 error_message 不取 HTTP 层错误，而是取任务失败原因', () => {
    const result = normalizeResponse({
      task_id: 't1',
      task_status: 'failed',
      error_message: '任务失败：敏感内容',
    });
    expect(result.task_status).toBe('failed');
    expect(result.error_message).toBe('任务失败：敏感内容');
  });

  it('接口级错误（无任务 id/status）仍然抛异常', () => {
    expect(() => normalizeResponse({ error: { message: 'invalid api key' } })).toThrow('invalid api key');
    expect(() => normalizeResponse({ code: 401, msg: 'unauthorized' })).toThrow('unauthorized');
    expect(() => normalizeResponse({ error_code: 429, message: 'rate limited' })).toThrow('rate limited');
  });

  it('成功任务返回成功状态和视频地址', () => {
    const result = normalizeResponse({
      id: 't2',
      status: 'succeed',
      video_url: 'https://example.com/video.mp4',
    });
    expect(result.task_status).toBe('succeed');
    expect(result.video_result?.[0]?.url).toBe('https://example.com/video.mp4');
  });

  it('拒绝非 http(s) 协议的结果 URL（javascript:/data: 防注入）', () => {
    const result = normalizeResponse({
      task_id: 't3',
      task_status: 'succeed',
      video_result: [
        { url: 'javascript:alert(1)' },
        { url: 'data:text/html,<script>alert(1)</script>' },
        { url: 'https://ok.example.com/v.mp4' },
      ],
      last_frame_url: 'javascript:evil()',
    });
    expect(result.video_result).toEqual([{ url: 'https://ok.example.com/v.mp4' }]);
    expect(result.last_frame_url).toBeUndefined();
  });

  it('collectUrls 路径同样过滤非法协议', () => {
    const result = normalizeResponse({
      id: 't4',
      status: 'succeed',
      url: 'javascript:alert(1)',
      video_url: 'file:///C:/windows/system32',
    });
    expect(result.video_result).toBeUndefined();
  });
});
