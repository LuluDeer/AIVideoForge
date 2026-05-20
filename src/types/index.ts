export interface Config {
  apiKey: string;
  ck: string;
  defaultModel: string;
  aspectRatio: string;
  resolution: string;
  duration: number;
  downloadPath: string;
  autoDownload: boolean;
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
}

export interface VideoGenerationResponse {
  task_id: string;
  task_status: 'pending' | 'running' | 'succeed' | 'failed';
  model: string;
  video_result?: Array<{ url: string }>;
}

export interface TaskQueryResponse {
  model: string;
  task_id: string;
  task_status: 'pending' | 'running' | 'succeed' | 'failed';
  video_result?: Array<{ url: string }>;
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
