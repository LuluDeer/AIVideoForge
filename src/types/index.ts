// ─── 生成模式 ───────────────────────────────────────────────
export type GenerationMode = 'text' | 'image' | 'imageTail' | 'multiImage' | 'multiModal';

// ─── API 格式 ────────────────────────────────────────────────
export type ApiFormatType = 'unified' | 'openai' | 'seedance';

// ─── 图片上传方式 ─────────────────────────────────────────────
export type ImageUploadMode = 'geekai' | 'base64' | 'url' | 'cloudreve';

// ─── 参数选项 ────────────────────────────────────────────────
export interface ParamOption {
  label: string;
  value: string | number;
}

// ─── 参数定义（代码侧，单一来源）────────────────────────────
export type ParamDefType = 'string' | 'number' | 'boolean' | 'image' | 'image-multi' | 'video' | 'video-multi' | 'audio' | 'audio-multi' | 'array' | 'object' | (string & {});

export interface ParamDef {
  key: string;
  apiKey?: string;
  label: string;
  type: ParamDefType;
  modes?: GenerationMode[];
  hidden?: boolean;
  fixedValue?: unknown;
  defaultValue?: unknown;
  options?: ParamOption[];
  imageLimits?: { min?: number; max?: number };
  required?: boolean;
}

// ─── 用户覆盖（localStorage 侧）──────────────────────────────
export interface UserParamOverride {
  disabled?: boolean;
  defaultValue?: unknown;
  options?: ParamOption[];
}

// ─── 模型定义（代码侧）──────────────────────────────────────
export interface ModelDef {
  id: string;
  platformId: string;
  name: string;
  label: string;
  price?: string;
  modes: GenerationMode[];
  apiFormat: ApiFormatType;
  params: ParamDef[];
}

// ─── 平台定义（代码侧）──────────────────────────────────────
export interface PlatformDef {
  id: string;
  name: string;
  defaultBaseUrl: string;
  defaultEndpoints: ApiEndpoints;
  defaultModel: string;
  models: ModelDef[];
  /**
   * 图片上传行为的平台级覆盖。不填则沿用 geekai 默认逻辑。
   * 字段含义见 ImageUploaderConfig（services/imageUpload.ts）。
   */
  imageUploadConfig?: import('../services/imageUpload').ImageUploaderConfig;
}

// ─── API Endpoints ───────────────────────────────────────────
export interface ApiEndpoints {
  createVideo: string;
  queryTask: string;
  /** 任务完成后的固定视频内容下载端点（可选，支持 {id} / {task_id} 占位符） */
  downloadVideo?: string;
  /** 任务列表查询端点（豆包官方支持，中转站可选） */
  queryTaskList?: string;
  /** 取消/删除任务端点（豆包官方支持，中转站可选） */
  deleteTask?: string;
}

// ─── 用户平台覆盖（localStorage 侧）─────────────────────────
export interface UserPlatformConfig {
  platformId: string;
  apiKey: string;
  baseUrl?: string;
  /** 是否停用该内置平台 */
  disabled?: boolean;
  endpoints?: Partial<ApiEndpoints>;
  paramOverrides?: Record<string, UserParamOverride>;
  /** 当前内置平台的图片上传方式 */
  imageUploadMode?: ImageUploadMode;
  /** 图片上传配置覆盖，用户在 ConfigPage 填写后持久化 */
  imageUploadConfig?: import('../services/imageUpload').ImageUploaderConfig;
  /** 用户为该内置平台新增的额外模型（不改代码，保存到 localStorage） */
  extraModels?: CustomModelDef[];
  /** 用户指定的默认模型覆盖 */
  defaultModel?: string;
  /** 多账号管理：同一平台下保存的多套 API Key */
  accounts?: Array<{ id: string; label: string; apiKey: string }>;
  /** 当前激活的账号 id（对应 accounts 中的某一项） */
  activeAccountId?: string;
}

// ─── 应用配置（localStorage 侧，只存用户数据）────────────────
export interface AppConfig {
  /** 配置 schema 版本，用于后续无损迁移 */
  schemaVersion?: number;
  activePlatformId: string;
  platforms: UserPlatformConfig[];
  downloadPath: string;
  autoDownload: boolean;
  /** 是否使用操作系统代理；关闭时强制直连 */
  useSystemProxy: boolean;
  /** HTTP 代理地址；保留用于兼容旧配置 */
  httpProxy: string;
  uploadCk: string;
  /** Cloudreve 存储服务 ApiKey，用于「上传到 Cloudreve」图传方式 */
  cloudreveApiKey: string;
  /** 旧版全局图片上传模式，仅用于兼容迁移；新配置请使用平台级 imageUploadMode */
  imageUploadMode?: ImageUploadMode;
  /** 用户自定义平台列表 */
  customPlatforms?: CustomPlatformDef[];
}

// ─── 用户自定义模型（轻量定义，不依赖代码侧 ModelDef）────────
export interface CustomModelDef {
  id: string;
  name: string;
  label: string;
  modes: GenerationMode[];
  /** 是否停用该模型 */
  disabled?: boolean;
  /** 自定义模型可单独指定 apiFormat，为空时继承平台的 apiFormat */
  apiFormat?: ApiFormatType;
  /** 自定义模型的参数定义（简化版，用户可自行添加需要的参数） */
  params?: ParamDef[];
}

// ─── 用户自定义平台（完整定义，不依赖 PLATFORM_DEFS）─────────
export interface CustomPlatformDef {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  /** 是否停用该自定义平台 */
  disabled?: boolean;
  endpoints: ApiEndpoints;
  /** 自定义平台统一使用平台级 apiFormat，不依赖模型定义 */
  apiFormat: ApiFormatType;
  /** 当前平台的图片上传方式 */
  imageUploadMode?: ImageUploadMode;
  /** 自定义平台默认模型 id */
  defaultModel?: string;
  /** 自定义平台模型列表 */
  models?: CustomModelDef[];
}

// ─── 运行时平台（代码定义 + 用户覆盖合并后的结果）────────────
export interface RuntimePlatform {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  endpoints: ApiEndpoints;
  defaultModel: string;
  models: ModelDef[];
  paramOverrides: Record<string, UserParamOverride>;
  /** 当前平台的图片上传方式 */
  imageUploadMode?: ImageUploadMode;
  /** 透传平台级图片上传配置，供 ImageUploader 使用 */
  imageUploadConfig?: import('../services/imageUpload').ImageUploaderConfig;
  /** 自定义平台的 apiFormat（优先级高于模型级 apiFormat） */
  apiFormat?: ApiFormatType;
}

// ─── 视频生成请求（内部统一格式）────────────────────────────
export interface VideoGenerationRequest {
  model: string;
  prompt: string;
  image?: string | string[];
  image_tail?: string;
  images?: string[];
  video?: string | string[];
  audio?: string | string[];
  extra_body?: Record<string, unknown>;
  async?: boolean;
  aspect_ratio?: string;
  resolution?: string;
  duration?: number | string;
  enhance_prompt?: boolean;
  enable_upsample?: boolean | string;
  watermark?: boolean | string;
  seconds?: string | number;
  size?: string;
  n?: number;
  [key: string]: unknown;
}

export type TaskStatus = 'pending' | 'running' | 'succeed' | 'failed' | 'cancelled';
export type DownloadStatus = 'waiting' | 'downloading' | 'downloaded' | 'failed';

// ─── API 响应 ────────────────────────────────────────────────
export interface VideoGenerationResponse {
  task_id: string;
  task_status: TaskStatus;
  model: string;
  video_result?: Array<{ url: string }>;
  enhanced_prompt?: string;
  /** 尾帧图 URL（Seedance return_last_frame=true 时返回） */
  last_frame_url?: string;
  /** 任务失败时的错误信息 */
  error_message?: string;
  created_at?: number;
}

export interface TaskQueryResponse {
  model: string;
  task_id: string;
  task_status: TaskStatus;
  video_result?: Array<{ url: string }>;
  enhanced_prompt?: string;
  /** 尾帧图 URL（Seedance return_last_frame=true 时返回） */
  last_frame_url?: string;
  /** 任务失败时的错误信息 */
  error_message?: string;
  /** 任务真实创建时间（Unix ms），云端同步时使用 */
  created_at?: number;
}

// ─── 任务（TaskContext）──────────────────────────────────────
export interface Task {
  /** Optional metadata; absent on legacy tasks. */
  tags?: string[];
  group?: string;
  id: string;
  platformId?: string;
  prompt: string;
  model: string;
  mode: GenerationMode;
  count: number;
  image_url?: string;
  image_tail_url?: string;
  image_urls?: string[];
  video_urls?: string[];
  audio_urls?: string[];
  status: TaskStatus;
  video_url?: string;
  /** 尾帧图 URL（Seedance return_last_frame=true 时返回） */
  last_frame_url?: string;
  created_at: number;
  updated_at: number;
  error_message?: string;
  enhanced_prompt?: string;
  /** 平台返回的原始状态，便于排查不同平台状态映射问题 */
  raw_status?: string;
  poll_count?: number;
  /** 连续轮询错误次数 */
  poll_error_count?: number;
  /** 连续轮询失败过多时暂停自动轮询，保留手动刷新能力 */
  poll_paused?: boolean;
  /** 轮询暂停发生时刻（Unix ms），用于计算自动恢复尝试时机 */
  poll_paused_at?: number;
  /** 最近一次轮询错误信息 */
  last_poll_error?: string;
  /** 取消来源：云端删除成功或仅本地标记 */
  cancel_scope?: 'remote' | 'local';
  auto_download?: boolean;
  downloaded?: boolean;
  /** 自动下载状态：与生成状态分离，便于展示下载中/失败等情况 */
  download_status?: DownloadStatus;
  /** 自动下载使用的目录快照，避免后续修改全局下载路径影响既有任务 */
  download_path?: string;
  /** 自动下载完成后的本地文件路径 */
  download_file_path?: string;
  downloaded_at?: number;
  download_error?: string;
  /** 自动下载进度百分比（0-100），仅下载中有效 */
  download_progress?: number;
  download_received_bytes?: number;
  download_total_bytes?: number;
  /** 下载失败自动重试已尝试次数（指数退避，最多 MAX_DOWNLOAD_RETRY_COUNT 次） */
  download_retry_count?: number;
  /** 下一次自动重试下载的预定时刻（Unix ms），未定义表示不再自动重试 */
  download_retry_at?: number;
  /** 提交时保存的完整参数快照（用于复用参数） */
  saved_params?: Record<string, unknown>;
  /** 重试次数 */
  retry_count?: number;
  /** 重试历史记录 */
  retry_history?: Array<{
    time: number;
    old_error?: string;
    old_task_id?: string;
    new_task_id: string;
    success: boolean;
    error?: string;
  }>;
}

// ─── 图片文件 ────────────────────────────────────────────────
export interface ImageFile {
  file: File;
  url?: string;
  name: string;
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
