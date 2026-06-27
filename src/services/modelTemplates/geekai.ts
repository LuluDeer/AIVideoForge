import type { ParamDef, PlatformDef } from '../../types';
import {
  aspectRatioParam,
  asyncParam,
  durationParam,
  imageParam,
  imageTailParam,
  imagesParam,
  audiosParam,
  videosParam,
  resolutionParam,
  veoParamsWithEnhance,
  watermarkParam,
} from './commonParams';

const seedParam: ParamDef = {
  key: 'seed',
  label: '随机种子',
  type: 'number',
  defaultValue: -1,
  hidden: true,
};

const cameraFixedParam: ParamDef = {
  key: 'camerafixed',
  label: '固定镜头',
  type: 'boolean',
  defaultValue: false,
};

const fpsParam = (options: number[], defaultValue: number): ParamDef => ({
  key: 'fps',
  label: '帧率',
  type: 'number',
  defaultValue,
  options: options.map(value => ({ label: String(value), value })),
});

const withAudioParam = (defaultValue = false): ParamDef => ({
  key: 'with_audio',
  label: '生成音效',
  type: 'boolean',
  defaultValue,
});

const qualityParam = (options: string[], defaultValue: string): ParamDef => ({
  key: 'quality',
  label: '质量模式',
  type: 'string',
  defaultValue,
  options: options.map(value => ({ label: value, value })),
});

const negativePromptParam: ParamDef = {
  key: 'negative_prompt',
  label: '反向提示词',
  type: 'string',
};

const promptExtendParam = (defaultValue = true): ParamDef => ({
  key: 'prompt_extend',
  label: '智能改写',
  type: 'boolean',
  defaultValue,
});

const sizeParam = (options: string[], defaultValue?: string): ParamDef => ({
  key: 'size',
  label: '视频尺寸',
  type: 'string',
  defaultValue,
  options: options.map(value => ({ label: value, value })),
});

// GeekAI 文档确认：Vidu Q2 系列不支持 size/quality/fps，支持 aspect_ratio、resolution、duration、with_audio。
const viduQ2AspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
const viduQ2Durations = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const viduQ2BaseParams: ParamDef[] = [
  aspectRatioParam(viduQ2AspectRatios, '16:9'),
  resolutionParam(['540p', '720p', '1080p'], '720p'),
  durationParam(viduQ2Durations, 5),
  withAudioParam(false),
  asyncParam,
];
const viduQ2SingleImageParam: ParamDef = {
  key: 'images',
  label: '首帧图',
  type: 'image',
  modes: ['image'],
};
const viduQ2ImageTailFirstFrameParam: ParamDef = {
  key: 'image',
  label: '首帧图',
  type: 'image',
  modes: ['imageTail'],
};
const viduQ2ReferenceParam: ParamDef = {
  ...imagesParam({ min: 1, max: 3 }),
  key: 'image',
};
const viduQ2TextAndReferenceParams: ParamDef[] = [viduQ2ReferenceParam, ...viduQ2BaseParams];
const viduQ2TurboParams: ParamDef[] = [
  viduQ2SingleImageParam,
  viduQ2ImageTailFirstFrameParam,
  imageTailParam,
  ...viduQ2BaseParams,
];
const viduQ2ProParams: ParamDef[] = [
  viduQ2SingleImageParam,
  viduQ2ImageTailFirstFrameParam,
  imageTailParam,
  viduQ2ReferenceParam,
  ...viduQ2BaseParams,
];

const wanx21Sizes480p = ['624x624', '480x832', '832x480'];
const wanx21Sizes720p = ['960x960', '1088x832', '832x1088', '1280x720', '720x1280'];
const wanx21T2vPlusParams: ParamDef[] = [
  negativePromptParam,
  sizeParam(wanx21Sizes720p, '1280x720'),
  watermarkParam(false),
  asyncParam,
];
const wanx21T2vTurboParams: ParamDef[] = [
  negativePromptParam,
  sizeParam([...wanx21Sizes480p, ...wanx21Sizes720p], '1280x720'),
  watermarkParam(false),
  asyncParam,
];
const wanx21I2vPlusParams: ParamDef[] = [
  imageParam(['image']),
  resolutionParam(['720P'], '720P'),
  watermarkParam(false),
  asyncParam,
];
const wanx21I2vTurboParams: ParamDef[] = [
  imageParam(['image']),
  resolutionParam(['480P', '720P'], '720P'),
  durationParam([3, 4, 5], 5),
  watermarkParam(false),
  asyncParam,
];
const wanx21Kf2vPlusParams: ParamDef[] = [
  imageParam(['imageTail']),
  imageTailParam,
  resolutionParam(['720P'], '720P'),
  watermarkParam(false),
  asyncParam,
];

const kling25TurboParams: ParamDef[] = [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  { ...aspectRatioParam(['1:1', '16:9', '9:16'], '16:9'), modes: ['text'] },
  qualityParam(['std', 'pro'], 'std'),
  durationParam([5, 10], 5),
  watermarkParam(false),
  asyncParam,
];

const minimaxHailuo02Params: ParamDef[] = [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  resolutionParam(['512P', '768P', '1080P'], '768P'),
  durationParam([6, 10], 6),
  asyncParam,
];

const happyHorseAspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '4:5', '5:4', '9:21', '21:9'];
const happyHorseDurations = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const videoUrlParam: ParamDef = {
  key: 'video',
  label: '输入视频 URL',
  type: 'string',
  required: true,
};

const happyHorseBaseParams = (withRatio: boolean, defaultResolution: string): ParamDef[] => [
  ...(withRatio ? [aspectRatioParam(happyHorseAspectRatios, '16:9')] : []),
  // HappyHorse 官方文档要求 resolution 使用大写 P。
  resolutionParam(['720P', '1080P'], defaultResolution),
  durationParam(happyHorseDurations, 5),
  watermarkParam(false),
  seedParam,
  asyncParam,
];

const happyHorse10T2vParams: ParamDef[] = [
  ...happyHorseBaseParams(true, '1080P'),
];

const happyHorse10I2vParams: ParamDef[] = [
  imageParam(['image']),
  ...happyHorseBaseParams(false, '1080P'),
];

const happyHorse10R2vParams: ParamDef[] = [
  imagesParam({ min: 1, max: 9 }),
  ...happyHorseBaseParams(true, '1080P'),
];

const happyHorse10VideoEditParams: ParamDef[] = [
  videoUrlParam,
  imagesParam({ min: 0, max: 5 }),
  ...happyHorseBaseParams(true, '1080P'),
];

const happyHorse11BaseParams: ParamDef[] = [
  aspectRatioParam(happyHorseAspectRatios, '16:9'),
  // HappyHorse 1.1 文档要求 resolution 使用大写 P。
  resolutionParam(['720P', '1080P'], '1080P'),
  durationParam(happyHorseDurations, 5),
  watermarkParam(false),
  asyncParam,
];

const happyHorse11T2vParams: ParamDef[] = [
  ...happyHorse11BaseParams,
];

const happyHorse11I2vParams: ParamDef[] = [
  imageParam(['image']),
  ...happyHorse11BaseParams,
];

const happyHorse11R2vParams: ParamDef[] = [
  imagesParam({ min: 1, max: 9 }),
  ...happyHorse11BaseParams,
];

const seedanceAspectRatios = ['16:9', '9:16', '3:4', '4:3', '1:1', '21:9', 'adaptive'];
const seedance2Durations = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const geekaiSeedanceParams = (resolutions: string[], defaultResolution: string): ParamDef[] => [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  imagesParam({ min: 1, max: 9 }),
  aspectRatioParam(seedanceAspectRatios, 'adaptive'),
  resolutionParam(resolutions, defaultResolution),
  durationParam(seedance2Durations, 5),
  withAudioParam(true),
  seedParam,
  watermarkParam(false),
  asyncParam,
];

const realPersonModeParam: ParamDef = {
  key: 'real_person_mode',
  apiKey: 'extra_body.real_person_mode',
  label: '真人模式',
  type: 'boolean',
  modes: ['image', 'imageTail', 'multiImage', 'multiModal'],
  defaultValue: false,
};

const geekaiSeedance20Params = (resolutions: string[], defaultResolution: string): ParamDef[] => [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  imagesParam({ min: 1, max: 9 }),
  { ...imagesParam({ min: 0, max: 9 }), modes: ['multiModal'] },
  videosParam({ min: 0, max: 3 }),
  audiosParam({ min: 0, max: 3 }),
  aspectRatioParam(seedanceAspectRatios, 'adaptive'),
  resolutionParam(resolutions, defaultResolution),
  durationParam(seedance2Durations, 5),
  withAudioParam(true),
  realPersonModeParam,
  seedParam,
  watermarkParam(false),
  asyncParam,
];

const seedance15Params: ParamDef[] = [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  aspectRatioParam(['1:1', '3:4', '4:3', '16:9', '9:16', '21:9', 'adaptive'], 'adaptive'),
  resolutionParam(['480p', '720p', '1080p'], '720p'),
  durationParam([4, 5, 6, 7, 8, 9, 10, 11, 12], 5),
  withAudioParam(true),
  cameraFixedParam,
  seedParam,
  watermarkParam(false),
  asyncParam,
];

const seedance10ProParams: ParamDef[] = [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  aspectRatioParam(['1:1', '3:4', '4:3', '16:9', '9:16', '21:9', 'keep_ratio', 'adaptive'], 'adaptive'),
  resolutionParam(['480p', '720p', '1080p'], '1080p'),
  durationParam([3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 5),
  fpsParam([16, 24], 24),
  cameraFixedParam,
  seedParam,
  watermarkParam(false),
  asyncParam,
];

const seedance10FastParams: ParamDef[] = [
  imageParam(['image']),
  aspectRatioParam(['1:1', '3:4', '4:3', '16:9', '9:16', '21:9', 'keep_ratio', 'adaptive'], 'adaptive'),
  resolutionParam(['480p', '720p', '1080p'], '1080p'),
  durationParam([3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 5),
  fpsParam([16, 24], 24),
  cameraFixedParam,
  seedParam,
  watermarkParam(false),
  asyncParam,
];

const wan27AspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '4:5', '5:4', '21:9', '9:21'];
const wan27Durations = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const wan27T2vParams: ParamDef[] = [
  aspectRatioParam(wan27AspectRatios, '16:9'),
  resolutionParam(['720P', '1080P'], '1080P'),
  durationParam(wan27Durations, 5),
  promptExtendParam(true),
  watermarkParam(false),
  asyncParam,
];

const wan27I2vParams: ParamDef[] = [
  imageParam(['image']),
  aspectRatioParam(wan27AspectRatios, '16:9'),
  resolutionParam(['720P', '1080P'], '1080P'),
  durationParam(wan27Durations, 5),
  watermarkParam(false),
  asyncParam,
];

const wan27R2vParams: ParamDef[] = [
  imagesParam({ min: 1, max: 9 }),
  aspectRatioParam(wan27AspectRatios, '16:9'),
  resolutionParam(['720P', '1080P'], '1080P'),
  durationParam(wan27Durations, 5),
  promptExtendParam(true),
  watermarkParam(false),
  asyncParam,
];

const superVideoParams: ParamDef[] = [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  imagesParam({ min: 1, max: 4 }),
  aspectRatioParam(['16:9', '9:16', '1:1', '4:3', '3:4'], '16:9'),
  resolutionParam(['720p', '1080p'], '1080p'),
  durationParam([5, 6, 7, 8, 9, 10], 5),
  qualityParam(['std', 'pro'], 'std'),
  watermarkParam(false),
  asyncParam,
];

export const geekaiPlatformDef: PlatformDef = {
  id: 'geekai',
  name: '极客智坊',
  defaultBaseUrl: 'https://geekai.co/api',
  defaultEndpoints: {
    createVideo: '/v1/videos/generations',
    queryTask: '/v1/videos/{id}',
  },
  defaultModel: 'veo-3.1-fast-generate-preview',
  models: [
    {
      id: 'veo-3.1-fast-generate-preview',
      platformId: 'geekai',
      name: 'Veo 3.1 Fast Preview',
      label: 'Veo 3.1 Fast Preview (推荐)',
      price: '￥0.075/秒',
      modes: ['text', 'image', 'imageTail', 'multiImage'],
      apiFormat: 'unified',
      params: veoParamsWithEnhance(['16:9', '9:16'], ['720p', '1080p', '4k'], [4, 6, 8], 4, 3),
    },
    {
      id: 'veo-3.1-lite-generate-preview',
      platformId: 'geekai',
      name: 'Veo 3.1 Lite Preview',
      label: 'Veo 3.1 Lite Preview (轻量)',
      price: '￥0.375/秒',
      modes: ['text', 'image', 'imageTail', 'multiImage'],
      apiFormat: 'unified',
      params: veoParamsWithEnhance(['16:9', '9:16'], ['720p', '1080p'], [4, 6, 8], 4, 3),
    },
    {
      id: 'veo-3.1-generate-preview',
      platformId: 'geekai',
      name: 'Veo 3.1 Preview',
      label: 'Veo 3.1 Preview',
      price: '￥0.300/秒',
      modes: ['text', 'image', 'imageTail', 'multiImage'],
      apiFormat: 'unified',
      params: veoParamsWithEnhance(['16:9', '9:16'], ['720p', '1080p', '4k'], [4, 6, 8], 4, 3),
    },
    {
      id: 'veo-3.0-fast-generate-001',
      platformId: 'geekai',
      name: 'Veo 3 快速版',
      label: 'Veo 3 快速版',
      price: '￥0.113/秒',
      modes: ['text', 'image', 'imageTail', 'multiImage'],
      apiFormat: 'unified',
      params: veoParamsWithEnhance(['16:9', '9:16'], ['720p', '1080p'], [4, 6, 8], 4, 3),
    },
    {
      id: 'veo-3.0-generate-001',
      platformId: 'geekai',
      name: 'Veo 3',
      label: 'Veo 3',
      price: '￥0.300/秒',
      modes: ['text', 'image', 'imageTail', 'multiImage'],
      apiFormat: 'unified',
      params: veoParamsWithEnhance(['16:9', '9:16'], ['720p', '1080p'], [4, 6, 8], 4, 3),
    },
    {
      id: 'veo-2.0-generate-001',
      platformId: 'geekai',
      name: 'Veo 2',
      label: 'Veo 2',
      price: '￥0.131/秒',
      modes: ['text', 'image', 'imageTail', 'multiImage'],
      apiFormat: 'unified',
      params: veoParamsWithEnhance(['16:9', '9:16'], ['720p', '1080p', '4k'], [4, 6, 8], 4, 3),
    },

    // GeekAI 文档确认：Vidu Q2 系列
    {
      id: 'viduq2',
      platformId: 'geekai',
      name: 'Vidu Q2',
      label: 'Vidu Q2',
      price: '￥0.125/秒起（高可用Pro8折）',
      modes: ['text', 'multiImage'],
      apiFormat: 'unified',
      params: viduQ2TextAndReferenceParams,
    },
    {
      id: 'viduq2-turbo',
      platformId: 'geekai',
      name: 'Vidu Q2 Turbo',
      label: 'Vidu Q2 Turbo',
      price: '￥0.250/秒起（高可用Pro8折）',
      modes: ['image', 'imageTail'],
      apiFormat: 'unified',
      params: viduQ2TurboParams,
    },
    {
      id: 'viduq2-pro',
      platformId: 'geekai',
      name: 'Vidu Q2 Pro',
      label: 'Vidu Q2 Pro',
      price: '￥0.250/秒起（高可用Pro8折）',
      modes: ['image', 'imageTail', 'multiImage'],
      apiFormat: 'unified',
      params: viduQ2ProParams,
    },

    // GeekAI 文档确认：通义万相 2.1
    {
      id: 'wanx2.1-t2v-plus',
      platformId: 'geekai',
      name: '通义万相 2.1 文生视频 Plus',
      label: '通义万相 2.1 文生视频 Plus',
      price: '按尺寸/模型计费',
      modes: ['text'],
      apiFormat: 'unified',
      params: wanx21T2vPlusParams,
    },
    {
      id: 'wanx2.1-t2v-turbo',
      platformId: 'geekai',
      name: '通义万相 2.1 文生视频 Turbo',
      label: '通义万相 2.1 文生视频 Turbo',
      price: '按尺寸/模型计费',
      modes: ['text'],
      apiFormat: 'unified',
      params: wanx21T2vTurboParams,
    },
    {
      id: 'wanx2.1-i2v-plus',
      platformId: 'geekai',
      name: '通义万相 2.1 图生视频 Plus',
      label: '通义万相 2.1 图生视频 Plus',
      price: '￥3.500/个',
      modes: ['image'],
      apiFormat: 'unified',
      params: wanx21I2vPlusParams,
    },
    {
      id: 'wanx2.1-i2v-turbo',
      platformId: 'geekai',
      name: '通义万相 2.1 图生视频 Turbo',
      label: '通义万相 2.1 图生视频 Turbo',
      price: '￥1.200/个',
      modes: ['image'],
      apiFormat: 'unified',
      params: wanx21I2vTurboParams,
    },
    {
      id: 'wanx2.1-kf2v-plus',
      platformId: 'geekai',
      name: '通义万相 2.1 首尾帧 Plus',
      label: '通义万相 2.1 首尾帧 Plus',
      price: '￥3.500/个',
      modes: ['imageTail'],
      apiFormat: 'unified',
      params: wanx21Kf2vPlusParams,
    },

    // GeekAI 文档确认：可灵 / MiniMax
    {
      id: 'kling-video-v2-5-turbo',
      platformId: 'geekai',
      name: '可灵视频 v2.5 Turbo',
      label: '可灵视频 v2.5 Turbo',
      price: '按质量/时长计费',
      modes: ['text', 'image', 'imageTail'],
      apiFormat: 'unified',
      params: kling25TurboParams,
    },
    {
      id: 'MiniMax-Hailuo-02',
      platformId: 'geekai',
      name: 'MiniMax Hailuo 02',
      label: 'MiniMax Hailuo 02',
      price: '512P ￥0.6/个起，768P ￥2/个起，1080P ￥3.5/个',
      modes: ['text', 'image', 'imageTail'],
      apiFormat: 'unified',
      params: minimaxHailuo02Params,
    },

    // 极客智坊模型广场/文档确认的视频模型：HappyHorse 1.0
    {
      id: 'happyhorse-1.0-t2v',
      platformId: 'geekai',
      name: 'HappyHorse 1.0 文生视频',
      label: 'HappyHorse 1.0 文生视频',
      price: '720P ￥0.720/秒，1080P ￥1.280/秒（高可用Pro8折）',
      modes: ['text'],
      apiFormat: 'unified',
      params: happyHorse10T2vParams,
    },
    {
      id: 'happyhorse-1.0-i2v',
      platformId: 'geekai',
      name: 'HappyHorse 1.0 图生视频',
      label: 'HappyHorse 1.0 图生视频',
      price: '720P ￥0.720/秒，1080P ￥1.280/秒（高可用Pro8折）',
      modes: ['image'],
      apiFormat: 'unified',
      params: happyHorse10I2vParams,
    },
    {
      id: 'happyhorse-1.0-r2v',
      platformId: 'geekai',
      name: 'HappyHorse 1.0 参考生视频',
      label: 'HappyHorse 1.0 参考生视频',
      price: '720P ￥0.720/秒，1080P ￥1.280/秒（高可用Pro8折）',
      modes: ['multiImage'],
      apiFormat: 'unified',
      params: happyHorse10R2vParams,
    },
    {
      id: 'happyhorse-1.0-video-edit',
      platformId: 'geekai',
      name: 'HappyHorse 1.0 视频编辑',
      label: 'HappyHorse 1.0 视频编辑',
      price: '720P ￥0.720/秒，1080P ￥1.280/秒（高可用Pro8折，输入/输出视频时长均计费）',
      modes: ['multiImage'],
      apiFormat: 'unified',
      params: happyHorse10VideoEditParams,
    },

    // 极客智坊模型广场新增热门视频模型：HappyHorse 1.1
    {
      id: 'happyhorse-1.1-t2v',
      platformId: 'geekai',
      name: 'HappyHorse 1.1 文生视频',
      label: 'HappyHorse 1.1 文生视频',
      price: '720P ￥0.720/秒，1080P ￥0.960/秒（高可用Pro8折）',
      modes: ['text'],
      apiFormat: 'unified',
      params: happyHorse11T2vParams,
    },
    {
      id: 'happyhorse-1.1-i2v',
      platformId: 'geekai',
      name: 'HappyHorse 1.1 图生视频',
      label: 'HappyHorse 1.1 图生视频',
      price: '720P ￥0.720/秒，1080P ￥0.960/秒（高可用Pro8折）',
      modes: ['image'],
      apiFormat: 'unified',
      params: happyHorse11I2vParams,
    },
    {
      id: 'happyhorse-1.1-r2v',
      platformId: 'geekai',
      name: 'HappyHorse 1.1 参考生视频',
      label: 'HappyHorse 1.1 参考生视频',
      price: '720P ￥0.720/秒，1080P ￥0.960/秒（高可用Pro8折）',
      modes: ['multiImage'],
      apiFormat: 'unified',
      params: happyHorse11R2vParams,
    },

    // 极客智坊统一视频 API 下的豆包/即梦 Seedance 模型 ID
    {
      id: 'doubao-seedance-2.0',
      platformId: 'geekai',
      name: 'Doubao Seedance 2.0',
      label: 'Doubao Seedance 2.0',
      price: '￥0.500/秒',
      modes: ['text', 'image', 'imageTail', 'multiImage', 'multiModal'],
      apiFormat: 'unified',
      params: geekaiSeedance20Params(['720p', '1080p'], '720p'),
    },
    {
      id: 'doubao-seedance-2.0-fast',
      platformId: 'geekai',
      name: 'Doubao Seedance 2.0 Fast',
      label: 'Doubao Seedance 2.0 Fast',
      price: '￥0.400/秒',
      modes: ['text', 'image', 'imageTail', 'multiImage', 'multiModal'],
      apiFormat: 'unified',
      params: geekaiSeedance20Params(['720p', '1080p'], '720p'),
    },
    {
      id: 'doubao-seedance-2.0-mini',
      platformId: 'geekai',
      name: 'Doubao Seedance 2.0 Mini',
      label: 'Doubao Seedance 2.0 Mini',
      price: '￥0.250/秒',
      modes: ['text', 'image', 'imageTail', 'multiImage'],
      apiFormat: 'unified',
      params: geekaiSeedanceParams(['480p', '720p'], '720p'),
    },
    {
      id: 'doubao-seedance-1.5-pro',
      platformId: 'geekai',
      name: 'Doubao Seedance 1.5 Pro',
      label: 'Doubao Seedance 1.5 Pro',
      price: '按分辨率/时长/音频计费',
      modes: ['text', 'image', 'imageTail'],
      apiFormat: 'unified',
      params: seedance15Params,
    },
    {
      id: 'doubao-seedance-1.0-pro',
      platformId: 'geekai',
      name: 'Doubao Seedance 1.0 Pro',
      label: 'Doubao Seedance 1.0 Pro',
      price: '按分辨率/时长计费',
      modes: ['text', 'image', 'imageTail'],
      apiFormat: 'unified',
      params: seedance10ProParams,
    },
    {
      id: 'doubao-seedance-1.0-pro-fast',
      platformId: 'geekai',
      name: 'Doubao Seedance 1.0 Pro Fast',
      label: 'Doubao Seedance 1.0 Pro Fast',
      price: '按分辨率/时长计费',
      modes: ['text', 'image'],
      apiFormat: 'unified',
      params: seedance10FastParams,
    },

    // 模型广场第一页的通义万相 2.7 / Super-Video 2.0 热门项
    {
      id: 'wan2.7-t2v',
      platformId: 'geekai',
      name: '通义万相 2.7 文生视频',
      label: '通义万相 2.7 文生视频',
      price: '￥0.800/秒（高可用Pro8折）',
      modes: ['text'],
      apiFormat: 'unified',
      params: wan27T2vParams,
    },
    {
      id: 'wan2.7-i2v',
      platformId: 'geekai',
      name: '通义万相 2.7 图生视频',
      label: '通义万相 2.7 图生视频',
      price: '￥0.800/秒（高可用Pro8折）',
      modes: ['image'],
      apiFormat: 'unified',
      params: wan27I2vParams,
    },
    {
      id: 'wan2.7-r2v',
      platformId: 'geekai',
      name: '通义万相 2.7 参考生视频',
      label: '通义万相 2.7 参考生视频',
      price: '￥0.800/秒（高可用Pro8折）',
      modes: ['multiImage'],
      apiFormat: 'unified',
      params: wan27R2vParams,
    },
    {
      id: 'super-video-2.0-fast',
      platformId: 'geekai',
      name: 'Super-Video 2.0 Fast',
      label: 'Super-Video 2.0 Fast',
      price: '￥0.600/秒',
      modes: ['text', 'image', 'imageTail', 'multiImage'],
      apiFormat: 'unified',
      params: superVideoParams,
    },
    {
      id: 'super-video-2.0',
      platformId: 'geekai',
      name: 'Super-Video 2.0 Pro',
      label: 'Super-Video 2.0 Pro',
      price: '￥0.720/秒',
      modes: ['text', 'image', 'imageTail', 'multiImage'],
      apiFormat: 'unified',
      params: superVideoParams,
    },
    {
      id: 'super-video-2.0-omni',
      platformId: 'geekai',
      name: 'Super-Video 2.0 Omni',
      label: 'Super-Video 2.0 Omni',
      price: '￥0.720/秒',
      modes: ['text', 'image', 'imageTail', 'multiImage'],
      apiFormat: 'unified',
      params: superVideoParams,
    },
  ],
};
