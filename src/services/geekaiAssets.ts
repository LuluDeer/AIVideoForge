import axios from 'axios';
import type { RuntimePlatform } from '../types';
import { readJsonStorage, writeJsonStorage } from '../utils/storage';
import { normalizeAxiosError } from './api/errorNormalizer';

export type GeekaiAssetKind = 'image' | 'video';

export interface GeekaiAssetCacheRecord {
  id: string;
  platformKey: string;
  kind: GeekaiAssetKind;
  sourceUrl: string;
  sourceFingerprint: string;
  assetUrl: string;
  assetId: string;
  name?: string;
  createdAt: number;
  updatedAt: number;
}

type AssetGroupResponse = { id?: string; data?: { id?: string } };
type AssetCreateResponse = { id?: string; task_id?: string; data?: { id?: string; task_id?: string } };
type AssetQueryResponse = {
  id?: string;
  status?: string;
  asset_type?: string;
  data?: {
    id?: string;
    status?: string;
    asset_type?: string;
  };
};

const ASSET_GROUP_CACHE = new Map<string, string>();
const GEEKAI_ASSET_CACHE_STORAGE_KEY = 'video_gen_geekai_asset_cache_v1';
const DEFAULT_ASSET_POLL_INTERVAL_MS = 2_000;
const DEFAULT_ASSET_POLL_ATTEMPTS = 30;
const VOLATILE_QUERY_PARAMS = new Set([
  'sign', 'signature', 'x-cos-signature', 'x-cos-security-token', 'x-cos-credential', 'x-cos-date',
  'x-cos-expires', 'x-cos-signedheaders', 'x-oss-signature', 'x-oss-security-token', 'x-oss-credential',
  'x-oss-date', 'x-oss-expires', 'x-oss-signature-version', 'x-oss-additional-headers', 'token', 'expires',
  'expire', 'timestamp', 'ts', 'auth_key', 'response-content-disposition', 'response-content-type',
]);

const getResponseId = (value: AssetGroupResponse | AssetCreateResponse): string | undefined => {
  const data = value.data as { id?: string; task_id?: string } | undefined;
  return value.id ?? data?.id ?? ('task_id' in value ? value.task_id : undefined) ?? data?.task_id;
};

const normalizeStatus = (status: string | undefined) => (status ?? '').toLowerCase();

const getGeekaiOrigin = (baseUrl: string): string => {
  try {
    const parsed = new URL(baseUrl);
    return parsed.origin;
  } catch {
    return 'https://geekai.co';
  }
};

const isGeekaiAssetCacheRecord = (value: unknown): value is GeekaiAssetCacheRecord => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<GeekaiAssetCacheRecord>;
  return typeof record.id === 'string'
    && typeof record.platformKey === 'string'
    && (record.kind === 'image' || record.kind === 'video')
    && typeof record.sourceUrl === 'string'
    && typeof record.sourceFingerprint === 'string'
    && typeof record.assetUrl === 'string'
    && typeof record.assetId === 'string'
    && typeof record.createdAt === 'number'
    && typeof record.updatedAt === 'number';
};

const isGeekaiAssetCacheRecordList = (value: unknown): value is GeekaiAssetCacheRecord[] => (
  Array.isArray(value) && value.every(isGeekaiAssetCacheRecord)
);

const loadAssetCache = (): GeekaiAssetCacheRecord[] => readJsonStorage(
  GEEKAI_ASSET_CACHE_STORAGE_KEY,
  [],
  isGeekaiAssetCacheRecordList,
);

const saveAssetCache = (records: GeekaiAssetCacheRecord[]) => {
  writeJsonStorage(GEEKAI_ASSET_CACHE_STORAGE_KEY, records.slice(0, 500));
};

const normalizeSourceUrlForCache = (sourceUrl: string): string => {
  const raw = sourceUrl.trim();
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    const stableParams = Array.from(parsed.searchParams.entries())
      .filter(([key]) => !VOLATILE_QUERY_PARAMS.has(key.toLowerCase()))
      .sort(([a], [b]) => a.localeCompare(b));
    parsed.search = '';
    stableParams.forEach(([key, value]) => parsed.searchParams.append(key, value));
    return parsed.toString();
  } catch {
    return raw;
  }
};

const getSourceFingerprint = (sourceUrl: string, kind: GeekaiAssetKind): string => `${kind}:${normalizeSourceUrlForCache(sourceUrl)}`;

const extractAssetId = (assetUrl: string): string => assetUrl.replace(/^asset:\/\//, '');

class GeekaiAssetService {
  private platform: RuntimePlatform;

  constructor(platform: RuntimePlatform) {
    this.platform = platform;
  }

  private get assetBaseUrl() {
    return getGeekaiOrigin(this.platform.baseUrl);
  }

  private get axiosInstance() {
    return axios.create({
      baseURL: this.assetBaseUrl,
      timeout: 60_000,
      headers: this.platform.apiKey ? { Authorization: `Bearer ${this.platform.apiKey}` } : undefined,
    });
  }

  get platformCacheKey() {
    return `${this.assetBaseUrl}|${this.platform.apiKey.slice(0, 8)}`;
  }

  getCachedAsset(sourceUrl: string, kind: GeekaiAssetKind): GeekaiAssetCacheRecord | null {
    const fingerprint = getSourceFingerprint(sourceUrl, kind);
    return loadAssetCache().find(record => record.platformKey === this.platformCacheKey && record.sourceFingerprint === fingerprint) ?? null;
  }

  getCachedAssetByAssetUrl(assetUrl: string, kind?: GeekaiAssetKind): GeekaiAssetCacheRecord | null {
    return loadAssetCache().find(record => record.platformKey === this.platformCacheKey
      && record.assetUrl === assetUrl
      && (!kind || record.kind === kind)) ?? null;
  }

  private saveAssetRecord(sourceUrl: string, kind: GeekaiAssetKind, assetUrl: string, name?: string): GeekaiAssetCacheRecord {
    const now = Date.now();
    const fingerprint = getSourceFingerprint(sourceUrl, kind);
    const existing = this.getCachedAsset(sourceUrl, kind);
    const record: GeekaiAssetCacheRecord = {
      id: existing?.id ?? `${now}-${Math.random().toString(36).slice(2, 8)}`,
      platformKey: this.platformCacheKey,
      kind,
      sourceUrl,
      sourceFingerprint: fingerprint,
      assetUrl,
      assetId: extractAssetId(assetUrl),
      name,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    saveAssetCache([record, ...loadAssetCache().filter(item => item.id !== record.id && (item.platformKey !== record.platformKey || item.sourceFingerprint !== fingerprint))]);
    return record;
  }

  private async ensureAssetGroup(): Promise<string> {
    const cached = ASSET_GROUP_CACHE.get(this.platformCacheKey);
    if (cached) return cached;

    try {
      const response = await this.axiosInstance.post<AssetGroupResponse>('/api/v1/assets/group', {
        name: `video-gen-${new Date().toISOString().slice(0, 10)}`,
        platform: 'bytedance',
      });
      const groupId = getResponseId(response.data);
      if (!groupId) throw new Error('素材组接口未返回 id');
      ASSET_GROUP_CACHE.set(this.platformCacheKey, groupId);
      return groupId;
    } catch (error) {
      throw normalizeAxiosError(error, '创建极客素材组失败');
    }
  }

  async createAssetFromUrl(url: string, kind: GeekaiAssetKind, name?: string): Promise<string> {
    const cached = this.getCachedAsset(url, kind);
    if (cached) return cached.assetUrl;

    const groupId = await this.ensureAssetGroup();
    const assetType = kind === 'image' ? 'Image' : 'Video';

    let taskId: string;
    try {
      const response = await this.axiosInstance.post<AssetCreateResponse>('/api/v1/assets/create', {
        group_id: groupId,
        name: name || `${assetType}-${Date.now()}`,
        url,
        asset_type: assetType,
        platform: 'bytedance',
      });
      const id = getResponseId(response.data);
      if (!id) throw new Error('创建素材接口未返回任务 id');
      taskId = id;
    } catch (error) {
      throw normalizeAxiosError(error, '创建极客自定义素材失败');
    }

    const assetUrl = await this.pollAsset(taskId);
    this.saveAssetRecord(url, kind, assetUrl, name);
    return assetUrl;
  }

  private async pollAsset(taskId: string): Promise<string> {
    for (let attempt = 0; attempt < DEFAULT_ASSET_POLL_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, DEFAULT_ASSET_POLL_INTERVAL_MS));
      }

      try {
        const response = await this.axiosInstance.get<AssetQueryResponse>(`/api/v1/assets/${encodeURIComponent(taskId)}`);
        const data = response.data.data ?? response.data;
        const status = normalizeStatus(data.status);
        const assetId = data.id;
        if ((status === 'succeed' || status === 'success' || status === 'completed') && assetId) {
          return `asset://${assetId}`;
        }
        if (status === 'failed' || status === 'fail' || status === 'error') {
          throw new Error('素材创建失败');
        }
      } catch (error) {
        if (attempt === DEFAULT_ASSET_POLL_ATTEMPTS - 1) {
          throw normalizeAxiosError(error, '查询极客自定义素材失败');
        }
      }
    }

    throw new Error('素材创建超时，请稍后重试');
  }
}

export default GeekaiAssetService;
