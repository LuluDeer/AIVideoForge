export interface UnifiedResponse {
  task_id?: string;
  task_status?: 'pending' | 'running' | 'succeed' | 'failed' | string;
  model?: string;
  video_result?: Array<{ url: string }>;
  enhanced_prompt?: string;
  last_frame_url?: string;
  id?: string;
  status?: string;
  video_url?: string;
  output?: Array<{ url: string }>;
  upsample_video_url?: string;
  content?: {
    video_url?: string;
    last_frame_url?: string;
  };
  error?: { code?: string; message?: string } | null;
  error_message?: string;
  created_at?: number | string;
  updated_at?: number | string;
  code?: number;
  error_code?: number;
  msg?: string;
  message?: string;
  data?: UnifiedResponse;
  result?: {
    task_id?: string;
    video_url?: string;
    status?: string;
    id?: string;
    output?: Array<{ url: string }>;
  };
  task?: UnifiedResponse;
  url?: string;
  video?: { url?: string };
  videos?: Array<{ url?: string } | string>;
}

export type EndpointType = 'createVideo' | 'queryTask' | 'downloadVideo' | 'queryTaskList' | 'deleteTask';
