import React, { useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import GeekaiAssetService from '../services/geekaiAssets';
import { isAssetUrl } from '../pages/generate/imageInput';
import type { RuntimePlatform } from '../types';
import { logger } from '../utils/logger';

interface AssetAwareImageProps {
  /** 图片地址，可能是 http(s)/data URL，也可能是 asset:// 素材引用 */
  url: string;
  /** 任务所属平台，用于在素材缓存中反查 asset:// 对应的原始 URL */
  platform?: RuntimePlatform;
  className?: string;
  alt?: string;
  title?: string;
}

const RENDERABLE_URL_RE = /^(https?:|data:|blob:|file:)/i;

/** 从素材缓存中把 asset:// 引用解析回可展示的原始 URL；解析不到返回 null */
const resolveAssetSourceUrl = (assetUrl: string, platform?: RuntimePlatform): string | null => {
  if (!platform?.apiKey) return null;
  try {
    const record = new GeekaiAssetService(platform).getCachedAssetByAssetUrl(assetUrl, 'image');
    const sourceUrl = record?.sourceUrl ?? null;
    return sourceUrl && RENDERABLE_URL_RE.test(sourceUrl) ? sourceUrl : null;
  } catch (error) {
    logger.warn('AssetAwareImage', '解析素材缓存失败', error);
    return null;
  }
};

/**
 * 任务列表/详情用的图片缩略图：
 * - asset:// 素材引用优先通过 GeekAI 素材缓存反查原始 URL 展示，并带「素材」角标；
 * - 无法解析或图片加载失败（如签名 URL 过期）时显示占位块，避免出现浏览器默认的损坏图标。
 */
const AssetAwareImage: React.FC<AssetAwareImageProps> = ({ url, platform, className = '', alt, title }) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const assetSourceUrl = useMemo(
    () => (isAssetUrl(url) ? resolveAssetSourceUrl(url, platform) : null),
    [url, platform],
  );
  const displayUrl = isAssetUrl(url) ? assetSourceUrl : url;
  const failed = failedUrl === url;

  if (!displayUrl || !RENDERABLE_URL_RE.test(displayUrl) || failed) {
    const isAsset = isAssetUrl(url);
    return (
      <span
        className={`inline-flex items-center justify-center bg-purple-50 text-purple-500 border border-purple-100 ${className}`}
        title={title ? `${title}\n${url}` : url}
      >
        {isAsset && !failed ? (
          <span className="px-1 text-[10px] font-medium leading-tight text-center">素材</span>
        ) : (
          <ImageOff className="w-4 h-4" />
        )}
      </span>
    );
  }

  return (
    <span className="relative inline-block leading-none">
      <img
        src={displayUrl}
        className={className}
        alt={alt}
        title={isAssetUrl(url) ? `${title ?? ''}\n素材来源：${displayUrl}`.trim() : title}
        onError={() => setFailedUrl(url)}
        loading="lazy"
      />
      {isAssetUrl(url) && (
        <span className="absolute left-0.5 top-0.5 rounded bg-purple-600/90 px-1 py-px text-[9px] font-medium leading-tight text-white shadow-sm">
          素材
        </span>
      )}
    </span>
  );
};

export default AssetAwareImage;
