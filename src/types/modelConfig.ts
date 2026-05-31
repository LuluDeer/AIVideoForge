export type ParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object';
export type ImageType = 'single' | 'multiple' | 'both';

export interface ParameterPresetOption {
  label: string;
  value: any;
  description?: string;
}

export interface ParameterMapping {
  unifiedParam: string;
  modelParam: string;
  paramType: ParameterType;
  defaultValue?: any;
  required?: boolean;
  description?: string;
  enumValues?: any[];
  transform?: string;
  validate?: string;
  showInUI?: boolean;
  uiLabel?: string;
  uiType?: 'select' | 'checkbox' | 'input' | 'number' | 'image' | 'image-multi' | 'textarea' | 'prompts' | 'imageUpload';
  presetOptions?: ParameterPresetOption[];
  /** 对于prompts类型，指定是否支持批量并发请求 */
  supportBatch?: boolean;
  /** 对于image类型，指定图片数量限制 */
  maxImages?: number;
}

export interface ModelParameterConfig {
  modelId: string;
  modelName: string;
  parameterMappings: ParameterMapping[];
  createdAt?: number;
  updatedAt?: number;
  version?: number;
}

export interface ParameterPreset {
  id: string;
  name: string;
  modelId: string;
  parameters: Record<string, any>;
  description?: string;
  isDefault?: boolean;
}

export interface ModelTemplate {
  id: string;
  name: string;
  description: string;
  apiFormat: 'unified' | 'openai' | 'custom';
  parameterMappings: ParameterMapping[];
  imageType: ImageType;
  imageLimits?: {
    min?: number;
    max?: number;
  };
  supportedModes: string[];
}

export interface ModelConfigTestResult {
  success: boolean;
  requestPayload: Record<string, unknown>;
  response?: any;
  error?: string;
  timestamp: number;
}

export interface UnifiedVideoRequest {
  model: string;
  prompt?: string;
  image?: string | string[];
  image_tail?: string;
  images?: string[];
  aspect_ratio?: string;
  resolution?: string;
  duration?: number;
  enhance_prompt?: boolean;
  enable_upsample?: boolean | string;
  watermark?: boolean | string;
  seconds?: string | number;
  size?: string;
  async?: boolean;
  [key: string]: any;
}
