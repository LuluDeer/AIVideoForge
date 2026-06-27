import type { GenerationMode, ParamDef, PlatformDef } from '../../types';
import { aspectRatioParam, asyncParam, durationParam, imageParam, imageTailParam } from './commonParams';

const klingCommonParams = (modes: GenerationMode[]): ParamDef[] => [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  aspectRatioParam(['16:9', '9:16', '1:1'], '16:9'),
  durationParam([5, 10], 5),
  {
    key: 'cfg_scale',
    label: '创意程度',
    type: 'number',
    defaultValue: 0.5,
    options: [
      { label: '0.0 (遵循原图)', value: 0.0 },
      { label: '0.5 (均衡)', value: 0.5 },
      { label: '1.0 (自由发挥)', value: 1.0 },
    ],
    modes,
  } as ParamDef,
  {
    key: 'mode',
    label: '质量模式',
    type: 'string',
    defaultValue: 'std',
    options: [
      { label: '标准 (std)', value: 'std' },
      { label: '专业 (pro)', value: 'pro' },
    ],
  } as ParamDef,
  asyncParam,
];

export const klingPlatformDef: PlatformDef = {
  id: 'kling',
  name: '快手可灵 (Kling)',
  defaultBaseUrl: 'https://api.klingai.com',
  defaultEndpoints: {
    createVideo: '/v1/videos/text2video',
    queryTask: '/v1/videos/tasks/{id}',
  },
  defaultModel: 'kling-v2-master',
  models: [
    {
      id: 'kling-v2-master',
      platformId: 'kling',
      name: 'Kling v2 Master',
      label: 'Kling v2 Master (旗舰)',
      price: '按次计费',
      modes: ['text', 'image'],
      apiFormat: 'unified',
      params: klingCommonParams(['text', 'image']),
    },
    {
      id: 'kling-v1-5-pro',
      platformId: 'kling',
      name: 'Kling v1.5 Pro',
      label: 'Kling v1.5 Pro',
      price: '按次计费',
      modes: ['text', 'image', 'imageTail'],
      apiFormat: 'unified',
      params: klingCommonParams(['text', 'image', 'imageTail']),
    },
    {
      id: 'kling-v1-pro',
      platformId: 'kling',
      name: 'Kling v1 Pro',
      label: 'Kling v1 Pro',
      price: '按次计费',
      modes: ['text', 'image', 'imageTail'],
      apiFormat: 'unified',
      params: klingCommonParams(['text', 'image', 'imageTail']),
    },
    {
      id: 'kling-v1',
      platformId: 'kling',
      name: 'Kling v1',
      label: 'Kling v1 标准版',
      price: '按次计费',
      modes: ['text', 'image', 'imageTail'],
      apiFormat: 'unified',
      params: klingCommonParams(['text', 'image', 'imageTail']),
    },
  ],
};
