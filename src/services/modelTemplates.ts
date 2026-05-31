import type { ModelTemplate, ModelParameterConfig } from '../types/modelConfig';
import type { PlatformConfig, ModelInfo } from '../types';

const STORAGE_KEY = 'custom_model_templates';

const defaultTemplates: ModelTemplate[] = [
  {
    id: 'veo-text-only',
    name: 'Veo 文生视频模板',
    description: '仅支持文本生成视频的Veo模型',
    apiFormat: 'unified',
    imageType: 'single',
    imageLimits: { min: 0, max: 0 },
    supportedModes: ['text'],
    parameterMappings: [
      {
        unifiedParam: 'model',
        modelParam: 'model',
        paramType: 'string',
        required: true,
        description: '模型ID',
        showInUI: false
      },
      {
        unifiedParam: 'prompt',
        modelParam: 'prompt',
        paramType: 'string',
        required: true,
        description: '视频生成提示词',
        showInUI: false
      },
      {
        unifiedParam: 'async',
        modelParam: 'async',
        paramType: 'boolean',
        defaultValue: true,
        required: false,
        description: '是否异步处理',
        showInUI: false
      },
      {
        unifiedParam: 'aspect_ratio',
        modelParam: 'aspect_ratio',
        paramType: 'string',
        defaultValue: '16:9',
        required: false,
        enumValues: ['16:9', '9:16'],
        description: '宽高比',
        showInUI: true,
        uiLabel: '宽高比',
        uiType: 'select'
      },
      {
        unifiedParam: 'resolution',
        modelParam: 'resolution',
        paramType: 'string',
        defaultValue: '1080p',
        required: false,
        enumValues: ['720p', '1080p', '4k'],
        description: '分辨率',
        showInUI: true,
        uiLabel: '分辨率',
        uiType: 'select'
      },
      {
        unifiedParam: 'duration',
        modelParam: 'duration',
        paramType: 'number',
        defaultValue: 4,
        required: false,
        description: '视频时长（秒）',
        showInUI: true,
        uiLabel: '视频时长',
        uiType: 'select'
      },
      {
        unifiedParam: 'enhance_prompt',
        modelParam: 'enhance_prompt',
        paramType: 'boolean',
        defaultValue: true,
        required: false,
        description: '是否增强提示词（中文转英文）',
        showInUI: true,
        uiLabel: '提示词增强',
        uiType: 'checkbox'
      },
      {
        unifiedParam: 'enable_upsample',
        modelParam: 'enable_upsample',
        paramType: 'boolean',
        defaultValue: false,
        required: false,
        description: '是否启用超分',
        showInUI: true,
        uiLabel: '超分',
        uiType: 'checkbox'
      },
      {
        unifiedParam: 'watermark',
        modelParam: 'watermark',
        paramType: 'boolean',
        defaultValue: false,
        required: false,
        description: '是否添加水印',
        showInUI: true,
        uiLabel: '添加水印',
        uiType: 'checkbox'
      }
    ]
  },
  {
    id: 'veo-image-only',
    name: 'Veo 图生视频模板',
    description: '支持单张图片生成视频的Veo模型',
    apiFormat: 'unified',
    imageType: 'single',
    imageLimits: { min: 1, max: 1 },
    supportedModes: ['image'],
    parameterMappings: [
      {
        unifiedParam: 'model',
        modelParam: 'model',
        paramType: 'string',
        required: true,
        description: '模型ID',
        showInUI: false
      },
      {
        unifiedParam: 'prompt',
        modelParam: 'prompt',
        paramType: 'string',
        required: true,
        description: '视频生成提示词',
        showInUI: false
      },
      {
        unifiedParam: 'image',
        modelParam: 'images',
        paramType: 'array',
        required: true,
        transform: 'Array.isArray(value) ? value : [value]',
        description: '输入图片URL',
        showInUI: false
      },
      {
        unifiedParam: 'async',
        modelParam: 'async',
        paramType: 'boolean',
        defaultValue: true,
        required: false,
        description: '是否异步处理',
        showInUI: false
      },
      {
        unifiedParam: 'aspect_ratio',
        modelParam: 'aspect_ratio',
        paramType: 'string',
        defaultValue: '16:9',
        required: false,
        enumValues: ['16:9', '9:16'],
        description: '宽高比',
        showInUI: true,
        uiLabel: '宽高比',
        uiType: 'select'
      },
      {
        unifiedParam: 'resolution',
        modelParam: 'resolution',
        paramType: 'string',
        defaultValue: '1080p',
        required: false,
        enumValues: ['720p', '1080p', '4k'],
        description: '分辨率',
        showInUI: true,
        uiLabel: '分辨率',
        uiType: 'select'
      },
      {
        unifiedParam: 'duration',
        modelParam: 'duration',
        paramType: 'number',
        defaultValue: 4,
        required: false,
        description: '视频时长（秒）',
        showInUI: true,
        uiLabel: '视频时长',
        uiType: 'select'
      },
      {
        unifiedParam: 'enhance_prompt',
        modelParam: 'enhance_prompt',
        paramType: 'boolean',
        defaultValue: true,
        required: false,
        description: '是否增强提示词（中文转英文）',
        showInUI: true,
        uiLabel: '提示词增强',
        uiType: 'checkbox'
      },
      {
        unifiedParam: 'enable_upsample',
        modelParam: 'enable_upsample',
        paramType: 'boolean',
        defaultValue: false,
        required: false,
        description: '是否启用超分',
        showInUI: true,
        uiLabel: '超分',
        uiType: 'checkbox'
      },
      {
        unifiedParam: 'watermark',
        modelParam: 'watermark',
        paramType: 'boolean',
        defaultValue: false,
        required: false,
        description: '是否添加水印',
        showInUI: true,
        uiLabel: '添加水印',
        uiType: 'checkbox'
      }
    ]
  },
  {
    id: 'veo-image-tail',
    name: 'Veo 首尾帧模板',
    description: '支持首尾帧生成视频的Veo模型',
    apiFormat: 'unified',
    imageType: 'single',
    imageLimits: { min: 1, max: 2 },
    supportedModes: ['image', 'imageTail'],
    parameterMappings: [
      {
        unifiedParam: 'model',
        modelParam: 'model',
        paramType: 'string',
        required: true,
        description: '模型ID',
        showInUI: false
      },
      {
        unifiedParam: 'prompt',
        modelParam: 'prompt',
        paramType: 'string',
        required: true,
        description: '视频生成提示词',
        showInUI: false
      },
      {
        unifiedParam: 'image',
        modelParam: 'images',
        paramType: 'array',
        required: true,
        transform: 'Array.isArray(value) ? value : [value]',
        description: '首帧图片URL',
        showInUI: false
      },
      {
        unifiedParam: 'image_tail',
        modelParam: 'images',
        paramType: 'array',
        required: false,
        description: '尾帧图片URL（由transformRequest合并到images数组末尾）',
        showInUI: false
      },
      {
        unifiedParam: 'async',
        modelParam: 'async',
        paramType: 'boolean',
        defaultValue: true,
        required: false,
        description: '是否异步处理',
        showInUI: false
      },
      {
        unifiedParam: 'aspect_ratio',
        modelParam: 'aspect_ratio',
        paramType: 'string',
        defaultValue: '16:9',
        required: false,
        enumValues: ['16:9', '9:16'],
        description: '宽高比',
        showInUI: true,
        uiLabel: '宽高比',
        uiType: 'select'
      },
      {
        unifiedParam: 'resolution',
        modelParam: 'resolution',
        paramType: 'string',
        defaultValue: '1080p',
        required: false,
        enumValues: ['720p', '1080p', '4k'],
        description: '分辨率',
        showInUI: true,
        uiLabel: '分辨率',
        uiType: 'select'
      },
      {
        unifiedParam: 'duration',
        modelParam: 'duration',
        paramType: 'number',
        defaultValue: 4,
        required: false,
        description: '视频时长（秒）',
        showInUI: true,
        uiLabel: '视频时长',
        uiType: 'select'
      },
      {
        unifiedParam: 'enhance_prompt',
        modelParam: 'enhance_prompt',
        paramType: 'boolean',
        defaultValue: true,
        required: false,
        description: '是否增强提示词（中文转英文）',
        showInUI: true,
        uiLabel: '提示词增强',
        uiType: 'checkbox'
      },
      {
        unifiedParam: 'enable_upsample',
        modelParam: 'enable_upsample',
        paramType: 'boolean',
        defaultValue: false,
        required: false,
        description: '是否启用超分',
        showInUI: true,
        uiLabel: '超分',
        uiType: 'checkbox'
      },
      {
        unifiedParam: 'watermark',
        modelParam: 'watermark',
        paramType: 'boolean',
        defaultValue: false,
        required: false,
        description: '是否添加水印',
        showInUI: true,
        uiLabel: '添加水印',
        uiType: 'checkbox'
      }
    ]
  },
  {
    id: 'veo-multi-image',
    name: 'Veo 多图模板',
    description: '支持多张图片生成视频的Veo模型',
    apiFormat: 'unified',
    imageType: 'multiple',
    imageLimits: { min: 1, max: 3 },
    supportedModes: ['multiImage'],
    parameterMappings: [
      {
        unifiedParam: 'model',
        modelParam: 'model',
        paramType: 'string',
        required: true,
        description: '模型ID',
        showInUI: false
      },
      {
        unifiedParam: 'prompt',
        modelParam: 'prompt',
        paramType: 'string',
        required: true,
        description: '视频生成提示词',
        showInUI: false
      },
      {
        unifiedParam: 'images',
        modelParam: 'images',
        paramType: 'array',
        uiType: 'image',
        required: true,
        description: '多张图片URL数组',
        showInUI: true
      },
      {
        unifiedParam: 'async',
        modelParam: 'async',
        paramType: 'boolean',
        defaultValue: true,
        required: false,
        description: '是否异步处理',
        showInUI: false
      },
      {
        unifiedParam: 'aspect_ratio',
        modelParam: 'aspect_ratio',
        paramType: 'string',
        defaultValue: '16:9',
        required: false,
        enumValues: ['16:9', '9:16'],
        description: '宽高比',
        showInUI: true,
        uiLabel: '宽高比',
        uiType: 'select'
      },
      {
        unifiedParam: 'resolution',
        modelParam: 'resolution',
        paramType: 'string',
        defaultValue: '1080p',
        required: false,
        enumValues: ['720p', '1080p'],
        description: '分辨率',
        showInUI: true,
        uiLabel: '分辨率',
        uiType: 'select'
      },
      {
        unifiedParam: 'duration',
        modelParam: 'duration',
        paramType: 'number',
        defaultValue: 4,
        required: false,
        description: '视频时长（秒）',
        showInUI: true,
        uiLabel: '视频时长',
        uiType: 'select'
      },
      {
        unifiedParam: 'enhance_prompt',
        modelParam: 'enhance_prompt',
        paramType: 'boolean',
        defaultValue: true,
        required: false,
        description: '是否增强提示词（中文转英文）',
        showInUI: true,
        uiLabel: '提示词增强',
        uiType: 'checkbox'
      },
      {
        unifiedParam: 'enable_upsample',
        modelParam: 'enable_upsample',
        paramType: 'boolean',
        defaultValue: false,
        required: false,
        description: '是否启用超分',
        showInUI: true,
        uiLabel: '超分',
        uiType: 'checkbox'
      },
      {
        unifiedParam: 'watermark',
        modelParam: 'watermark',
        paramType: 'boolean',
        defaultValue: false,
        required: false,
        description: '是否添加水印',
        showInUI: true,
        uiLabel: '添加水印',
        uiType: 'checkbox'
      }
    ]
  },
  {
    id: 'veo-universal',
    name: 'Veo 通用模板',
    description: '支持所有模式的Veo模型',
    apiFormat: 'unified',
    imageType: 'both',
    imageLimits: { min: 0, max: 3 },
    supportedModes: ['text', 'image', 'imageTail', 'multiImage'],
    parameterMappings: [
      {
        unifiedParam: 'model',
        modelParam: 'model',
        paramType: 'string',
        required: true,
        description: '模型ID',
        showInUI: false
      },
      {
        unifiedParam: 'prompt',
        modelParam: 'prompt',
        paramType: 'string',
        required: true,
        description: '视频生成提示词',
        showInUI: false
      },
      {
        unifiedParam: 'image',
        modelParam: 'images',
        paramType: 'array',
        required: false,
        transform: 'Array.isArray(value) ? value : value ? [value] : undefined',
        description: '单张图片URL',
        showInUI: false
      },
      {
        unifiedParam: 'image_tail',
        modelParam: 'images',
        paramType: 'array',
        required: false,
        description: '尾帧图片URL',
        showInUI: false
      },
      {
        unifiedParam: 'images',
        modelParam: 'images',
        paramType: 'array',
        uiType: 'image',
        required: false,
        description: '多张图片URL数组',
        showInUI: true
      },
      {
        unifiedParam: 'async',
        modelParam: 'async',
        paramType: 'boolean',
        defaultValue: true,
        required: false,
        description: '是否异步处理',
        showInUI: false
      },
      {
        unifiedParam: 'aspect_ratio',
        modelParam: 'aspect_ratio',
        paramType: 'string',
        defaultValue: '16:9',
        required: false,
        enumValues: ['16:9', '9:16'],
        description: '宽高比',
        showInUI: true,
        uiLabel: '宽高比',
        uiType: 'select'
      },
      {
        unifiedParam: 'resolution',
        modelParam: 'resolution',
        paramType: 'string',
        defaultValue: '1080p',
        required: false,
        enumValues: ['720p', '1080p', '4k'],
        description: '分辨率',
        showInUI: true,
        uiLabel: '分辨率',
        uiType: 'select'
      },
      {
        unifiedParam: 'duration',
        modelParam: 'duration',
        paramType: 'number',
        defaultValue: 4,
        required: false,
        description: '视频时长（秒）',
        showInUI: true,
        uiLabel: '视频时长',
        uiType: 'select'
      },
      {
        unifiedParam: 'enhance_prompt',
        modelParam: 'enhance_prompt',
        paramType: 'boolean',
        defaultValue: true,
        required: false,
        description: '是否增强提示词（中文转英文）',
        showInUI: true,
        uiLabel: '提示词增强',
        uiType: 'checkbox'
      },
      {
        unifiedParam: 'enable_upsample',
        modelParam: 'enable_upsample',
        paramType: 'boolean',
        defaultValue: false,
        required: false,
        description: '是否启用超分',
        showInUI: true,
        uiLabel: '超分',
        uiType: 'checkbox'
      },
      {
        unifiedParam: 'watermark',
        modelParam: 'watermark',
        paramType: 'boolean',
        defaultValue: false,
        required: false,
        description: '是否添加水印',
        showInUI: true,
        uiLabel: '添加水印',
        uiType: 'checkbox'
      }
    ]
  },
  {
    id: 'openai-format',
    name: 'OpenAI 格式模板',
    description: 'OpenAI API格式的视频生成模板',
    apiFormat: 'openai',
    imageType: 'single',
    imageLimits: { min: 0, max: 1 },
    supportedModes: ['text', 'image'],
    parameterMappings: [
      {
        unifiedParam: 'model',
        modelParam: 'model',
        paramType: 'string',
        required: true,
        description: '模型ID',
        showInUI: false
      },
      {
        unifiedParam: 'prompt',
        modelParam: 'prompt',
        paramType: 'string',
        required: true,
        description: '视频生成提示词',
        showInUI: false
      },
      {
        unifiedParam: 'image',
        modelParam: 'image',
        paramType: 'string',
        required: false,
        description: '输入图片URL',
        showInUI: false
      },
      {
        unifiedParam: 'duration',
        modelParam: 'seconds',
        paramType: 'string',
        defaultValue: '4',
        required: false,
        transform: 'String(value)',
        description: '视频时长（秒）',
        showInUI: true,
        uiLabel: '视频时长',
        uiType: 'select'
      },
      {
        unifiedParam: 'aspect_ratio',
        modelParam: 'size',
        paramType: 'string',
        defaultValue: '16x9',
        required: false,
        transform: 'value.replace(\':\', \'x\')',
        enumValues: ['16x9', '9x16', '1x1'],
        description: '尺寸',
        showInUI: true,
        uiLabel: '宽高比',
        uiType: 'select'
      },
      {
        unifiedParam: 'watermark',
        modelParam: 'watermark',
        paramType: 'string',
        defaultValue: 'false',
        required: false,
        transform: 'String(value)',
        description: '是否添加水印',
        showInUI: true,
        uiLabel: '添加水印',
        uiType: 'checkbox'
      }
    ]
  }
];

function getCustomTemplates(): ModelTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCustomTemplates(templates: ModelTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export const veoTemplates = defaultTemplates;

export function getAllTemplates(): ModelTemplate[] {
  const custom = getCustomTemplates();
  return [...defaultTemplates, ...custom];
}

export function addTemplate(template: Omit<ModelTemplate, 'id'>): ModelTemplate {
  const newTemplate: ModelTemplate = {
    ...template,
    id: `custom-${Date.now()}`
  };
  const custom = getCustomTemplates();
  custom.push(newTemplate);
  saveCustomTemplates(custom);
  return newTemplate;
}

export function updateTemplate(id: string, updates: Partial<ModelTemplate>): boolean {
  const custom = getCustomTemplates();
  const index = custom.findIndex(t => t.id === id);
  if (index === -1) return false;
  
  custom[index] = { ...custom[index], ...updates };
  saveCustomTemplates(custom);
  return true;
}

export function deleteTemplate(id: string): boolean {
  const custom = getCustomTemplates();
  const filtered = custom.filter(t => t.id !== id);
  if (filtered.length === custom.length) return false;
  
  saveCustomTemplates(filtered);
  return true;
}

export function isCustomTemplate(id: string): boolean {
  return id.startsWith('custom-');
}

export function getTemplateForModel(modelInfo: ModelInfo, platformConfig: PlatformConfig): ModelTemplate | null {
  const templates = getAllTemplates();
  
  if (platformConfig.apiFormat === 'openai') {
    return templates.find(t => t.id === 'openai-format') || null;
  }
  
  const supportedModes = modelInfo.supportedModes;
  
  if (supportedModes.includes('multiImage')) {
    return templates.find(t => t.id === 'veo-multi-image') || null;
  }
  
  if (supportedModes.includes('imageTail')) {
    return templates.find(t => t.id === 'veo-image-tail') || null;
  }
  
  if (supportedModes.includes('image') && supportedModes.includes('text')) {
    return templates.find(t => t.id === 'veo-universal') || null;
  }
  
  if (supportedModes.includes('image')) {
    return templates.find(t => t.id === 'veo-image-only') || null;
  }
  
  if (supportedModes.includes('text')) {
    return templates.find(t => t.id === 'veo-text-only') || null;
  }
  
  return templates.find(t => t.id === 'veo-universal') || null;
}

export function createModelConfigFromTemplate(
  template: ModelTemplate,
  modelInfo: ModelInfo,
  _platformConfig: PlatformConfig
): ModelParameterConfig {
  return {
    modelId: modelInfo.id,
    modelName: modelInfo.name,
    parameterMappings: JSON.parse(JSON.stringify(template.parameterMappings)),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function getAllModelsFromPlatforms(platforms: PlatformConfig[]): Array<{
  modelInfo: ModelInfo;
  platformConfig: PlatformConfig;
  template: ModelTemplate | null;
}> {
  const result: Array<{
    modelInfo: ModelInfo;
    platformConfig: PlatformConfig;
    template: ModelTemplate | null;
  }> = [];
  
  for (const platform of platforms) {
    for (const model of platform.models) {
      const template = getTemplateForModel(model, platform);
      result.push({
        modelInfo: model,
        platformConfig: platform,
        template
      });
    }
  }
  
  return result;
}