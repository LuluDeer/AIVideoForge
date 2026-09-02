/**
 * Cloudreve 上传服务
 *
 * 参考 upload_with_direct_link.py 脚本实现：
 *  - 使用本地令牌服务的 api_key 换取 refresh_token
 *  - 使用 refresh_token 铸 access_token
 *  - 自动发现存储策略（不传 policy_id 时）
 *  - 调用 Cloudreve v4 API 上传图片并转直链
 *
 * 基础 URL、令牌服务器和远端目录通过 AppConfig 配置，不再硬编码。
 */

import { md5HexAsync } from '../utils/md5Async';
import { DEFAULT_CLOUDREVE_BASE_URL, DEFAULT_CLOUDREVE_TOKEN_SERVER, DEFAULT_CLOUDREVE_REMOTE_DIR } from './configSchema';

const REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 60_000;
const UPLOAD_RETRY_MAX = 3;
const UPLOAD_RETRY_DELAY_MS = 1_000;

interface CloudreveSession {
  session_id?: string;
  id?: string;
  chunk_size?: number;
  upload_urls?: string[];
  completeURL?: string;
  complete_url?: string;
  callback_secret?: string;
  policy_type?: string;
  storage_policy?: { type?: string };
}

interface CloudreveTokenResponse {
  code?: number;
  refresh_token?: string;
}

interface CloudreveRefreshResponse {
  code?: number;
  access_token?: string;
  refresh_token?: string;
}

interface CloudreveSourceItem {
  link?: string;
}

const MD5_EMBED_PATTERN = /^(.+)\.([0-9a-f]{32})(\.[^.]+)?$/;

function extractMd5(name: string): string {
  const match = MD5_EMBED_PATTERN.exec(name);
  return match ? match[2] : '';
}

export class CloudreveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudreveError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function getData(response: unknown): unknown {
  if (isRecord(response) && isRecord(response.data)) return response.data;
  if (isRecord(response) && 'data' in response) return response.data;
  return response;
}

async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const timeout = options.timeout ?? REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function requestJson<T>(apiBase: string, path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${apiBase.replace(/\/+$/, '')}/api/v4${path}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };
  const response = await fetchWithTimeout(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body,
  });
  const contentType = response.headers.get('content-type') ?? '';
  let data: unknown;
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
    if (isRecord(data) && typeof data.code === 'number' && data.code !== 0) {
      throw new CloudreveError(JSON.stringify(data));
    }
  } else {
    if (!response.ok) throw new CloudreveError(`HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
    data = await response.text();
  }
  return data as T;
}

export class CloudreveUploader {
  private apiKey: string;
  private baseUrl: string;
  private tokenServer: string;
  private remoteDir: string;
  private accessToken: string | null = null;

  constructor(options: {
    apiKey: string;
    baseUrl?: string;
    tokenServer?: string;
    remoteDir?: string;
  }) {
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl || DEFAULT_CLOUDREVE_BASE_URL).replace(/\/+$/, '');
    this.tokenServer = (options.tokenServer || DEFAULT_CLOUDREVE_TOKEN_SERVER).replace(/\/+$/, '');
    this.remoteDir = (options.remoteDir || DEFAULT_CLOUDREVE_REMOTE_DIR).replace(/\/+$/, '');
  }

  /** 携带当前实例 baseUrl 的 requestJson 快捷方式 */
  private api<T>(path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<T> {
    return requestJson<T>(this.baseUrl, path, options);
  }

  private async fetchRefreshToken(): Promise<string> {
    const url = `${this.tokenServer}/token`;
    const response = await fetchWithTimeout(url, { headers: { 'X-API-Key': this.apiKey } });
    if (response.status === 401) {
      throw new CloudreveError('Cloudreve 令牌服务鉴权失败：api_key 不正确');
    }
    if (!response.ok) {
      throw new CloudreveError(`Cloudreve 令牌服务 HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    const data = (await response.json().catch(() => null)) as CloudreveTokenResponse | null;
    if (!data?.refresh_token) {
      throw new CloudreveError('Cloudreve 令牌服务未返回 refresh_token');
    }
    return data.refresh_token;
  }

  private async ensureAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    const refreshToken = await this.fetchRefreshToken();
    const data = getData(await this.api<CloudreveRefreshResponse>(
      '/session/token/refresh',
      { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }), headers: { 'Content-Type': 'application/json' } },
    )) as CloudreveRefreshResponse | null;
    if (!data?.access_token) throw new CloudreveError('Cloudreve 刷新 token 失败');
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  private async fileInfo(uri: string, token: string): Promise<unknown> {
    return getData(await this.api(
      `/file?uri=${encodeURIComponent(uri)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ));
  }

  private async findRemoteByMd5(remoteDir: string, md5: string, token: string): Promise<string | null> {
    // Cloudreve v4 的 name 过滤语法：在 uri 值内追加 ?name=<md5>（与 upload_with_direct_link.py 一致）
    const data = getData(await this.api(
      `/file?uri=${encodeURIComponent(`${remoteDir.replace(/\/+$/, '')}?name=${md5}`)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ));
    const files = isRecord(data) && Array.isArray(data.files) ? data.files : [];
    for (const entry of files) {
      if (isRecord(entry) && extractMd5(String(entry.name ?? '')) === md5) {
        return String(entry.path ?? '');
      }
    }
    return null;
  }

  private async getSourceLink(uri: string, token: string): Promise<string | null> {
    const sourceData = getData(await this.api<CloudreveSourceItem[]>('/file/source', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri] }),
    }));
    const items = Array.isArray(sourceData) ? sourceData : [];
    return items[0]?.link ?? null;
  }

  private walkFindPolicy(value: unknown): { id?: unknown; type?: unknown } | null {
    if (Array.isArray(value)) {
      for (const child of value) {
        const found = this.walkFindPolicy(child);
        if (found) return found;
      }
      return null;
    }
    if (!isRecord(value)) return null;
    if ('id' in value && 'type' in value) {
      const hasPolicyKeys = ['chunk_size', 'max_size', 'relay'].some(key => key in value);
      const isStringType = typeof value.type === 'string' && !/^\d+$/.test(value.type);
      if (hasPolicyKeys || isStringType) {
        return { id: value.id, type: value.type };
      }
    }
    for (const child of Object.values(value)) {
      const found = this.walkFindPolicy(child);
      if (found) return found;
    }
    return null;
  }

  private async discoverPolicyId(remoteDir: string, token: string): Promise<string | undefined> {
    for (const uri of [remoteDir, 'cloudreve://my']) {
      try {
        const data = await this.fileInfo(uri, token);
        const policy = this.walkFindPolicy(data);
        if (policy && policy.id !== undefined) return String(policy.id);
      } catch {
        // 目录不存在或不可访问时跳过，继续尝试下一个候选
      }
    }
    return undefined;
  }

  private async createUploadSession(remoteUri: string, fileSize: number, mimeType: string, policyId?: string): Promise<CloudreveSession> {
    const token = await this.ensureAccessToken();
    const data = getData(await this.api<CloudreveSession>('/file/upload', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uri: remoteUri,
        size: fileSize,
        mime_type: mimeType,
        ...(policyId ? { policy_id: policyId } : {}),
      }),
    }));
    const session = (isRecord(data) ? data : {}) as CloudreveSession;
    const sessionId = session.session_id ?? session.id;
    if (!sessionId) throw new CloudreveError('Cloudreve 上传会话创建失败');
    return session;
  }

  private async uploadChunk(sessionId: string, index: number, chunk: ArrayBuffer, token: string): Promise<void> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= UPLOAD_RETRY_MAX; attempt++) {
      try {
        const response = await fetchWithTimeout(`${this.baseUrl}/api/v4/file/upload/${encodeURIComponent(sessionId)}/${index}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
          },
          body: chunk,
          timeout: UPLOAD_TIMEOUT_MS,
        });
        if (!response.ok) throw new CloudreveError(`分块 ${index} 上传失败：HTTP ${response.status}`);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < UPLOAD_RETRY_MAX) {
          await new Promise(resolve => setTimeout(resolve, UPLOAD_RETRY_DELAY_MS * attempt));
        }
      }
    }
    throw lastError ?? new CloudreveError(`分块 ${index} 上传失败（重试 ${UPLOAD_RETRY_MAX} 次后放弃）`);
  }

  private async createRemoteDirs(remoteFileUri: string, token: string): Promise<void> {
    const prefix = 'cloudreve://';
    if (!remoteFileUri.startsWith(prefix)) throw new CloudreveError(`无效的 Cloudreve URI: ${remoteFileUri}`);
    const parts = remoteFileUri.slice(prefix.length).split('/');
    let current = `${prefix}${parts[0]}`;
    for (const part of parts.slice(1, -1)) {
      if (!part) continue;
      current += `/${part}`;
      try {
        await this.api('/file/create', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ uri: current, type: 'folder' }),
        });
      } catch {
        // 文件夹已存在时忽略
      }
    }
  }

  async uploadImage(file: File): Promise<string> {
    if (!file) throw new CloudreveError('请选择有效的图片文件');
    if (!file.type.startsWith('image/')) throw new CloudreveError('仅支持图片文件上传到 Cloudreve');
    if (file.size <= 0) throw new CloudreveError('图片文件为空');
    if (file.size > 15 * 1024 * 1024) throw new CloudreveError('图片过大，请选择 15MB 以内的图片');

    const token = await this.ensureAccessToken();
    const buffer = await file.arrayBuffer();
    const md5 = await md5HexAsync(buffer);
    const dotIndex = file.name.lastIndexOf('.');
    const ext = dotIndex >= 0 ? file.name.slice(dotIndex) : '.png';
    const baseName = dotIndex > 0 ? file.name.slice(0, dotIndex) : 'image';
    const remoteName = `${baseName}.${md5}${ext}`;
    const remoteDir = this.remoteDir.replace(/\/+$/, '');
    const remoteUri = `${remoteDir}/${encodeURIComponent(remoteName)}`;

    const existingPath = await this.findRemoteByMd5(remoteDir, md5, token);
    if (existingPath) {
      const existingLink = await this.getSourceLink(existingPath, token);
      if (existingLink) return existingLink;
    }

    await this.createRemoteDirs(remoteUri, token);
    const policyId = await this.discoverPolicyId(remoteDir, token);
    const session = await this.createUploadSession(remoteUri, buffer.byteLength, file.type || 'application/octet-stream', policyId);
    const sessionId = session.session_id ?? session.id ?? '';

    const chunkSize = Math.max(1, Number(session.chunk_size) || buffer.byteLength || 1);
    for (let offset = 0, index = 0; offset < buffer.byteLength; offset += chunkSize, index++) {
      const chunk = buffer.slice(offset, Math.min(offset + chunkSize, buffer.byteLength));
      await this.uploadChunk(sessionId, index, chunk, token);
    }

    const link = await this.getSourceLink(remoteUri, token);
    if (!link) throw new CloudreveError('Cloudreve 上传成功但未生成直链');
    return link;
  }
}

export default CloudreveUploader;