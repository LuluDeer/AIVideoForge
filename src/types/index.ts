export type ApiFormatType = 'unified' | 'openai';

export interface PresetOption {
  label: string;
  value: string | number;
}

export interface ParameterConstraint {
  unifiedParam: string;
  modes?: GenerationMode[];
  enabled?: boolean;
  hidden?: boolean;
  fixed?: any;
  enumValues?: any[];
  presetOptions?: PresetOption[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: any;
  useModelDefaults?: boolean;
}

export interface VersionHistory {
  version: number;
  syncedAt: number;
  description?: string;
  paramsSnapshot?: string[];
  restoredFromVersion?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  label: string;
  supportedModes: GenerationMode[];
  supportedApiFormats: ApiFormatType[];
  resolution?: string;
  parameterConstraints?: ParameterConstraint[];
  modelConfigId?: string;
  price?: string;
  modelConfigVersion?: number;
  autoSyncConfig?: boolean;
  versionHistory?: VersionHistory[];
}

export interface ApiEndpoints {
  createVideo: string;
  queryTask: string;
  downloadVideo?: string;
}

export interface PlatformConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: ModelInfo[];
  defaultModel: string;
  apiFormat: 'unified' | 'openai';
  endpoints: ApiEndpoints;
  enableEnhancePrompt?: boolean;
  enableUpsample?: boolean;
  enableWatermark?: boolean;
}

export interface Config {
  downloadPath: string;
  autoDownload: boolean;
  platforms: PlatformConfig[];
  activePlatformId: string;
  uploadCk: string;
}

export interface VideoGenerationRequest {
  model: string;
  prompt: string;
  image?: string | string[];
  image_tail?: string;
  async: boolean;
  aspect_ratio?: string;
  resolution?: string;
  duration?: number;
  n?: number;
  stream?: boolean;
  
  enhance_prompt?: boolean;
  enable_upsample?: boolean | string;
  images?: string[];
  seconds?: string | number;
  size?: string;
  watermark?: boolean | string;
}

export interface VideoGenerationResponse {
  task_id: string;
  task_status: 'pending' | 'running' | 'succeed' | 'failed';
  model: string;
  video_result?: Array<{ url: string }>;
  enhanced_prompt?: string;
}

export interface TaskQueryResponse {
  model: string;
  task_id: string;
  task_status: 'pending' | 'running' | 'succeed' | 'failed';
  video_result?: Array<{ url: string }>;
  enhanced_prompt?: string;
}

export interface ImageUploadResponse {
  data: {
    uuid: string;
    name: string;
    size: number;
    size_text: string;
    type: string;
    type_text: string;
    status: number;
    status_text: string;
    url: string;
    md5: string;
    channel: string;
  };
}

export interface Task {
  id: string;
  prompt: string;
  model: string;
  mode: GenerationMode;
  count: number;
  image_url?: string;
  image_tail_url?: string;
  image_urls?: string[];
  status: 'pending' | 'running' | 'succeed' | 'failed';
  video_url?: string;
  created_at: number;
  updated_at: number;
  error_message?: string;
  auto_download?: boolean;
  downloaded?: boolean;
}

export interface ImageFile {
  file: File;
  url?: string;
  name: string;
}

export type GenerationMode = 'text' | 'image' | 'imageTail' | 'multiImage';

export const defaultPlatforms: PlatformConfig[] = [
  {
    id: 'geekai',
    name: '极客智坊',
    baseUrl: 'https://geekai.co/api',
    apiKey: '',
    apiFormat: 'unified',
    defaultModel: 'veo-3.1-fast-generate-preview',
    enableEnhancePrompt: false,
    enableUpsample: false,
    endpoints: {
      createVideo: '/v1/videos/generations',
      queryTask: '/v1/videos/{id}',
    },
    models: [
      { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast Preview', label: 'Veo 3.1 Fast Preview (推荐)', supportedModes: ['text', 'image', 'imageTail'], supportedApiFormats: ['unified'] },
      { id: 'veo-3.1-generate-preview', name: 'Veo 3.1 Preview', label: 'Veo 3.1 Preview', supportedModes: ['text', 'image', 'imageTail'], supportedApiFormats: ['unified'] },
      { id: 'veo-3.1-lite-generate-preview', name: 'Veo 3.1 Lite Preview', label: 'Veo 3.1 Lite Preview', supportedModes: ['text'], supportedApiFormats: ['unified'] },
      { id: 'veo-3.0-fast-generate-001', name: 'Veo 3 快速版', label: 'Veo 3 快速版', supportedModes: ['text', 'image'], supportedApiFormats: ['unified'] },
      { id: 'veo-3.0-generate-001', name: 'Veo 3', label: 'Veo 3', supportedModes: ['text', 'image'], supportedApiFormats: ['unified'] },
      { id: 'veo-2.0-generate-001', name: 'Veo 2', label: 'Veo 2', supportedModes: ['text'], supportedApiFormats: ['unified'] },
      { id: 'cogvideox-flash', name: 'CogVideoX Flash', label: 'CogVideoX Flash (文生视频)', supportedModes: ['text'], supportedApiFormats: ['unified'] },
      { id: 'kling-v1-6', name: 'Kling V1.6', label: 'Kling V1.6 (图生视频)', supportedModes: ['image'], supportedApiFormats: ['unified'] },
    ],
  },
  {
    id: 'apizzz',
    name: 'Apizzz',
    baseUrl: 'https://apizzz.com',
    apiKey: '',
    apiFormat: 'unified',
    defaultModel: 'veo3.1-fast',
    enableEnhancePrompt: true,
    enableUpsample: true,
    endpoints: {
      createVideo: '/v1/video/create',
      queryTask: '/v1/video/query',
    },
    models: [
      { id: 'veo3.1-fast', name: 'Veo 3.1 Fast', label: 'Veo 3.1 Fast', supportedModes: ['text', 'image', 'imageTail'], supportedApiFormats: ['unified', 'openai'], resolution: '1080p' },
      { id: 'veo3.1', name: 'Veo 3.1', label: 'Veo 3.1', supportedModes: ['text', 'image', 'imageTail'], supportedApiFormats: ['unified', 'openai'], resolution: '1080p' },
      { id: 'veo3.1-pro', name: 'Veo 3.1 Pro', label: 'Veo 3.1 Pro', supportedModes: ['text', 'image', 'imageTail'], supportedApiFormats: ['unified'], resolution: '1080p' },
      { id: 'veo3.1-4k', name: 'Veo 3.1 4K', label: 'Veo 3.1 4K', supportedModes: ['text', 'image', 'imageTail'], supportedApiFormats: ['unified'], resolution: '4k' },
      { id: 'veo3.1-pro-4k', name: 'Veo 3.1 Pro 4K', label: 'Veo 3.1 Pro 4K', supportedModes: ['text', 'image', 'imageTail'], supportedApiFormats: ['unified'], resolution: '4k' },
      { id: 'veo3.1-components', name: 'Veo 3.1 Components', label: 'Veo 3.1 Components', supportedModes: ['multiImage'], supportedApiFormats: ['unified'], resolution: '1080p' },
      { id: 'veo3-fast', name: 'Veo 3 Fast', label: 'Veo 3 Fast', supportedModes: ['text'], supportedApiFormats: ['unified'], resolution: '1080p' },
      { id: 'veo3', name: 'Veo 3', label: 'Veo 3', supportedModes: ['text'], supportedApiFormats: ['unified'], resolution: '1080p' },
      { id: 'veo3-fast-frames', name: 'Veo 3 Fast Frames', label: 'Veo 3 Fast Frames', supportedModes: ['image'], supportedApiFormats: ['unified'], resolution: '1080p' },
      { id: 'veo3-frames', name: 'Veo 3 Frames', label: 'Veo 3 Frames', supportedModes: ['image'], supportedApiFormats: ['unified'], resolution: '1080p' },
      { id: 'veo3-pro', name: 'Veo 3 Pro', label: 'Veo 3 Pro', supportedModes: ['text'], supportedApiFormats: ['unified'], resolution: '1080p' },
      { id: 'veo3-pro-frames', name: 'Veo 3 Pro Frames', label: 'Veo 3 Pro Frames', supportedModes: ['image'], supportedApiFormats: ['unified'], resolution: '1080p' },
      { id: 'veo2-fast', name: 'Veo 2 Fast', label: 'Veo 2 Fast', supportedModes: ['text'], supportedApiFormats: ['unified'], resolution: '1080p' },
      { id: 'veo2', name: 'Veo 2', label: 'Veo 2', supportedModes: ['text'], supportedApiFormats: ['unified'], resolution: '1080p' },
      { id: 'veo2-fast-frames', name: 'Veo 2 Fast Frames', label: 'Veo 2 Fast Frames (首尾帧)', supportedModes: ['image', 'imageTail'], supportedApiFormats: ['unified'], resolution: '1080p' },
      { id: 'veo2-fast-components', name: 'Veo 2 Fast Components', label: 'Veo 2 Fast Components (多图)', supportedModes: ['multiImage'], supportedApiFormats: ['unified'], resolution: '1080p' },
      { id: 'veo2-pro', name: 'Veo 2 Pro', label: 'Veo 2 Pro', supportedModes: ['text'], supportedApiFormats: ['unified'], resolution: '1080p' },
      { id: 'veo2-pro-components', name: 'Veo 2 Pro Components', label: 'Veo 2 Pro Components', supportedModes: ['multiImage'], supportedApiFormats: ['unified'], resolution: '1080p' },
    ],
  },
  {
    id: 'apizzz-openai',
    name: 'Apizzz (OpenAI格式)',
    baseUrl: 'https://apizzz.com',
    apiKey: '',
    apiFormat: 'openai',
    defaultModel: 'veo_3_1',
    enableEnhancePrompt: false,
    enableUpsample: false,
    enableWatermark: true,
    endpoints: {
      createVideo: '/v1/videos',
      queryTask: '/v1/videos/{id}',
      downloadVideo: '/v1/videos/{id}/content',
    },
    models: [
      { id: 'veo_3_1', name: 'Veo 3.1', label: 'Veo 3.1', supportedModes: ['text', 'image'], supportedApiFormats: ['openai'] },
      { id: 'veo_3_1-fast', name: 'Veo 3.1 Fast', label: 'Veo 3.1 Fast', supportedModes: ['text', 'image'], supportedApiFormats: ['openai'] },
    ],
  },
];
