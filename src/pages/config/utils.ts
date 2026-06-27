import { buildDefaultParams } from '../../services/modelTemplates';
import type { ApiEndpoints, ApiFormatType, CustomPlatformDef } from '../../types';

export const defaultEndpointsForFormat = (format: ApiFormatType): ApiEndpoints => {
  if (format === 'seedance') {
    return {
      createVideo: '/contents/generations/tasks',
      queryTask: '/contents/generations/tasks/{id}',
      queryTaskList: '/contents/generations/tasks',
      deleteTask: '/contents/generations/tasks/{id}',
    };
  }
  if (format === 'openai') {
    return { createVideo: '/v1/video/create', queryTask: '/v1/video/query' };
  }
  return { createVideo: '/v1/videos/generations', queryTask: '/v1/videos/{id}' };
};

export const emptyPlatform = (): CustomPlatformDef => ({
  id: `custom-${Date.now()}`,
  name: '自定义平台',
  baseUrl: '',
  apiKey: '',
  apiFormat: 'unified',
  imageUploadMode: 'url',
  endpoints: defaultEndpointsForFormat('unified'),
  defaultModel: 'custom-model',
  models: [{
    id: 'custom-model',
    name: '自定义模型',
    label: '自定义模型',
    modes: ['text', 'image', 'imageTail', 'multiImage'],
    params: buildDefaultParams(['text', 'image', 'imageTail', 'multiImage']),
  }],
});

export const mergeEndpoints = (base: ApiEndpoints, override?: Partial<ApiEndpoints>): ApiEndpoints => ({
  createVideo: override?.createVideo ?? base.createVideo,
  queryTask: override?.queryTask ?? base.queryTask,
  queryTaskList: override?.queryTaskList ?? base.queryTaskList,
  deleteTask: override?.deleteTask ?? base.deleteTask,
});
