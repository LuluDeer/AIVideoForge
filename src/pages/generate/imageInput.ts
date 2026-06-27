export const MAX_IMAGE_FILE_SIZE = 15 * 1024 * 1024;
export const MAX_VIDEO_FILE_SIZE = 200 * 1024 * 1024;
export const MAX_AUDIO_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_IMAGE_URL_LENGTH = 2048;

export const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
export const ALLOWED_AUDIO_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg']);

const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|avi)$/i;
const AUDIO_EXT_RE = /\.(mp3|wav|m4a|aac|ogg)$/i;
const COMMON_IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?.*)?$/i;
const ASSET_URL_RE = /^asset:\/\/[A-Za-z0-9_-]+$/;

export const isAssetUrl = (value: string): boolean => ASSET_URL_RE.test(value.trim());

export interface NormalizedImageUrl {
  url: string;
  hasCommonImageExt: boolean;
}

export function validateImageFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return '仅支持 JPG、PNG、WebP 或 GIF 图片';
  if (file.size <= 0) return '图片文件为空';
  if (file.size > MAX_IMAGE_FILE_SIZE) return '图片过大，请选择 15MB 以内的图片';
  return null;
}

export function validateMediaFile(file: Pick<File, 'type' | 'size' | 'name'>, kind: 'video' | 'audio'): string | null {
  if (file.size <= 0) return `${kind === 'video' ? '视频' : '音频'}文件为空`;
  const fileName = file.name ?? '';
  if (kind === 'video') {
    if (!ALLOWED_VIDEO_TYPES.has(file.type) && !VIDEO_EXT_RE.test(fileName)) return '仅支持 MP4、WebM、MOV、M4V 或 AVI 视频';
    if (file.size > MAX_VIDEO_FILE_SIZE) return '视频过大，请选择 200MB 以内的视频';
    return null;
  }
  if (!ALLOWED_AUDIO_TYPES.has(file.type) && !AUDIO_EXT_RE.test(fileName)) return '仅支持 MP3、WAV、M4A、AAC 或 OGG 音频';
  if (file.size > MAX_AUDIO_FILE_SIZE) return '音频过大，请选择 50MB 以内的音频';
  return null;
}

export function normalizeImageUrl(raw: string): NormalizedImageUrl | null {
  const value = raw.trim();
  if (!value || value.length > MAX_IMAGE_URL_LENGTH) return null;
  if (isAssetUrl(value)) return { url: value, hasCommonImageExt: true };
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return { url: url.toString(), hasCommonImageExt: COMMON_IMAGE_EXT_RE.test(url.pathname + url.search) };
  } catch {
    return null;
  }
}

export function normalizeMediaUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > MAX_IMAGE_URL_LENGTH) return null;
  if (isAssetUrl(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}
