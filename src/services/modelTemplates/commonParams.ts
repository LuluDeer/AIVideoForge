import type { GenerationMode, ParamDef } from '../../types';

export const aspectRatioParam = (options: string[], defaultValue = '16:9'): ParamDef => ({
  key: 'aspect_ratio',
  label: '宽高比',
  type: 'string',
  defaultValue,
  options: options.map(v => ({ label: v, value: v })),
});

export const resolutionParam = (options: string[], defaultValue = '1080p'): ParamDef => ({
  key: 'resolution',
  label: '分辨率',
  type: 'string',
  defaultValue,
  options: options.map(v => ({ label: v, value: v })),
});

export const durationParam = (values: (number | string)[], defaultValue: number | string): ParamDef => ({
  key: 'duration',
  label: '时长(秒)',
  type: 'number',
  defaultValue,
  options: values.map(v => ({ label: String(v), value: v })),
});

export const watermarkParam = (fixed = false): ParamDef => ({
  key: 'watermark',
  label: '水印',
  type: 'boolean',
  hidden: true,
  fixedValue: fixed,
});

export const asyncParam: ParamDef = {
  key: 'async',
  label: '异步',
  type: 'boolean',
  hidden: true,
  fixedValue: true,
};

export const enhancePromptParam = (defaultValue = true): ParamDef => ({
  key: 'enhance_prompt',
  label: '提示词增强',
  type: 'boolean',
  defaultValue,
});

export const generateAudioParam = (defaultValue = true): ParamDef => ({
  key: 'generate_audio',
  label: '生成音频',
  type: 'boolean',
  defaultValue,
});

export const enableUpsampleParam = (defaultValue = false): ParamDef => ({
  key: 'enable_upsample',
  label: '超分辨率',
  type: 'boolean',
  defaultValue,
});

export const imageParam = (modes: ParamDef['modes']): ParamDef => ({
  key: 'image',
  label: '首帧图',
  type: 'image',
  modes,
});

export const imageTailParam: ParamDef = {
  key: 'image_tail',
  label: '尾帧图',
  type: 'image',
  modes: ['imageTail'],
};

export const imagesParam = (limits?: { min?: number; max?: number }): ParamDef => ({
  key: 'images',
  label: '参考图片',
  type: 'image-multi',
  modes: ['multiImage'],
  imageLimits: limits,
});

export const videoParam = (modes: ParamDef['modes']): ParamDef => ({
  key: 'video',
  label: '参考视频',
  type: 'video',
  modes,
});

export const audioParam = (modes: ParamDef['modes']): ParamDef => ({
  key: 'audio',
  label: '参考音频',
  type: 'audio',
  modes,
});

export const videosParam = (limits?: { min?: number; max?: number }): ParamDef => ({ 
  key: 'video',
  label: '参考视频',
  type: 'video-multi',
  modes: ['multiModal'],
  imageLimits: limits,
});

export const audiosParam = (limits?: { min?: number; max?: number }): ParamDef => ({
  key: 'audio',
  label: '参考音频',
  type: 'audio-multi',
  modes: ['multiModal'],
  imageLimits: limits,
});

/** Veo 通用参数（geekai/apizzz unified/openai 格式，支持 enhance/upsample） */
export const veoParamsWithEnhance = (
  ar: string[],
  res: string[],
  durations: number[],
  defaultDur: number,
  imageMax = 4,
): ParamDef[] => [
  imageParam(['image', 'imageTail']),
  imageTailParam,
  { ...imagesParam({ min: 1, max: imageMax }), key: 'image' },
  aspectRatioParam(ar),
  resolutionParam(res),
  durationParam(durations, defaultDur),
  enhancePromptParam(true),
  enableUpsampleParam(false),
  watermarkParam(false),
  asyncParam,
];

/** 根据生成模式构建默认参数列表（供自定义模型使用） */
export function buildDefaultParams(modes: GenerationMode[]): ParamDef[] {
  const params: ParamDef[] = [];
  if (modes.includes('image') || modes.includes('imageTail')) {
    params.push(imageParam(modes.filter(m => m === 'image' || m === 'imageTail')));
  }
  if (modes.includes('imageTail')) {
    params.push(imageTailParam);
  }
  if (modes.includes('multiImage')) {
    params.push(imagesParam({ min: 1, max: 9 }));
  }
  if (modes.includes('multiModal')) {
    params.push(
      { ...imagesParam({ min: 0, max: 9 }), modes: ['multiModal'] },
      videosParam({ min: 0, max: 3 }),
      audiosParam({ min: 0, max: 3 }),
    );
  }
  params.push(
    aspectRatioParam(['16:9', '9:16', '1:1'], '16:9'),
    durationParam([4, 5, 6, 7, 8], 5),
    watermarkParam(false),
    asyncParam,
  );
  return params;
}
