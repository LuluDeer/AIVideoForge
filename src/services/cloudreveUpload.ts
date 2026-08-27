/**
 * Cloudreve 上传服务（增强版）
 * - 支持从 appConfig 传入 baseUrl / tokenServer（默认空，需在设置中配置）
 * - 使用 utils/md5.ts 中的 md5Hex
 * - 对请求与分块上传增加重试/backoff
 */

import { md5Hex } from '../utils/md5';

const DEFAULT_CLOUDREVE_BASE_URL = ""; // default empty: require explicit config for production
const DEFAULT_CLOUDREVE_TOKEN_SERVER = "";

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
  return match ? match[2] : "";
}

export class CloudreveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudreveError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function getData(response: unknown): unknown {
  if (isRecord(response) && isRecord(response.data)) return response.data;
  if (isRecord(response) && "data" in response) return (response as any).data;
  return response;
}

async function requestJsonWithRetry<T>(baseUrl: string, path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}, retries = 3): Promise<T> {
  const url = path.startsWith("http") ? path : `${baseUrl.replace(/\/+$/, "")}/api/v4${path}`;
  let attempt = 0;
  while (true) {
    attempt++;
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers ?? { Accept: "application/json" },
      body: options.body,
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok && (response.status === 401 || response.status === 403)) {
      const txt = await response.text().catch(() => "");
      throw new CloudreveError(`HTTP ${response.status}: ${txt.slice(0, 500)}`);
    }
    if (!response.ok && attempt <= retries) {
      // transient error, retry with backoff
      await new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt)));
      continue;
    }
    if (!contentType.includes("application/json")) {
      if (!response.ok) throw new CloudreveError(`HTTP ${response.status}: ${(await response.text()).slice(0,500)}`);
      return (await response.text()) as unknown as T;
    }
    const data = await response.json().catch(() => null);
    if (isRecord(data) && typeof (data as any).code === "number" && (data as any).code !== 0) {
      throw new CloudreveError(JSON.stringify(data));
    }
    return data as T;
  }
}

export class CloudreveUploader {
  private apiKey: string;
  private accessToken: string | null = null;
  private baseUrl: string;
  private tokenServer: string;

  constructor(apiKey: string, options?: { baseUrl?: string; tokenServer?: string }) {
    this.apiKey = apiKey.trim();
    this.baseUrl = (options?.baseUrl ?? DEFAULT_CLOUDREVE_BASE_URL).replace(/\/+$/, "");
    this.tokenServer = options?.tokenServer ?? DEFAULT_CLOUDREVE_TOKEN_SERVER;
  }

  private async fetchRefreshToken(): Promise<string> {
    const url = `${this.tokenServer.replace(/\/+$/, "")}/token`;
    if (!this.tokenServer) throw new CloudreveError('Cloudreve token server 未配置');
    const response = await fetch(url, { headers: { "X-API-Key": this.apiKey } });
    if (response.status === 401) {
      throw new CloudreveError("Cloudreve 令牌服务鉴权失败：api_key 不正确");
    }
    if (!response.ok) {
      throw new CloudreveError(`Cloudreve 令牌服务 HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    const data = (await response.json().catch(() => null)) as CloudreveTokenResponse | null;
    if (!data?.refresh_token) {
      throw new CloudreveError("Cloudreve 令牌服务未返回 refresh_token");
    }
    return data.refresh_token;
  }

  private async ensureAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    const refreshToken = await this.fetchRefreshToken();
    const data = getData(await requestJsonWithRetry(this.baseUrl || '', "/session/token/refresh", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) }, 2)) as CloudreveRefreshResponse | null;
    if (!data?.access_token) throw new CloudreveError("Cloudreve 刷新 token 失败");
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  private async fileInfo(uri: string, token: string): Promise<unknown> {
    return getData(await requestJsonWithRetry(this.baseUrl || '', `/file?uri=${encodeURIComponent(uri)}`, { headers: { Authorization: `Bearer ${token}` } }, 2));
  }

  private async findRemoteByMd5(remoteDir: string, md5: string, token: string): Promise<string | null> {
    const data = getData(await requestJsonWithRetry(this.baseUrl || '', `/file?uri=${encodeURIComponent(`${remoteDir.replace(/\/+$/, "")}?name=${md5}`)}`, { headers: { Authorization: `Bearer ${token}` } }, 2));
    const files = isRecord(data) && Array.isArray((data as any).files) ? (data as any).files : [];
    for (const entry of files) {
      if (isRecord(entry) && extractMd5(String((entry as any).name ?? "")) === md5) {
        return String((entry as any).path ?? "");
      }
    }
    return null;
  }

  private async getSourceLink(uri: string, token: string): Promise<string | null> {
    const sourceData = getData(await requestJsonWithRetry(this.baseUrl || '', "/file/source", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [uri] }),
    }, 2));
    const items = Array.isArray(sourceData) ? sourceData as any[] : [];
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
    if ("id" in value && "type" in value) {
      const hasPolicyKeys = ["chunk_size", "max_size", "relay"].some(key => key in value);
      const isStringType = typeof (value as any).type === "string" && !/^\d+$/.test((value as any).type);
      if (hasPolicyKeys || isStringType) {
        return { id: (value as any).id, type: (value as any).type };
      }
    }
    for (const child of Object.values(value)) {
      const found = this.walkFindPolicy(child);
      if (found) return found;
    }
    return null;
  }

  private async discoverPolicyId(remoteDir: string, token: string): Promise<string | undefined> {
    for (const uri of [remoteDir, "cloudreve://my"]) {
      try {
        const data = await this.fileInfo(uri, token);
        const policy = this.walkFindPolicy(data);
        if (policy && policy.id !== undefined) return String(policy.id);
      } catch {
        // skip
      }
    }
    return undefined;
  }

  private async createUploadSession(remoteUri: string, fileSize: number, mimeType: string, policyId?: string): Promise<CloudreveSession> {
    const token = await this.ensureAccessToken();
    const data = getData(await requestJsonWithRetry(this.baseUrl || '', "/file/upload", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uri: remoteUri,
        size: fileSize,
        mime_type: mimeType,
        ...(policyId ? { policy_id: policyId } : {}),
      }),
    }, 2));
    const session = (isRecord(data) ? data : {}) as CloudreveSession;
    const sessionId = session.session_id ?? session.id;
    if (!sessionId) throw new CloudreveError("Cloudreve 上传会话创建失败");
    return session;
  }

  private async uploadChunk(sessionId: string, index: number, chunk: ArrayBuffer, token: string): Promise<void> {
    const maxChunkRetries = 3;
    let attempt = 0;
    while (true) {
      attempt++;
      const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/api/v4/file/upload/${encodeURIComponent(sessionId)}/${index}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
        },
        body: chunk,
      });
      if (response.ok) return;
      if (attempt >= maxChunkRetries) throw new CloudreveError(`分块 ${index} 上传失败：HTTP ${response.status}`);
      // retry backoff
      await new Promise(r => setTimeout(r, 150 * attempt));
    }
  }

  private async createRemoteDirs(remoteFileUri: string, token: string): Promise<void> {
    const prefix = "cloudreve://";
    if (!remoteFileUri.startsWith(prefix)) throw new CloudreveError(`无效的 Cloudreve URI: ${remoteFileUri}`);
    const parts = remoteFileUri.slice(prefix.length).split("/");
    let current = `${prefix}${parts[0]}`;
    for (const part of parts.slice(1, -1)) {
      if (!part) continue;
      current += `/${part}`;
      try {
        await requestJsonWithRetry(this.baseUrl || '', "/file/create", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ uri: current, type: "folder" }),
        }, 2);
      } catch (err) {
        // if folder exists or transient issue, ignore; otherwise surface later
      }
    }
  }

  async uploadImage(file: File): Promise<string> {
    if (!file) throw new CloudreveError("请选择有效的图片文件");
    if (!file.type.startsWith("image/")) throw new CloudreveError("仅支持图片文件上传到 Cloudreve");
    if (file.size <= 0) throw new CloudreveError("图片文件为空");
    if (file.size > 15 * 1024 * 1024) throw new CloudreveError("图片过大，请选择 15MB 以内的图片");

    if (!this.baseUrl) {
      // allow token server only flows for discovery, but API calls require baseUrl
    }

    const token = await this.ensureAccessToken();
    const buffer = await file.arrayBuffer();
    const md5 = await md5Hex(buffer);
    const dotIndex = file.name.lastIndexOf(".");
    const ext = dotIndex >= 0 ? file.name.slice(dotIndex) : ".png";
    const baseName = dotIndex > 0 ? file.name.slice(0, dotIndex) : "image";
    const remoteName = `${baseName}.${md5}${ext}`;
    const remoteDir = "cloudreve://my/存储桶测试".replace(/\/+$/, "");
    const remoteUri = `${remoteDir}/${encodeURIComponent(remoteName)}`;

    const existingPath = await this.findRemoteByMd5(remoteDir, md5, token);
    if (existingPath) {
      const existingLink = await this.getSourceLink(existingPath, token);
      if (existingLink) return existingLink;
    }

    await this.createRemoteDirs(remoteUri, token);
    const policyId = await this.discoverPolicyId(remoteDir, token);
    const session = await this.createUploadSession(remoteUri, buffer.byteLength, file.type || "application/octet-stream", policyId);
    const sessionId = session.session_id ?? session.id ?? "";

    const chunkSize = Math.max(1, Number(session.chunk_size) || buffer.byteLength || 1);
    for (let offset = 0, index = 0; offset < buffer.byteLength; offset += chunkSize, index++) {
      const chunk = buffer.slice(offset, Math.min(offset + chunkSize, buffer.byteLength));
      let lastErr: unknown = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await this.uploadChunk(sessionId, index, chunk, token);
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < 3) await new Promise(r => setTimeout(r, 150 * attempt));
        }
      }
      if (lastErr) throw lastErr;
    }

    const link = await this.getSourceLink(remoteUri, token);
    if (!link) throw new CloudreveError("Cloudreve 上传成功但未生成直链");
    return link;
  }
}

export default CloudreveUploader;
