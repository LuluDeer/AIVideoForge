import type { GenerationMode, ModelDef, ParamDef, RuntimePlatform } from '../../types';
import { containsLocalOnlyImageValue } from '../../context/taskUtils';

type ParamItem = { def: ParamDef };

interface ValidateGenerationInputArgs {
  activePlatform?: RuntimePlatform | null;
  selectedModelId: string;
  selectedModel?: ModelDef | null;
  supportedModels: ModelDef[];
  mode: GenerationMode;
  validPrompts: string[];
  generationCount: number;
  imageParams: ParamItem[];
  mediaParams?: ParamItem[];
  paramValues: Record<string, unknown>;
}

const hasImageValue = (value: unknown): boolean => {
  if (containsLocalOnlyImageValue(value)) return false;
  if (Array.isArray(value)) return value.filter(item => item && !containsLocalOnlyImageValue(item)).length > 0;
  return typeof value === 'string' ? value.trim().length > 0 : !!value;
};

const getImageArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0 && !containsLocalOnlyImageValue(item));
  if (typeof value === 'string' && value.trim() && !containsLocalOnlyImageValue(value)) return [value.trim()];
  return [];
};

const getImageParam = (imageParams: ParamItem[], key: string) => imageParams.find(({ def }) => def.key === key);

const getMediaArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0 && !containsLocalOnlyImageValue(item));
  if (typeof value === 'string' && value.trim() && !containsLocalOnlyImageValue(value)) return [value.trim()];
  return [];
};

export function validateGenerationInput(args: ValidateGenerationInputArgs): string | null {
  const {
    activePlatform,
    selectedModelId,
    selectedModel,
    supportedModels,
    mode,
    validPrompts,
    generationCount,
    imageParams,
    mediaParams = imageParams,
    paramValues,
  } = args;

  if (!activePlatform?.apiKey) return '请先在配置页填写当前平台的 API Key';
  if (validPrompts.length === 0) return '请输入至少一个 Prompt';
  if (!selectedModelId.trim()) return '请选择模型';
  if (generationCount < 1) return '每个 Prompt 生成数量至少为 1';
  if (generationCount > 4) return '每个 Prompt 生成数量不能超过 4';

  if (supportedModels.length > 0) {
    const matchedModel = supportedModels.find(model => model.id === selectedModelId);
    if (!matchedModel) return '当前模型不支持所选生成模式，请重新选择模型';
  }
  if (selectedModel && !selectedModel.modes.includes(mode)) {
    return '当前模型不支持所选生成模式，请重新选择模型';
  }

  if (mode === 'image') {
    const imageParam = getImageParam(imageParams, 'image') ?? imageParams.find(({ def }) => def.type === 'image');
    if (imageParam && !hasImageValue(paramValues[imageParam.def.key])) return '图生视频模式需要上传或粘贴一张图片';
  }

  if (mode === 'imageTail') {
    const headParam = getImageParam(imageParams, 'image');
    const tailParam = getImageParam(imageParams, 'image_tail');
    if (headParam && !hasImageValue(paramValues[headParam.def.key])) return '首尾帧模式需要上传首帧图';
    if (tailParam && !hasImageValue(paramValues[tailParam.def.key])) return '首尾帧模式需要上传尾帧图';
  }

  if (mode === 'multiImage') {
    const multiParam = imageParams.find(({ def }) => def.type === 'image-multi') ?? getImageParam(imageParams, 'images') ?? getImageParam(imageParams, 'image');
    if (multiParam) {
      const images = getImageArray(paramValues[multiParam.def.key]);
      const min = multiParam.def.imageLimits?.min ?? 2;
      const max = multiParam.def.imageLimits?.max;
      if (images.length < min) return `多图生成模式至少需要 ${min} 张图片`;
      if (max && images.length > max) return `多图生成模式最多支持 ${max} 张图片`;
    }
  }

  if (mode === 'multiModal') {
    const imageCount = mediaParams
      .filter(({ def }) => def.type === 'image' || def.type === 'image-multi')
      .reduce((total, { def }) => total + getMediaArray(paramValues[def.key]).length, 0);
    const videoCount = mediaParams
      .filter(({ def }) => def.type === 'video' || def.type === 'video-multi')
      .reduce((total, { def }) => total + getMediaArray(paramValues[def.key]).length, 0);
    const audioCount = mediaParams
      .filter(({ def }) => def.type === 'audio' || def.type === 'audio-multi')
      .reduce((total, { def }) => total + getMediaArray(paramValues[def.key]).length, 0);

    if (imageCount + videoCount + audioCount === 0) return '多模态参考模式至少需要上传或粘贴图片、视频、音频中的一种参考素材';
    if (audioCount > 0 && imageCount + videoCount === 0) return '多模态参考不能只传音频，请至少再添加一张图片或一个视频';
  }

  for (const { def } of mediaParams) {
    if (def.type !== 'image-multi' && def.type !== 'video-multi' && def.type !== 'audio-multi') continue;
    const values = getMediaArray(paramValues[def.key]);
    const max = def.imageLimits?.max;
    if (max && values.length > max) return `${def.label}最多支持 ${max} 个`;
  }

  return null;
}
