import type { RuntimePlatform } from '../../types';
import type { EndpointType } from './types';

/** 获取 endpoint 路径，支持 {id} / {task_id} 占位符替换或 query string 追加。 */
export function getEndpoint(platform: RuntimePlatform, type: EndpointType, taskId?: string): string {
  const pathMap: Record<EndpointType, string | undefined> = {
    createVideo: platform.endpoints.createVideo,
    queryTask: platform.endpoints.queryTask,
    downloadVideo: platform.endpoints.downloadVideo,
    queryTaskList: platform.endpoints.queryTaskList,
    deleteTask: platform.endpoints.deleteTask,
  };
  const path = pathMap[type];
  if (!path) {
    throw new Error(`当前平台不支持「${type}」端点，请在配置页补充 API 端点`);
  }
  if (!taskId) return path;
  const encodedTaskId = encodeURIComponent(taskId);
  if (path.includes('{task_id}')) return path.replace('{task_id}', encodedTaskId);
  if (path.includes('{id}')) return path.replace('{id}', encodedTaskId);
  return `${path}?id=${encodedTaskId}`;
}

export function getAbsoluteEndpointUrl(platform: RuntimePlatform, type: EndpointType, taskId?: string): string {
  const endpoint = getEndpoint(platform, type, taskId);
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${platform.baseUrl.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
}
