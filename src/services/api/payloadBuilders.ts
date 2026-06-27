import type { ApiFormatType, RuntimePlatform, VideoGenerationRequest } from '../../types';
import { getFirstImage, getImageList, isEnabled, isPresent } from './utils';

const MEDIA_PARAM_TYPES = new Set(['image', 'image-multi', 'video', 'video-multi', 'audio', 'audio-multi']);

const buildApiKeyMap = (platform: RuntimePlatform, modelId: string): Map<string, string> => {
  const model = platform.models.find(m => m.id === modelId);
  const keyMap = new Map<string, string>();
  if (model) {
    for (const param of model.params) {
      if (param.apiKey && !MEDIA_PARAM_TYPES.has(param.type)) keyMap.set(param.key, param.apiKey);
    }
  }
  return keyMap;
};

export const getApiFormat = (platform: RuntimePlatform, modelId: string): ApiFormatType => {
  const model = platform.models.find(m => m.id === modelId);
  return model?.apiFormat ?? platform.apiFormat ?? 'unified';
};

export const buildUnifiedRequest = (platform: RuntimePlatform, request: VideoGenerationRequest): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  const keyMap = buildApiKeyMap(platform, request.model);
  for (const [key, value] of Object.entries(request)) {
    if (!isPresent(value)) continue;
    const outKey = keyMap.get(key) ?? key;
    payload[outKey] = value;
  }
  return payload;
};

/** OpenAI 兼容格式（multipart/form-data）。 */
export const buildOpenAIRequest = (platform: RuntimePlatform, request: VideoGenerationRequest): FormData => {
  const form = new FormData();
  const append = (key: string, value: unknown) => {
    if (isPresent(value)) form.append(key, String(value));
  };

  append('prompt', request.prompt);
  append('model', request.model);

  if (request.image_tail) {
    const firstUrl = getFirstImage(request.image) ?? getFirstImage(request.images);
    append('images[]', firstUrl);
    append('images[]', request.image_tail);
  } else if (Array.isArray(request.images) && request.images.length > 0) {
    for (const url of getImageList(request.images)) append('images[]', url);
  } else if (Array.isArray(request.image) && request.image.length > 1) {
    for (const url of getImageList(request.image)) append('images[]', url);
  } else {
    append('input_reference', getFirstImage(request.image));
  }

  append('seconds', request.seconds ?? request.duration);

  if (request.size) {
    append('size', request.size);
  } else if (request.aspect_ratio) {
    const sizeMap: Record<string, string> = {
      '16:9': '1280x720',
      '9:16': '720x1280',
      '1:1': '720x720',
      '4:3': '960x720',
      '3:4': '720x960',
      '21:9': '1280x549',
      '9:21': '549x1280',
    };
    append('size', sizeMap[String(request.aspect_ratio)]);
  }

  append('watermark', request.watermark);
  append('enhance_prompt', request.enhance_prompt);
  append('enable_upsample', request.enable_upsample);

  const handled = new Set([
    'model', 'prompt', 'image', 'image_tail', 'images',
    'seconds', 'duration', 'size', 'aspect_ratio',
    'watermark', 'enhance_prompt', 'enable_upsample',
  ]);
  const keyMap = buildApiKeyMap(platform, request.model);
  for (const [key, value] of Object.entries(request)) {
    if (handled.has(key) || !isPresent(value)) continue;
    const outKey = keyMap.get(key) ?? key;
    append(outKey, value);
  }

  return form;
};

/** 将统一格式请求转换为 Seedance content[] 格式。 */
export const buildSeedanceRequest = (platform: RuntimePlatform, request: VideoGenerationRequest): Record<string, unknown> => {
  const content: Array<Record<string, unknown>> = [];

  if (request.prompt?.trim()) {
    content.push({ type: 'text', text: request.prompt.trim() });
  }

  if (request.image_tail) {
    const firstUrl = getFirstImage(request.image) ?? getFirstImage(request.images);
    if (firstUrl) content.push({ type: 'image_url', image_url: { url: firstUrl }, role: 'first_frame' });
    content.push({ type: 'image_url', image_url: { url: request.image_tail }, role: 'last_frame' });
  } else if (Array.isArray(request.images) && request.images.length > 0) {
    for (const imgUrl of getImageList(request.images)) {
      content.push({ type: 'image_url', image_url: { url: imgUrl }, role: 'reference_image' });
    }
  } else if (Array.isArray(request.image) && request.image.length > 1) {
    for (const imgUrl of getImageList(request.image)) {
      content.push({ type: 'image_url', image_url: { url: imgUrl }, role: 'reference_image' });
    }
  } else {
    const imgUrl = getFirstImage(request.image);
    if (imgUrl) content.push({ type: 'image_url', image_url: { url: imgUrl }, role: 'first_frame' });
  }

  for (const videoUrl of getImageList(request.video)) {
    content.push({ type: 'video_url', video_url: { url: videoUrl }, role: 'reference_video' });
  }

  for (const audioUrl of getImageList(request.audio)) {
    content.push({ type: 'audio_url', audio_url: { url: audioUrl }, role: 'reference_audio' });
  }

  const model = platform.models.find(m => m.id === request.model);
  const mediaParamKeys = model?.params
    .filter(param => param.type === 'image' || param.type === 'image-multi' || param.type === 'video' || param.type === 'video-multi' || param.type === 'audio' || param.type === 'audio-multi')
    .map(param => param.key) ?? [];

  const excludedKeys = new Set([
    'prompt', 'image', 'image_tail', 'images', 'video', 'audio',
    'async', 'seconds', 'size', 'n', 'stream', 'tools_web_search',
    ...mediaParamKeys,
  ]);

  const keyMap = buildApiKeyMap(platform, request.model);
  const payload: Record<string, unknown> = { content };
  for (const [key, value] of Object.entries(request)) {
    if (excludedKeys.has(key) || !isPresent(value)) continue;
    const outKey = keyMap.get(key) ?? key;
    if (outKey === 'duration') {
      const duration = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
      payload[outKey] = Number.isFinite(duration) ? duration : value;
      continue;
    }
    payload[outKey] = value;
  }
  if (isEnabled(request.tools_web_search)) {
    payload.tools = [{ type: 'web_search' }];
  }
  return payload;
};

export const buildRequestPayload = (platform: RuntimePlatform, request: VideoGenerationRequest): Record<string, unknown> | FormData => {
  const format = getApiFormat(platform, request.model);
  if (format === 'seedance') return buildSeedanceRequest(platform, request);
  if (format === 'openai') return buildOpenAIRequest(platform, request);
  return buildUnifiedRequest(platform, request);
};
