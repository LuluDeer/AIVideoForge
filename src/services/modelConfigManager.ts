import type { ModelParameterConfig, UnifiedVideoRequest, ParameterPreset, ModelConfigTestResult, ModelTemplate } from '../types/modelConfig';
import type { PlatformConfig, ModelInfo, ParameterConstraint } from '../types';
import { getTemplateForModel, createModelConfigFromTemplate, getAllModelsFromPlatforms } from './modelTemplates';

/**
 * 静态 transform 函数映射表，完全替代动态 eval/new Function。
 * 只支持模板中实际使用的固定转换，不执行任何动态代码。
 */
const TRANSFORM_FN_MAP: Record<string, (value: unknown) => unknown> = {
  "Array.isArray(value) ? value : [value]": (value) =>
    Array.isArray(value) ? value : [value],
  "Array.isArray(value) ? value : value ? [value] : undefined": (value) =>
    Array.isArray(value) ? value : value ? [value] : undefined,
  "String(value)": (value) => String(value),
  "value.replace(':', 'x')": (value) =>
    typeof value === 'string' ? value.replace(':', 'x') : value,
};

/**
 * 静态 validate 函数映射表。
 */
const VALIDATE_FN_MAP: Record<string, (value: unknown) => boolean> = {};

function safeTransform(expression: string, value: unknown): unknown {
  const fn = TRANSFORM_FN_MAP[expression.trim()];
  if (!fn) {
    console.warn(`Unknown transform expression (skipped): ${expression}`);
    return value;
  }
  return fn(value);
}

function safeValidate(expression: string, value: unknown): boolean {
  const fn = VALIDATE_FN_MAP[expression.trim()];
  if (!fn) {
    console.warn(`Unknown validate expression (skipped): ${expression}`);
    return true;
  }
  return fn(value);
}

class ModelConfigManager {
  private configs: Map<string, ModelParameterConfig> = new Map();
  private presets: Map<string, ParameterPreset> = new Map();

  constructor() {
    this.loadConfigs();
  }

  private loadConfigs(): void {
    try {
      const savedConfigs = localStorage.getItem('model_configs');
      if (savedConfigs) {
        const configs: ModelParameterConfig[] = JSON.parse(savedConfigs);
        configs.forEach(config => this.configs.set(config.modelId, config));
      }

      const savedPresets = localStorage.getItem('model_presets');
      if (savedPresets) {
        const presets: ParameterPreset[] = JSON.parse(savedPresets);
        presets.forEach(preset => this.presets.set(preset.id, preset));
      }
    } catch (error) {
      console.error('Failed to load model configs:', error);
    }
  }

  private saveConfigs(): void {
    try {
      const configs = Array.from(this.configs.values());
      localStorage.setItem('model_configs', JSON.stringify(configs));
    } catch (error) {
      console.error('Failed to save model configs:', error);
    }
  }

  private savePresets(): void {
    try {
      const presets = Array.from(this.presets.values());
      localStorage.setItem('model_presets', JSON.stringify(presets));
    } catch (error) {
      console.error('Failed to save model presets:', error);
    }
  }

  addConfig(config: ModelParameterConfig): void {
    config.createdAt = Date.now();
    config.updatedAt = Date.now();
    config.version = 1;
    this.configs.set(config.modelId, config);
    this.saveConfigs();
  }

  updateConfig(modelId: string, updates: Partial<ModelParameterConfig>): void {
    const config = this.configs.get(modelId);
    if (config) {
      config.version = (config.version || 1) + 1;
      Object.assign(config, updates, { updatedAt: Date.now() });
      this.configs.set(modelId, config);
      this.saveConfigs();
    }
  }

  deleteConfig(modelId: string): void {
    this.configs.delete(modelId);
    this.saveConfigs();
  }

  refreshConfigForModel(modelId: string, platforms: PlatformConfig[]): ModelParameterConfig | null {
    this.deleteConfig(modelId);
    return this.getConfigForSystemModel(modelId, platforms);
  }

  getConfig(modelId: string): ModelParameterConfig | undefined {
    return this.configs.get(modelId);
  }

  getAllConfigs(): ModelParameterConfig[] {
    return Array.from(this.configs.values());
  }

  transformRequest(unifiedRequest: UnifiedVideoRequest, modelId: string, options?: { skipRequired?: boolean }): Record<string, unknown> {
    const config = this.getConfig(modelId);
    if (!config) {
      throw new Error(`Model config not found for ${modelId}`);
    }

    const result: Record<string, unknown> = {};

    for (const mapping of config.parameterMappings) {
      let value = unifiedRequest[mapping.unifiedParam as keyof UnifiedVideoRequest];

      if (value === undefined && mapping.defaultValue !== undefined) {
        value = mapping.defaultValue;
      }

      if (value === undefined && mapping.required && !options?.skipRequired) {
        throw new Error(`Required parameter ${mapping.unifiedParam} is missing`);
      }

      if (value !== undefined) {
        if (mapping.transform) {
          try {
            value = safeTransform(mapping.transform, value);
          } catch (error) {
            console.error(`Transform error for ${mapping.unifiedParam}:`, error);
          }
        }

        if (mapping.validate) {
          try {
            const result = safeValidate(mapping.validate, value);
            if (!result) {
              throw new Error(`Validation failed for parameter ${mapping.unifiedParam}`);
            }
          } catch (error) {
            console.error(`Validation error for ${mapping.unifiedParam}:`, error);
          }
        }

        result[mapping.modelParam] = value;
      }
    }

    const imageTailMapping = config.parameterMappings.find(m => m.unifiedParam === 'image_tail');
    if (imageTailMapping) {
      const imageTailValue = unifiedRequest['image_tail' as keyof UnifiedVideoRequest];
      if (imageTailValue !== undefined) {
        const targetKey = imageTailMapping.modelParam;
        const existing = result[targetKey];
        if (Array.isArray(existing)) {
          result[targetKey] = [...existing, imageTailValue];
        } else if (existing !== undefined) {
          result[targetKey] = [existing, imageTailValue];
        } else {
          result[targetKey] = [imageTailValue];
        }
        delete result['image_tail'];
      }
    }

    return result;
  }

  addPreset(preset: ParameterPreset): void {
    this.presets.set(preset.id, preset);
    this.savePresets();
  }

  updatePreset(presetId: string, updates: Partial<ParameterPreset>): void {
    const preset = this.presets.get(presetId);
    if (preset) {
      Object.assign(preset, updates);
      this.presets.set(presetId, preset);
      this.savePresets();
    }
  }

  deletePreset(presetId: string): void {
    this.presets.delete(presetId);
    this.savePresets();
  }

  getPreset(presetId: string): ParameterPreset | undefined {
    return this.presets.get(presetId);
  }

  getPresetsByModel(modelId: string): ParameterPreset[] {
    return Array.from(this.presets.values()).filter(p => p.modelId === modelId);
  }

  getAllPresets(): ParameterPreset[] {
    return Array.from(this.presets.values());
  }

  applyPreset(presetId: string, baseRequest: Partial<UnifiedVideoRequest>): UnifiedVideoRequest {
    const preset = this.getPreset(presetId);
    if (!preset) {
      throw new Error(`Preset not found: ${presetId}`);
    }

    return {
      ...baseRequest,
      ...preset.parameters,
      model: preset.modelId
    };
  }

  

  testConfig(modelId: string, testRequest: UnifiedVideoRequest): ModelConfigTestResult {
    try {
      const transformed = this.transformRequest(testRequest, modelId);
      return {
        success: true,
        requestPayload: transformed,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        requestPayload: {},
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  exportConfigs(): string {
    const data = {
      configs: Array.from(this.configs.values()),
      presets: Array.from(this.presets.values())
    };
    return JSON.stringify(data, null, 2);
  }

  importConfigs(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      if (data.configs) {
        data.configs.forEach((config: ModelParameterConfig) => {
          this.configs.set(config.modelId, config);
        });
      }
      if (data.presets) {
        data.presets.forEach((preset: ParameterPreset) => {
          this.presets.set(preset.id, preset);
        });
      }
      this.saveConfigs();
      this.savePresets();
      return true;
    } catch (error) {
      console.error('Failed to import configs:', error);
      return false;
    }
  }

  syncWithSystemPlatforms(platforms: PlatformConfig[]): {
    added: ModelParameterConfig[];
    updated: ModelParameterConfig[];
    skipped: string[];
  } {
    const result = {
      added: [] as ModelParameterConfig[],
      updated: [] as ModelParameterConfig[],
      skipped: [] as string[]
    };

    const allModels = getAllModelsFromPlatforms(platforms);

    for (const { modelInfo, platformConfig, template } of allModels) {
      const existingConfig = this.configs.get(modelInfo.id);

      if (existingConfig) {
        result.skipped.push(modelInfo.id);
      } else if (template) {
        const newConfig = createModelConfigFromTemplate(template, modelInfo, platformConfig);
        this.addConfig(newConfig);
        result.added.push(newConfig);
      }
    }

    this.saveConfigs();
    return result;
  }

  getConfigForSystemModel(modelId: string, platforms: PlatformConfig[]): ModelParameterConfig | null {
    let config = this.configs.get(modelId);
    
    if (!config) {
      for (const platform of platforms) {
        const model = platform.models.find(m => m.id === modelId);
        if (model) {
          if (model.modelConfigId) {
            const mappedConfig = this.configs.get(model.modelConfigId);
            if (mappedConfig) {
              config = mappedConfig;
              break;
            }
          }
          
          const template = getTemplateForModel(model, platform);
          if (template) {
            const newConfig = createModelConfigFromTemplate(template, model, platform);
            this.addConfig(newConfig);
            config = newConfig;
            break;
          }
        }
      }
    }
    
    return config || null;
  }

  getUnsyncedModels(platforms: PlatformConfig[]): Array<{
    modelInfo: ModelInfo;
    platformConfig: PlatformConfig;
    template: ModelTemplate | null;
  }> {
    const allModels = getAllModelsFromPlatforms(platforms);
    return allModels.filter(({ modelInfo }) => !this.configs.has(modelInfo.id));
  }

  getModelConstraints(modelId: string, platforms: PlatformConfig[]): ParameterConstraint[] {
    for (const platform of platforms) {
      const model = platform.models.find(m => m.id === modelId);
      if (model && model.parameterConstraints) {
        return model.parameterConstraints;
      }
    }
    return [];
  }

  getConstraintForParam(modelId: string, paramName: string, platforms: PlatformConfig[]): ParameterConstraint | undefined {
    const constraints = this.getModelConstraints(modelId, platforms);
    return constraints.find(c => c.unifiedParam === paramName);
  }

  applyConstraintsToRequest(request: UnifiedVideoRequest, modelId: string, platforms: PlatformConfig[], modelConfig?: ModelParameterConfig): UnifiedVideoRequest {
    const constraints = this.getModelConstraints(modelId, platforms);
    const result = { ...request };

    const convertByParamType = (value: any, paramName: string): any => {
      if (!modelConfig) return value;
      const mapping = modelConfig.parameterMappings.find(m => m.unifiedParam === paramName);
      if (!mapping) return value;

      if (mapping.paramType === 'number') {
        const num = Number(value);
        return isNaN(num) ? value : num;
      } else if (mapping.paramType === 'boolean') {
        if (typeof value === 'boolean') return value;
        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0') return false;
        return Boolean(value);
      } else if (mapping.paramType === 'array') {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
          } catch {
            return [value];
          }
        }
        return [value];
      } else if (mapping.paramType === 'object') {
        if (typeof value === 'object') return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        return value;
      }
      return value;
    };

    for (const constraint of constraints) {
      if (constraint.enabled === false) continue;

      if (constraint.hidden) {
        if (constraint.fixed !== undefined) {
          result[constraint.unifiedParam as keyof UnifiedVideoRequest] = convertByParamType(constraint.fixed, constraint.unifiedParam);
        }
        continue;
      }

      if (constraint.fixed !== undefined) {
        result[constraint.unifiedParam as keyof UnifiedVideoRequest] = convertByParamType(constraint.fixed, constraint.unifiedParam);
      } else if (constraint.defaultValue !== undefined && result[constraint.unifiedParam as keyof UnifiedVideoRequest] === undefined) {
        result[constraint.unifiedParam as keyof UnifiedVideoRequest] = convertByParamType(constraint.defaultValue, constraint.unifiedParam);
      }
    }

    return result;
  }

  validateConstraints(request: UnifiedVideoRequest, modelId: string, platforms: PlatformConfig[]): { valid: boolean; errors: string[] } {
    const constraints = this.getModelConstraints(modelId, platforms);
    const errors: string[] = [];

    for (const constraint of constraints) {
      if (constraint.enabled === false) continue;
      if (constraint.hidden) continue;

      const value = request[constraint.unifiedParam as keyof UnifiedVideoRequest];

      if (constraint.min !== undefined && typeof value === 'number' && value < constraint.min) {
        errors.push(`${constraint.unifiedParam} 的值 ${value} 小于最小值 ${constraint.min}`);
      }

      if (constraint.max !== undefined && typeof value === 'number' && value > constraint.max) {
        errors.push(`${constraint.unifiedParam} 的值 ${value} 大于最大值 ${constraint.max}`);
      }

      if (constraint.enumValues && constraint.enumValues.length > 0 && !constraint.enumValues.includes(value)) {
        errors.push(`${constraint.unifiedParam} 的值 ${value} 不在允许的范围内: ${constraint.enumValues.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  getFilteredEnumValues(modelId: string, paramName: string, platforms: PlatformConfig[], defaultValues: any[]): any[] {
    const constraint = this.getConstraintForParam(modelId, paramName, platforms);
    if (constraint?.enumValues && constraint.enumValues.length > 0) {
      return constraint.enumValues;
    }
    return defaultValues;
  }

  isParamHidden(modelId: string, paramName: string, platforms: PlatformConfig[]): boolean {
    const constraint = this.getConstraintForParam(modelId, paramName, platforms);
    if (constraint?.enabled === false) return true;
    return constraint?.hidden ?? false;
  }

  isParamEnabled(modelId: string, paramName: string, platforms: PlatformConfig[]): boolean {
    const constraint = this.getConstraintForParam(modelId, paramName, platforms);
    return constraint?.enabled !== false;
  }

  isParamFixed(modelId: string, paramName: string, platforms: PlatformConfig[]): boolean {
    const constraint = this.getConstraintForParam(modelId, paramName, platforms);
    return constraint?.fixed !== undefined;
  }

  getFixedValue(modelId: string, paramName: string, platforms: PlatformConfig[]): any {
    const constraint = this.getConstraintForParam(modelId, paramName, platforms);
    return constraint?.fixed;
  }
}

export default new ModelConfigManager();