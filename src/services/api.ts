import axios, { AxiosError } from 'axios';
import type { VideoGenerationRequest, VideoGenerationResponse, TaskQueryResponse } from '../types';

class GeekaiApi {
  private axiosInstance = axios.create({
    baseURL: 'https://geekai.co/api',
  });

  constructor(apiKey: string) {
    this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
    this.axiosInstance.defaults.headers.common['Content-Type'] = 'application/json';
  }

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    try {
      const response = await this.axiosInstance.post('/v1/videos/generations', request);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        const responseData = axiosError.response.data as { message?: string };
        const errorMessage = responseData?.message || `请求失败: HTTP ${axiosError.response.status}`;
        throw new Error(errorMessage);
      }
      throw error;
    }
  }

  async queryTask(taskId: string): Promise<TaskQueryResponse> {
    try {
      const response = await this.axiosInstance.get(`/v1/videos/${taskId}`);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        const responseData = axiosError.response.data as { message?: string };
        const errorMessage = responseData?.message || `请求失败: HTTP ${axiosError.response.status}`;
        throw new Error(errorMessage);
      }
      throw error;
    }
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

export default GeekaiApi;
