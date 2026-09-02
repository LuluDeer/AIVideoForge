import { useCallback, useState } from 'react';
import type { AppConfig, RuntimePlatform } from '../../types';
import ImageUploader from '../../services/imageUpload';
import CloudreveUploader from '../../services/cloudreveUpload';
import { getApiSafeMessage } from '../../services/api/errorNormalizer';
import { formatErrorWithAdvice } from '../../context/taskUtils';
import { logger } from '../../utils/logger';
import { validateImageFile, validateMediaFile } from './imageInput';

interface UseMediaUploadOptions {
  appConfig: AppConfig;
  platform?: RuntimePlatform;
  onError: (message: string) => void;
}

/**
 * 媒体文件上传（图片：base64 / Cloudreve / GeekAI CDN；视频/音频：GeekAI ck 上传）。
 * 每个字段实例持有自己的 uploadingKey，避免全局单值互相覆盖。
 */
export function useMediaUpload({ appConfig, platform, onError }: UseMediaUploadOptions) {
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const uploadMode = platform?.imageUploadMode ?? appConfig.imageUploadMode ?? 'geekai';

  const uploadImage = useCallback(async (file: File, paramKey?: string): Promise<string | null> => {
    const fileError = validateImageFile(file);
    if (fileError) {
      onError(fileError);
      return null;
    }
    if (uploadMode === 'base64') {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve((e.target?.result as string) ?? null);
        reader.onerror = () => {
          logger.warn('MediaUpload', '读取图片文件失败', reader.error);
          onError('读取图片文件失败，文件可能已被移动或无访问权限，请重试');
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    }
    if (uploadMode === 'cloudreve') {
      if (!appConfig.cloudreveApiKey.trim()) {
        onError('当前平台图片上传方式为 Cloudreve，但还没有填写 Cloudreve ApiKey。为避免调用存储接口，请到配置页填写 ApiKey，或将当前平台的图传方式改为 Base64 / 仅 URL。');
        return null;
      }
      if (paramKey) setUploadingKey(paramKey);
      const uploader = new CloudreveUploader({
        apiKey: appConfig.cloudreveApiKey,
        baseUrl: appConfig.cloudreveBaseUrl,
        tokenServer: appConfig.cloudreveTokenServer,
        remoteDir: appConfig.cloudreveRemoteDir,
      });
      try {
        const result = await uploader.uploadImage(file);
        return result ?? null;
      } catch (err) {
        logger.warn('MediaUpload', 'Cloudreve 图片上传失败', err);
        const detail = getApiSafeMessage(err, '服务未返回可用图片地址');
        onError(`图片上传失败：${formatErrorWithAdvice(detail, '重新上传图片')}。也可粘贴可公开访问的图片 URL。`);
        return null;
      } finally {
        if (paramKey) setUploadingKey(null);
      }
    }
    if (!appConfig.uploadCk.trim()) {
      onError('当前平台图片上传方式为 GeekAI CDN，但还没有填写上传 Cookie（ck）。为避免调用存储接口，请到配置页填写 ck，或将当前平台的图传方式改为 Base64 / 仅 URL。');
      return null;
    }
    if (paramKey) setUploadingKey(paramKey);
    const uploader = new ImageUploader(
      appConfig.uploadCk,
      platform?.imageUploadConfig ?? {},
    );
    try {
      const result = await uploader.uploadImage(file);
      return result?.url ?? null;
    } catch (err) {
      logger.warn('MediaUpload', '图片上传失败', err);
      const detail = getApiSafeMessage(err, '服务未返回可用图片地址');
      onError(`图片上传失败：${formatErrorWithAdvice(detail, '重新上传图片')}。也可粘贴可公开访问的图片 URL。`);
      return null;
    } finally {
      if (paramKey) setUploadingKey(null);
    }
  }, [appConfig, onError, platform?.imageUploadConfig, uploadMode]);

  const uploadMediaFile = useCallback(async (file: File, kind: 'video' | 'audio', paramKey: string): Promise<string | null> => {
    const fileError = validateMediaFile(file, kind);
    if (fileError) {
      onError(fileError);
      return null;
    }
    if (!appConfig.uploadCk.trim()) {
      onError('当前平台需要上传视频/音频到 GeekAI CDN，但还没有填写上传 Cookie（ck）。已停止上传且不会调用存储接口；请到配置页填写 ck，或直接粘贴公开 URL。');
      return null;
    }
    const itemKey = `${paramKey}:upload`;
    setUploadingKey(itemKey);
    const uploader = new ImageUploader(
      appConfig.uploadCk,
      platform?.imageUploadConfig ?? {},
    );
    try {
      const result = await uploader.uploadFile(file, kind);
      return result?.url ?? null;
    } catch (err) {
      logger.warn('MediaUpload', `${kind === 'video' ? '视频' : '音频'}上传失败`, err);
      const detail = getApiSafeMessage(err, '服务未返回可用附件地址');
      onError(`${kind === 'video' ? '视频' : '音频'}上传失败：${formatErrorWithAdvice(detail, '重新上传文件，或粘贴可公开访问的 URL')}`);
      return null;
    } finally {
      setUploadingKey(null);
    }
  }, [appConfig, onError, platform?.imageUploadConfig]);

  return { uploadImage, uploadMediaFile, uploadingKey, uploadMode };
}
