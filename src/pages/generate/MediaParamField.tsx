import React, { useCallback, useState } from 'react';
import { Loader2, Plus, X, Copy } from 'lucide-react';
import type { AppConfig, ParamDef, RuntimePlatform } from '../../types';
import GeekaiAssetService, { type GeekaiAssetKind } from '../../services/geekaiAssets';
import { getApiSafeMessage } from '../../services/api/errorNormalizer';
import { formatErrorWithAdvice } from '../../context/taskUtils';
import { logger } from '../../utils/logger';
import { MAX_IMAGE_URL_LENGTH, isAssetUrl, normalizeImageUrl, normalizeMediaUrl } from './imageInput';
import { useMediaUpload } from './useMediaUpload';

interface MediaParamFieldProps {
  def: ParamDef;
  value: unknown;
  onChange: (value: unknown) => void;
  appConfig: AppConfig;
  platform?: RuntimePlatform;
  supportsGeekaiAsset: boolean;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const shortenAssetUrl = (assetUrl: string) => (assetUrl.length > 30 ? `${assetUrl.slice(0, 18)}...${assetUrl.slice(-8)}` : assetUrl);

/**
 * 媒体参考参数控件（image / image-multi / video / audio 及其 multi 变体）：
 * 文件上传、URL/asset:// 粘贴、极客素材转换与预览均自包含，上传/转换状态为字段级。
 */
const MediaParamField: React.FC<MediaParamFieldProps> = ({ def, value, onChange, appConfig, platform, supportsGeekaiAsset, onError, onSuccess }) => {
  const { uploadImage, uploadMediaFile, uploadingKey, uploadMode } = useMediaUpload({ appConfig, platform, onError });
  const [assetConvertingKey, setAssetConvertingKey] = useState<string | null>(null);
  const [copiedAssetUrl, setCopiedAssetUrl] = useState<string | null>(null);

  const copyAssetUrl = useCallback(async (assetUrl: string) => {
    try {
      if (!navigator.clipboard) throw new Error('当前环境不支持剪贴板写入');
      await navigator.clipboard.writeText(assetUrl);
      setCopiedAssetUrl(assetUrl);
      onSuccess(`已复制素材链接：${assetUrl}`);
      setTimeout(() => setCopiedAssetUrl(null), 2000);
    } catch (err) {
      logger.warn('MediaParamField', '复制素材链接失败', err);
      onError('复制失败，请手动选中 asset:// 链接复制。');
    }
  }, [onError, onSuccess]);

  const getCachedGeekaiAssetByAssetUrl = useCallback((assetUrl: string, kind?: GeekaiAssetKind) => {
    if (!platform || !supportsGeekaiAsset) return null;
    return new GeekaiAssetService(platform).getCachedAssetByAssetUrl(assetUrl, kind);
  }, [platform, supportsGeekaiAsset]);

  const renderAssetInfo = (assetUrl: string) => (
    <div className="mt-1 flex max-w-full items-center gap-1 rounded bg-purple-50 px-1.5 py-1 text-[11px] text-purple-700" title={assetUrl}>
      <span className="min-w-0 flex-1 truncate font-mono">{shortenAssetUrl(assetUrl)}</span>
      <button
        type="button"
        onClick={() => copyAssetUrl(assetUrl)}
        className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 font-medium hover:bg-purple-100"
      >
        <Copy className="h-3 w-3" />
        {copiedAssetUrl === assetUrl ? '已复制' : '复制'}
      </button>
    </div>
  );

  const handleConvertToGeekaiAsset = useCallback(async (
    currentUrl: string,
    kind: GeekaiAssetKind,
    applyAssetUrl: (assetUrl: string) => void,
    itemKey = def.key,
  ) => {
    if (!platform) {
      onError('请先选择极客平台并配置 API Key。');
      return;
    }
    if (!supportsGeekaiAsset) {
      onError('当前平台不支持极客自定义素材接口，请切换到 GeekAI / 极客智坊平台。');
      return;
    }
    if (isAssetUrl(currentUrl)) {
      onSuccess('当前素材已经是 asset:// 格式，无需重复转换。');
      return;
    }
    if (currentUrl.startsWith('data:')) {
      onError('极客素材接口需要可公开访问的图片/视频 URL。请先上传图片获取 URL，或粘贴公开视频 URL 后再转素材。');
      return;
    }

    setAssetConvertingKey(itemKey);
    try {
      const service = new GeekaiAssetService(platform);
      const cachedAsset = service.getCachedAsset(currentUrl, kind);
      const assetUrl = cachedAsset?.assetUrl ?? await service.createAssetFromUrl(currentUrl, kind, `${def.label}-${Date.now()}`);
      applyAssetUrl(assetUrl);
      onSuccess(`${cachedAsset ? '已复用本地素材缓存' : '已转换为极客自定义素材'}：${assetUrl}`);
      setTimeout(() => onSuccess(''), 6000);
    } catch (err) {
      logger.warn('MediaParamField', '转极客素材失败', err);
      const detail = getApiSafeMessage(err, '素材接口未返回可用素材 ID');
      onError(`转极客素材失败：${formatErrorWithAdvice(detail, '确认 URL 可公开访问，或稍后重试')}`);
    } finally {
      setAssetConvertingKey(null);
    }
  }, [def.key, def.label, onError, onSuccess, platform, supportsGeekaiAsset]);

  const showUrlSuffixHint = () => {
    onSuccess('已添加图片 URL。未识别常见图片后缀，如签名 URL 无法生成，请确认该地址可公开访问。');
    setTimeout(() => onSuccess(''), 5000);
  };

  const renderImagePreview = (url: string, className: string) => {
    if (isAssetUrl(url)) {
      const cachedAsset = getCachedGeekaiAssetByAssetUrl(url, 'image');
      if (cachedAsset?.sourceUrl && !cachedAsset.sourceUrl.startsWith('data:')) {
        return (
          <div className="relative" title={`${url}\n来源：${cachedAsset.sourceUrl}`}>
            <img src={cachedAsset.sourceUrl} className={className} alt="" />
            <span className="absolute left-1 top-1 rounded bg-purple-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm">
              已转素材
            </span>
          </div>
        );
      }
      return (
        <div className={`${className} flex items-center justify-center rounded border bg-purple-50 px-2 text-center text-[11px] font-medium text-purple-700`} title={url}>
          已转素材
        </div>
      );
    }
    return <img src={url} className={className} alt="" />;
  };

  if (def.type === 'image' || def.type === 'image-multi') {
    const isUploading = uploadingKey === def.key;

    if (def.type === 'image-multi') {
      const urls = Array.isArray(value) ? (value as string[]) : [];
      const limits = def.imageLimits;
      return (
        <div key={def.key} className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="block text-sm font-medium text-gray-700">{def.label}</label>
            {supportsGeekaiAsset && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">可转极客素材</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {urls.map((url, idx) => (
              <div key={idx} className="relative w-24 rounded border bg-white p-1 shadow-sm">
                {renderImagePreview(url, 'h-20 w-full object-cover rounded')}
                <button
                  onClick={() => onChange(urls.filter((_, i) => i !== idx))}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
                {supportsGeekaiAsset && !isAssetUrl(url) && !url.startsWith('data:') && (
                  <button
                    type="button"
                    onClick={() => handleConvertToGeekaiAsset(url, 'image', (assetUrl: string) => onChange(urls.map((item, i) => i === idx ? assetUrl : item)), `${def.key}:${idx}`)}
                    disabled={assetConvertingKey === `${def.key}:${idx}`}
                    className="mt-1 flex w-full items-center justify-center gap-1 rounded bg-purple-600 px-1.5 py-1 text-[11px] font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                    title="调用极客自定义素材接口，将该图片 URL 转为 asset://素材ID"
                  >
                    {assetConvertingKey === `${def.key}:${idx}` ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    转素材
                  </button>
                )}
              </div>
            ))}
            {uploadMode !== 'url' && (!limits?.max || urls.length < limits.max) && (
              <label className={`w-20 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer ${
                isUploading ? 'border-blue-300 bg-blue-50 text-blue-400' : 'border-gray-300 hover:border-blue-400 text-gray-400'
              }`}>
                {isUploading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><Plus className="w-5 h-5" /><span className="text-xs mt-1">上传</span></>}
                <input type="file" accept="image/*" className="hidden" disabled={isUploading} onChange={async e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = await uploadImage(f, def.key);
                  if (url) onChange([...urls, url]);
                  e.target.value = '';
                }} />
              </label>
            )}
          </div>

          <p className="text-xs text-gray-400">
            支持上传或粘贴 http(s) 图片 URL / asset://素材ID 后按 Enter 添加；CDN/OSS/COS 签名 URL 无需图片后缀。
            {limits?.max ? ` 最多 ${limits.max} 张。` : ''}
          </p>
          <input
            type="text"
            placeholder={`粘贴图片 URL 或 asset://素材ID 后按回车添加${limits?.max ? `（最多${limits.max}张）` : ''}...`}
            className="w-full min-h-10 rounded-lg border border-gray-200 px-3 py-2 text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-blue-100"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const input = e.target as HTMLInputElement;
                const val = normalizeImageUrl(input.value);
                if (!val) {
                  onError(`请输入非空的 http(s) 图片 URL，长度不超过 ${MAX_IMAGE_URL_LENGTH} 个字符`);
                  return;
                }
                if (!limits?.max || urls.length < limits.max) {
                  onChange([...urls, val.url]);
                  if (!val.hasCommonImageExt) showUrlSuffixHint();
                  input.value = '';
                }
              }
            }}
          />
          {isUploading && <p className="text-xs text-blue-500">上传中...</p>}
        </div>
      );
    }

    const url = typeof value === 'string' && value ? value : undefined;
    return (
      <div key={def.key} className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700">{def.label}</label>
          {supportsGeekaiAsset && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">可转极客素材</span>}
        </div>
        {url ? (
          <div className="inline-flex flex-col gap-1 rounded border bg-white p-1 shadow-sm">
            <div className="relative">
              {renderImagePreview(url, 'w-32 h-20 object-cover rounded')}
              <button
                onClick={() => onChange(undefined)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {isAssetUrl(url) && renderAssetInfo(url)}
            {supportsGeekaiAsset && !isAssetUrl(url) && !url.startsWith('data:') && (
              <button
                type="button"
                onClick={() => handleConvertToGeekaiAsset(url, 'image', (assetUrl: string) => onChange(assetUrl))}
                disabled={assetConvertingKey === def.key}
                className="inline-flex min-h-7 items-center justify-center gap-1 rounded bg-purple-600 px-2 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-60"
                title="调用极客自定义素材接口，将该图片 URL 转为 asset://素材ID"
              >
                {assetConvertingKey === def.key ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                转极客素材
              </button>
            )}
          </div>
        ) : uploadMode !== 'url' ? (
          <label className={`w-32 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer ${
            isUploading ? 'border-blue-300 bg-blue-50 text-blue-400' : 'border-gray-300 hover:border-blue-400 text-gray-400'
          }`}>
            {isUploading
              ? <><Loader2 className="w-5 h-5 animate-spin" /><span className="text-xs mt-1">上传中</span></>
              : <><Plus className="w-6 h-6" /><span className="text-xs mt-1">上传图片</span></>}
            <input type="file" accept="image/*" className="hidden" disabled={isUploading} onChange={async e => {
              const f = e.target.files?.[0];
              if (!f) return;
              const u = await uploadImage(f, def.key);
              if (u) onChange(u);
              e.target.value = '';
            }} />
          </label>
        ) : null}
        <input type="text" placeholder="粘贴图片 URL 或 asset://素材ID 后按回车..."
          className="w-full min-h-10 rounded-lg border border-gray-200 px-3 py-2 text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-blue-100"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const input = e.target as HTMLInputElement;
              const val = normalizeImageUrl(input.value);
              if (!val) {
                onError(`请输入非空的 http(s) 图片 URL，长度不超过 ${MAX_IMAGE_URL_LENGTH} 个字符`);
                return;
              }
              onChange(val.url);
              if (!val.hasCommonImageExt) showUrlSuffixHint();
              input.value = '';
            }
          }} />
        {isUploading && <p className="text-xs text-blue-500">上传中...</p>}
      </div>
    );
  }

  // video / audio（含 multi 变体）
  const isMulti = def.type === 'video-multi' || def.type === 'audio-multi';
  const mediaKind = def.type === 'video' || def.type === 'video-multi' ? 'video' : 'audio';
  const accept = mediaKind === 'video' ? 'video/*' : 'audio/*';
  const mediaName = mediaKind === 'video' ? '视频' : '音频';
  const limits = def.imageLimits;
  const values = isMulti
    ? (Array.isArray(value) ? (value as string[]) : [])
    : (typeof value === 'string' && value ? [value] : []);
  const updateValues = (next: string[]) => onChange(isMulti ? next : next[0]);
  const isUploadingMedia = uploadingKey === `${def.key}:upload`;

  return (
    <div key={def.key} className="space-y-2 min-w-64 flex-1">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium text-gray-700">{def.label}</label>
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">需 ck 上传获取URL</span>
        {mediaKind === 'video' && supportsGeekaiAsset && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700">可转极客素材</span>}
      </div>
      {values.length > 0 && (
        <div className="space-y-2">
          {values.map((url, idx) => (
            <div key={`${url}-${idx}`} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <span className="min-w-0 flex-1 truncate" title={url}>{url.startsWith('data:') ? `${mediaName}文件（Data URL）` : url}</span>
              {mediaKind === 'video' && supportsGeekaiAsset && !isAssetUrl(url) && !url.startsWith('data:') && (
                <button
                  type="button"
                  onClick={() => handleConvertToGeekaiAsset(url, 'video', (assetUrl: string) => updateValues(values.map((item, i) => i === idx ? assetUrl : item)), `${def.key}:${idx}`)}
                  disabled={assetConvertingKey === `${def.key}:${idx}`}
                  className="inline-flex min-h-7 items-center gap-1 rounded bg-purple-50 px-2 font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-60"
                  title="调用极客自定义素材接口，将该视频 URL 转为 asset://素材ID"
                >
                  {assetConvertingKey === `${def.key}:${idx}` ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  转素材
                </button>
              )}
              <button
                type="button"
                onClick={() => updateValues(values.filter((_, i) => i !== idx))}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600"
                title={`移除该${mediaName}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {(!limits?.max || values.length < limits.max) && (
        <div className="flex flex-wrap gap-2">
          <label className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm ${
            isUploadingMedia ? 'border-blue-300 bg-blue-50 text-blue-500' : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600'
          }`}>
            {isUploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{isUploadingMedia ? `上传${mediaName}中` : `上传${mediaName}获取URL`}</span>
            <input type="file" accept={accept} className="hidden" disabled={isUploadingMedia} onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const uploadedUrl = await uploadMediaFile(file, mediaKind, def.key);
              if (uploadedUrl) updateValues([...values, uploadedUrl]);
              e.target.value = '';
            }} />
          </label>
        </div>
      )}
      <input
        type="text"
        placeholder={`粘贴 http(s) ${mediaName} URL 或 asset://素材ID 后按回车添加${limits?.max ? `（最多${limits.max}个）` : ''}...`}
        className="w-full min-h-10 rounded-lg border border-gray-200 px-3 py-2 text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-blue-100"
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const input = e.target as HTMLInputElement;
            const val = normalizeMediaUrl(input.value);
            if (!val) {
              onError(`请输入非空的 http(s) ${mediaName} URL。`);
              return;
            }
            if (!limits?.max || values.length < limits.max) {
              updateValues([...values, val]);
              input.value = '';
            }
          }
        }}
      />
      <p className="text-xs text-gray-400">
        支持粘贴公开 URL 或 asset://素材ID；本地视频/音频会复用 GeekAI 附件上传流程，上传到 COS 后写入可公开访问 URL。
        {mediaKind === 'video' && supportsGeekaiAsset ? ' 视频 URL 添加后可点击“转素材”生成 asset://素材ID。' : ''}
        {limits?.max ? ` 最多 ${limits.max} 个。` : ''}
      </p>
    </div>
  );
};

export default MediaParamField;
