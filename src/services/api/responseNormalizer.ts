import type { VideoGenerationResponse } from '../../types';
import { normalizeTaskStatus } from '../../utils/taskStatus';
import type { UnifiedResponse } from './types';
import { collectUrls, isPresent } from './utils';

const normalizeTimestamp = (value: number | string | undefined): number | undefined => {
  if (!isPresent(value)) return undefined;
  if (typeof value === 'number') {
    // 火山方舟返回秒级 Unix 时间戳；本地 Task 使用毫秒时间戳。
    return value < 10_000_000_000 ? value * 1000 : value;
  }
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return asNumber < 10_000_000_000 ? asNumber * 1000 : asNumber;
  }
  const asDate = new Date(String(value)).getTime();
  return Number.isFinite(asDate) ? asDate : undefined;
};

export function normalizeResponse(raw: unknown): VideoGenerationResponse {
  if (!raw) throw new Error('响应数据为空');
  let response = raw as UnifiedResponse;

  if (response.error && typeof response.error === 'object' && response.error.message) {
    throw new Error(response.error.message);
  }
  if (response.error_code !== undefined && response.error_code !== 0) {
    throw new Error(response.msg || response.message || `接口错误码: ${response.error_code}`);
  }
  if (response.code !== undefined && response.code !== 0 && response.code !== 200) {
    throw new Error(response.msg || response.message || `接口错误码: ${response.code}`);
  }

  if (response.data && (response.data.task_id || response.data.id || response.data.status)) {
    response = response.data;
  }
  if (response.task && (response.task.task_id || response.task.id || response.task.status)) {
    response = response.task;
  }
  if (!response.task_id && !response.id && response.result) {
    response = {
      ...response,
      task_id: response.result.task_id,
      id: response.result.id,
      video_url: response.result.video_url,
      status: response.result.status,
      output: response.result.output,
    };
  }

  const errorMessage = response.error_message || response.error?.message || response.msg || response.message;
  const rawStatus = response.task_status ?? response.status;
  const common = {
    model: response.model || '',
    task_status: normalizeTaskStatus(rawStatus),
    enhanced_prompt: response.enhanced_prompt,
    last_frame_url: response.content?.last_frame_url ?? response.last_frame_url,
    created_at: normalizeTimestamp(response.created_at),
    error_message: errorMessage,
  };

  if (response.task_id) {
    const videoUrls = [
      ...(response.video_result ?? []),
      ...collectUrls(
        response.video_url,
        response.url,
        response.video?.url,
        response.content?.video_url,
        response.upsample_video_url,
        response.output?.[0]?.url,
        ...(response.videos ?? []).map(v => typeof v === 'string' ? v : v.url),
      ),
    ].filter((item, index, arr) => arr.findIndex(v => v.url === item.url) === index);
    return {
      task_id: response.task_id,
      ...common,
      video_result: videoUrls.length ? videoUrls : undefined,
    };
  }

  if (response.id) {
    const videoUrls = collectUrls(
      response.content?.video_url,
      response.video_url,
      response.upsample_video_url,
      response.output?.[0]?.url,
      response.url,
    );
    return {
      task_id: response.id,
      ...common,
      video_result: videoUrls.length ? videoUrls : undefined,
    };
  }

  throw new Error('无法解析响应数据');
}
