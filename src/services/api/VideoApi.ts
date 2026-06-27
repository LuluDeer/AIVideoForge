import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { RuntimePlatform, TaskQueryResponse, VideoGenerationRequest, VideoGenerationResponse } from '../../types';
import { getEndpoint } from './endpoint';
import { normalizeAxiosError } from './errorNormalizer';
import { buildRequestPayload } from './payloadBuilders';
import { normalizeResponse } from './responseNormalizer';

const DEFAULT_API_TIMEOUT_MS = 60_000;

class VideoApi {
  private axiosInstance: AxiosInstance;
  private platform: RuntimePlatform;

  constructor(platform: RuntimePlatform) {
    this.platform = platform;
    this.axiosInstance = axios.create({
      baseURL: platform.baseUrl,
      timeout: DEFAULT_API_TIMEOUT_MS,
    });
    if (platform.apiKey) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${platform.apiKey}`;
    }
    // 不设默认 Content-Type：让 axios 对 JSON 自动设 application/json，
    // 对 FormData 自动设带 boundary 的 multipart/form-data。
  }

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    try {
      let endpoint = getEndpoint(this.platform, 'createVideo');

      // Kling 图生视频：当有首帧/尾帧图时切换到 image2video 端点。
      if ((request.image || request.image_tail || request.images) && endpoint.includes('text2video')) {
        endpoint = endpoint.replace('text2video', 'image2video');
      }

      const payload = buildRequestPayload(this.platform, request);
      const response = await this.axiosInstance.post(endpoint, payload);
      return normalizeResponse(response.data);
    } catch (error) {
      throw normalizeAxiosError(error, '视频生成请求失败');
    }
  }

  async queryTask(taskId: string, _modelId?: string): Promise<TaskQueryResponse> {
    void _modelId;
    try {
      const endpoint = getEndpoint(this.platform, 'queryTask', taskId);
      const response = await this.axiosInstance.get(endpoint);
      const normalized = normalizeResponse(response.data);
      return {
        model: normalized.model,
        task_id: normalized.task_id,
        task_status: normalized.task_status,
        video_result: normalized.video_result,
        enhanced_prompt: normalized.enhanced_prompt,
        last_frame_url: normalized.last_frame_url,
        created_at: normalized.created_at,
        error_message: normalized.error_message,
      };
    } catch (error) {
      throw normalizeAxiosError(error, '任务查询失败');
    }
  }

  /** 删除/取消任务 */
  async deleteTask(taskId: string): Promise<void> {
    try {
      const endpoint = getEndpoint(this.platform, 'deleteTask', taskId);
      await this.axiosInstance.delete(endpoint);
    } catch (error) {
      throw normalizeAxiosError(error, '任务取消失败');
    }
  }

  /** 从云端拉取任务列表，支持分页 */
  async queryTaskList(options?: { page?: number; pageSize?: number; status?: string }): Promise<TaskQueryResponse[]> {
    try {
      const endpoint = getEndpoint(this.platform, 'queryTaskList');
      const params: Record<string, number | string> = {};
      if (options?.page) params.page = options.page;
      if (options?.pageSize) {
        params.page_size = options.pageSize;
        params.pageSize = options.pageSize;
      }
      if (options?.status) params.status = options.status;
      const response = await this.axiosInstance.get(endpoint, { params });
      const data = response.data?.data?.tasks
        || response.data?.data?.items
        || response.data?.data
        || response.data?.tasks
        || response.data?.items
        || response.data?.result
        || response.data;
      if (!Array.isArray(data)) return [];
      return data.map((item: unknown) => normalizeResponse(item));
    } catch (error) {
      throw normalizeAxiosError(error, '任务列表查询失败');
    }
  }
}

export default VideoApi;
