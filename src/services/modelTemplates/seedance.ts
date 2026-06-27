import type { ModelDef, ParamDef, PlatformDef } from '../../types';
import {
  aspectRatioParam,
  asyncParam,
  durationParam,
  generateAudioParam,
  imageParam,
  imageTailParam,
  imagesParam,
  videosParam,
  audiosParam,
  resolutionParam,
  watermarkParam,
} from './commonParams';

const returnLastFrameParam: ParamDef = {
  key: 'return_last_frame',
  label: '返回尾帧',
  type: 'boolean',
  hidden: true,
  defaultValue: false,
};

const serviceTierParam: ParamDef = {
  key: 'service_tier',
  label: '服务等级',
  type: 'string',
  defaultValue: 'default',
  options: [
    { label: '在线推理 (default)', value: 'default' },
    { label: '离线推理 (flex)', value: 'flex' },
  ],
  hidden: true,
};

const priorityParam: ParamDef = {
  key: 'priority',
  label: '优先级',
  type: 'number',
  defaultValue: 0,
  hidden: true,
};

const webSearchToolParam: ParamDef = {
  key: 'tools_web_search',
  label: '联网搜索',
  type: 'boolean',
  defaultValue: false,
};

const seedanceRatioParam = (defaultValue = 'adaptive'): ParamDef => ({
  ...aspectRatioParam(['16:9', '9:16', '3:4', '4:3', '1:1', '21:9', 'adaptive'], defaultValue),
  apiKey: 'ratio',
});

const seedanceCommonParams: ParamDef[] = [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  imagesParam({ min: 1, max: 9 }),
  { ...imagesParam({ min: 0, max: 9 }), modes: ['multiModal'] },
  videosParam({ min: 0, max: 3 }),
  audiosParam({ min: 0, max: 3 }),
  seedanceRatioParam('adaptive'),
  resolutionParam(['480p', '720p', '1080p', '4k'], '720p'),
  durationParam([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, -1], 5),
  generateAudioParam(true),
  returnLastFrameParam,
  serviceTierParam,
  priorityParam,
  webSearchToolParam,
  watermarkParam(false),
  asyncParam,
];

const seedance20FastParams: ParamDef[] = [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  imagesParam({ min: 1, max: 9 }),
  { ...imagesParam({ min: 0, max: 9 }), modes: ['multiModal'] },
  videosParam({ min: 0, max: 3 }),
  audiosParam({ min: 0, max: 3 }),
  seedanceRatioParam('adaptive'),
  resolutionParam(['480p', '720p'], '720p'),
  durationParam([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, -1], 5),
  generateAudioParam(true),
  returnLastFrameParam,
  serviceTierParam,
  priorityParam,
  webSearchToolParam,
  watermarkParam(false),
  asyncParam,
];

const seedanceMiniParams: ParamDef[] = [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  imagesParam({ min: 1, max: 9 }),
  { ...imagesParam({ min: 0, max: 9 }), modes: ['multiModal'] },
  videosParam({ min: 0, max: 3 }),
  audiosParam({ min: 0, max: 3 }),
  seedanceRatioParam('adaptive'),
  resolutionParam(['480p', '720p'], '720p'),
  durationParam([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, -1], 5),
  generateAudioParam(true),
  returnLastFrameParam,
  serviceTierParam,
  priorityParam,
  webSearchToolParam,
  watermarkParam(false),
  asyncParam,
];

const seedance15Params: ParamDef[] = [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  seedanceRatioParam('adaptive'),
  resolutionParam(['720p', '1080p'], '720p'),
  durationParam([4, 5, 6, 7, 8, 9, 10, 11, 12, -1], 5),
  generateAudioParam(true),
  returnLastFrameParam,
  watermarkParam(false),
  asyncParam,
];

const seedance10ProParams: ParamDef[] = [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  seedanceRatioParam('adaptive'),
  resolutionParam(['480p', '720p', '1080p'], '1080p'),
  durationParam([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 5),
  watermarkParam(false),
  asyncParam,
];

const seedance10FastParams: ParamDef[] = [
  imageParam(['image']),
  seedanceRatioParam('adaptive'),
  resolutionParam(['480p', '720p', '1080p'], '1080p'),
  durationParam([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 5),
  watermarkParam(false),
  asyncParam,
];

export const createSeedanceModels = (platformId: string): ModelDef[] => [
  {
    id: 'doubao-seedance-2-0-260128',
    platformId,
    name: 'Seedance 2.0',
    label: 'Seedance 2.0 (推荐)',
    price: '按秒计费',
    modes: ['text', 'image', 'imageTail', 'multiImage', 'multiModal'],
    apiFormat: 'seedance',
    params: seedanceCommonParams,
  },
  {
    id: 'doubao-seedance-2-0-fast-260128',
    platformId,
    name: 'Seedance 2.0 Fast',
    label: 'Seedance 2.0 Fast (快速)',
    price: '按秒计费',
    modes: ['text', 'image', 'imageTail', 'multiImage', 'multiModal'],
    apiFormat: 'seedance',
    params: seedance20FastParams,
  },
  {
    id: 'doubao-seedance-2-0-mini-260615',
    platformId,
    name: 'Seedance 2.0 Mini',
    label: 'Seedance 2.0 Mini (轻量)',
    price: '按秒计费',
    modes: ['text', 'image', 'imageTail', 'multiImage', 'multiModal'],
    apiFormat: 'seedance',
    params: seedanceMiniParams,
  },
  {
    id: 'doubao-seedance-1-5-pro-250905',
    platformId,
    name: 'Seedance 1.5 Pro',
    label: 'Seedance 1.5 Pro',
    price: '按秒计费',
    modes: ['text', 'image', 'imageTail'],
    apiFormat: 'seedance',
    params: seedance15Params,
  },
  {
    id: 'doubao-seedance-1-0-pro-240821',
    platformId,
    name: 'Seedance 1.0 Pro',
    label: 'Seedance 1.0 Pro',
    price: '按秒计费',
    modes: ['text', 'image', 'imageTail'],
    apiFormat: 'seedance',
    params: seedance10ProParams,
  },
  {
    id: 'doubao-seedance-1-0-pro-fast-241107',
    platformId,
    name: 'Seedance 1.0 Pro Fast',
    label: 'Seedance 1.0 Pro Fast',
    price: '按秒计费',
    modes: ['text', 'image'],
    apiFormat: 'seedance',
    params: seedance10FastParams,
  },
];

export const seedancePlatformDef: PlatformDef = {
  id: 'seedance',
  name: '火山方舟 / 豆包官方',
  defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  defaultEndpoints: {
    createVideo: '/contents/generations/tasks',
    queryTask: '/contents/generations/tasks/{id}',
    queryTaskList: '/contents/generations/tasks',
    deleteTask: '/contents/generations/tasks/{id}',
  },
  defaultModel: 'doubao-seedance-2-0-260128',
  models: createSeedanceModels('seedance'),
};

export const doubaoOfficialPlatformDef: PlatformDef = {
  id: 'doubao-official',
  name: '火山方舟 / 豆包官方（兼容旧配置）',
  defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  defaultEndpoints: {
    createVideo: '/contents/generations/tasks',
    queryTask: '/contents/generations/tasks/{id}',
    queryTaskList: '/contents/generations/tasks',
    deleteTask: '/contents/generations/tasks/{id}',
  },
  defaultModel: 'doubao-seedance-2-0-260128',
  models: createSeedanceModels('doubao-official'),
};
