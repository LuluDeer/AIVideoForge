import type { RuntimePlatform } from '../../types';
import type { EndpointType } from './types';

/** 获取 endpoint 路径，支持 {id} 占位符替换或 query string 追加。 */
export function getEndpoint(platform: RuntimePlatform, type: EndpointType, taskId?: string): string {
  const pathMap: Record<EndpointType, string | undefined> = {
    createVideo: platform.endpoints.createVideo,
    queryTask: platform.endpoints.queryTask,
    queryTaskList: platform.endpoints.queryTaskList,
    deleteTask: platform.endpoints.deleteTask,
  };
  const path = pathMap[type];
  if (!path) {
    throw new Error(`当前平台不支持「${type}」端点，请在配置页补充 API 端点`);
  }
  if (!taskId) return path;
  if (path.includes('{id}')) return path.replace('{id}', taskId);
  return `${path}?id=${encodeURIComponent(taskId)}`;
}
