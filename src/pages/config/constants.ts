import type { ApiFormatType, GenerationMode } from '../../types';

export const ALL_MODES: { value: GenerationMode; label: string }[] = [
  { value: 'text', label: '文生视频' },
  { value: 'image', label: '图生视频' },
  { value: 'imageTail', label: '首尾帧' },
  { value: 'multiImage', label: '多图生成' },
  { value: 'multiModal', label: '多模态参考' },
];

export const API_FORMATS: { value: ApiFormatType; label: string; desc: string }[] = [
  { value: 'unified', label: 'Unified', desc: 'JSON 通用格式，适合 GeekAI 与多数中转站' },
  { value: 'openai', label: 'OpenAI/FormData', desc: 'multipart/form-data，适合 Apizzz 部分接口' },
  { value: 'seedance', label: 'Seedance 官方', desc: 'content[] 格式，适合火山方舟/豆包官方' },
];
