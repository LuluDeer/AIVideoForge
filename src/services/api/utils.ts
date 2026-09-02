export const isPresent = (value: unknown): boolean => value !== undefined && value !== null && value !== '';

export const isEnabled = (value: unknown): boolean => value === true || value === 'true' || value === 1 || value === '1';

export const getFirstImage = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return value.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return typeof value === 'string' && value.trim() ? value : undefined;
};

export const getImageList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
};

/** 远程 API 返回的 URL 只接受 http(s)，拒绝 javascript:/data:/file: 等可执行或本地协议 */
export const isSafeRemoteUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const collectUrls = (...values: Array<string | undefined>): Array<{ url: string }> => {
  const urls: Array<{ url: string }> = [];
  for (const url of values) {
    if (!isSafeRemoteUrl(url)) continue;
    if (!urls.some(item => item.url === url)) urls.push({ url });
  }
  return urls;
};
