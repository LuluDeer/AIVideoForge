import axios, { AxiosError } from 'axios';
import type { VideoGenerationRequest, VideoGenerationResponse, TaskQueryResponse, PlatformConfig } from '../types';

interface UnifiedResponse {
  task_id?: string;
  task_status?: 'pending' | 'running' | 'succeed' | 'failed' | string;
  model?: string;
  video_result?: Array<{ url: string }>;
  enhanced_prompt?: string;
  id?: string;
  status?: string;
  video_url?: string;
  output?: Array<{ url: string }>;
  detail?: {
    status?: string;
    video_url?: string;
  };
  upsample_video_url?: string;
}

class VideoApi {
  private axiosInstance = axios.create();
  private platform: PlatformConfig;

  constructor(platform: PlatformConfig) {
    this.platform = platform;
    this.axiosInstance = axios.create({
      baseURL: platform.baseUrl,
    });
    
    if (platform.apiKey) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${platform.apiKey}`;
    }
    this.axiosInstance.defaults.headers.common['Content-Type'] = 'application/json';
  }

  private buildUnifiedRequest(request: VideoGenerationRequest): Record<string, unknown> {
    const unifiedRequest: Record<string, unknown> = {
      model: request.model,
      prompt: request.prompt,
    };

    if (this.platform.id === 'geekai') {
      unifiedRequest.async = request.async ?? true;
    }

    if (this.platform.enableEnhancePrompt !== undefined) {
      unifiedRequest.enhance_prompt = request.enhance_prompt ?? true;
    }
    if (this.platform.enableUpsample !== undefined) {
      unifiedRequest.enable_upsample = request.enable_upsample ?? true;
    }
    
    if (request.aspect_ratio) {
      unifiedRequest.aspect_ratio = request.aspect_ratio;
    }
    if (request.resolution && !['apizzz', 'apizzz-openai'].includes(this.platform.id)) {
      unifiedRequest.resolution = request.resolution;
    }
    if (request.duration) {
      unifiedRequest.duration = request.duration;
    }
    
    if (Array.isArray(request.image)) {
      unifiedRequest.images = request.image;
    } else if (request.image) {
      unifiedRequest.images = [request.image];
    }
    if (request.image_tail && !unifiedRequest.images) {
      unifiedRequest.images = [request.image, request.image_tail];
    } else if (request.image_tail && unifiedRequest.images) {
      (unifiedRequest.images as string[]).push(request.image_tail);
    }
    
    return unifiedRequest;
  }

  private buildOpenAIRequest(request: VideoGenerationRequest): Record<string, unknown> {
    const openaiRequest: Record<string, unknown> = {
      model: request.model,
      prompt: request.prompt,
    };
    
    if (request.seconds !== undefined) {
      openaiRequest.seconds = String(request.seconds);
    } else if (request.duration) {
      openaiRequest.seconds = String(request.duration);
    }
    
    if (request.size) {
      openaiRequest.size = request.size;
    } else if (request.aspect_ratio) {
      openaiRequest.size = request.aspect_ratio.replace(':', 'x');
    }
    
    if (this.platform.enableWatermark !== undefined) {
      openaiRequest.watermark = String(request.watermark ?? false);
    }
    
    return openaiRequest;
  }

  private getEndpoint(endpointType: 'createVideo' | 'queryTask'): string {
    const endpoints = this.platform.endpoints;
    return endpointType === 'createVideo' ? endpoints.createVideo : endpoints.queryTask;
  }

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    try {
      const endpoint = this.getEndpoint('createVideo');
      const format = this.platform.apiFormat;
      
      let payload: Record<string, unknown>;
      if (format === 'openai') {
        payload = this.buildOpenAIRequest(request);
      } else {
        payload = this.buildUnifiedRequest(request);
      }

      const response = await this.axiosInstance.post(endpoint, payload);
      return this.normalizeResponse(response.data);
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        const responseData = axiosError.response.data as { message?: string; error?: { message?: string } };
        const errorMessage = responseData?.error?.message || responseData?.message || `请求失败: HTTP ${axiosError.response.status}`;
        throw new Error(errorMessage);
      }
      throw error;
    }
  }

  private normalizeResponse(response: UnifiedResponse): VideoGenerationResponse {
    if (!response) {
      throw new Error('响应数据为空');
    }

    if (response.task_id && response.task_status !== undefined) {
      const status = response.task_status;
      const normalizedStatus = status === 'video_generating' ? 'running' : status;
      return {
        task_id: response.task_id,
        task_status: normalizedStatus as VideoGenerationResponse['task_status'],
        model: response.model || '',
        video_result: response.video_result,
        enhanced_prompt: response.enhanced_prompt,
      };
    }

    if (response.id) {
      const status = response.status;
      let taskStatus: 'pending' | 'running' | 'succeed' | 'failed' = 'running';
      
      if (status === 'completed') {
        taskStatus = 'succeed';
      } else if (status === 'failed') {
        taskStatus = 'failed';
      } else if (status === 'pending' || status === 'queued') {
        taskStatus = 'pending';
      } else {
        taskStatus = 'running';
      }

      return {
        task_id: response.id,
        task_status: taskStatus,
        model: response.model || '',
        video_result: response.video_url ? [{ url: response.video_url }] : 
                      response.output?.map((item) => ({ url: item.url })) || undefined,
        enhanced_prompt: response.enhanced_prompt,
      };
    }

    throw new Error('无法解析响应数据');
  }

  async queryTask(taskId: string): Promise<TaskQueryResponse> {
    try {
      const endpoint = this.getEndpoint('queryTask');
      const resolvedEndpoint = endpoint.replace('{id}', taskId);
      
      const isQueryParamStyle = this.platform.endpoints.queryTask.includes('?') || 
                               this.platform.id === 'apizzz';
      
      let response;
      if (isQueryParamStyle) {
        response = await this.axiosInstance.get(resolvedEndpoint.split('?')[0], {
          params: { id: taskId },
        });
      } else {
        response = await this.axiosInstance.get(resolvedEndpoint);
      }
      
      return this.normalizeTaskResponse(response.data);
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        const responseData = axiosError.response.data as { message?: string; error?: { message?: string } };
        const errorMessage = responseData?.error?.message || responseData?.message || `请求失败: HTTP ${axiosError.response.status}`;
        throw new Error(errorMessage);
      }
      throw error;
    }
  }

  private normalizeTaskResponse(response: UnifiedResponse): TaskQueryResponse {
    if (!response) {
      throw new Error('响应数据为空');
    }

    if (response.task_id && response.task_status !== undefined) {
      const status = response.task_status;
      const normalizedStatus = status === 'video_generating' ? 'running' : status;
      return {
        task_id: response.task_id,
        task_status: normalizedStatus as TaskQueryResponse['task_status'],
        model: response.model || '',
        video_result: response.video_result,
        enhanced_prompt: response.enhanced_prompt,
      };
    }

    if (response.id) {
      const status = response.status || response.detail?.status;
      let taskStatus: 'pending' | 'running' | 'succeed' | 'failed' = 'running';
      
      if (status === 'completed') {
        taskStatus = 'succeed';
      } else if (status === 'failed') {
        taskStatus = 'failed';
      } else if (status === 'pending' || status === 'queued') {
        taskStatus = 'pending';
      } else if (status === 'video_generating') {
        taskStatus = 'running';
      } else {
        taskStatus = 'running';
      }

      const videoUrl = response.video_url || response.detail?.video_url || response.upsample_video_url;

      return {
        task_id: response.id,
        task_status: taskStatus,
        model: response.model || '',
        video_result: videoUrl ? [{ url: videoUrl }] : undefined,
        enhanced_prompt: response.enhanced_prompt,
      };
    }

    throw new Error('无法解析任务响应数据');
  }

  async waitForTask(taskId: string, timeout: number = 300000, interval: number = 5000): Promise<TaskQueryResponse> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const result = await this.queryTask(taskId);
      if (result.task_status === 'succeed' || result.task_status === 'failed') {
        return result;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('任务超时');
  }
}

export default VideoApi;
