/**
 * Cloudreve 上传服务
 *
 * 参考 upload_with_direct_link.py 脚本实现：
 *  - 使用本地令牌服务的 api_key 换取 refresh_token
 *  - 使用 refresh_token 铸 access_token
 *  - 自动发现存储策略（不传 policy_id 时）
 *  - 调用 Cloudreve v4 API 上传图片并转直链
 */

const CLOUDREVE_BASE_URL = "https://cloudreve.yskj.cc.cd";
const CLOUDREVE_API = `${CLOUDREVE_BASE_URL.replace(/\/+$/, "")}/api/v4`;
const CLOUDREVE_TOKEN_SERVER = "https://cloudreve.yskj.cc.cd/t";
const DEFAULT_REMOTE_DIR = "cloudreve://my/存储桶测试";

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

function md5Hex(input: ArrayBuffer): string {
  const bytes = new Uint8Array(input);
  const bitLen = bytes.length * 8;
  const padLen = ((448 - (bitLen % 512)) + 512) % 512;
  const padded = new Uint8Array(bitLen / 8 + padLen / 8 + 8);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  // MD5 规范：64 位长度以小端序写入（低 32 位在前）
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);
  const M = new Uint32Array(padded.buffer);
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
             5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
             4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
             6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);
  const h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];
  const rot = (x: number, n: number): number => (x << n) | (x >>> (32 - n));
  for (let i = 0; i < M.length; i += 16) {
    const w = M.subarray(i, i + 16);
    let [a, b, c, d] = h;
    for (let j = 0; j < 64; j++) {
      let f: number;
      let g: number;
      if (j < 16) { f = (b & c) | (~b & d); g = j; }
      else if (j < 32) { f = (d & b) | (~d & c); g = (5 * j + 1) % 16; }
      else if (j < 48) { f = b ^ c ^ d; g = (3 * j + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * j) % 16; }
      const tmp = d; d = c; c = b;
      b = (b + rot(a + f + K[j] + w[g], s[j])) >>> 0;
      a = tmp;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
  }
  // MD5 摘要要求每个 32 位字以小端序字节输出，toString(16) 是大端序，需按字节反转
  return h.map(x => {
    const hex = x.toString(16).padStart(8, "0");
    return hex[6] + hex[7] + hex[4] + hex[5] + hex[2] + hex[3] + hex[0] + hex[1];
  }).join("");
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
  if (isRecord(response) && "data" in response) return response.data;
  return response;
}

async function requestJson<T>(path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${CLOUDREVE_API}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers ?? {}),
  };
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
  });
  const contentType = response.headers.get("content-type") ?? "";
  let data: unknown;
  if (contentType.includes("application/json")) {
    data = await response.json().catch(() => null);
    if (isRecord(data) && typeof data.code === "number" && data.code !== 0) {
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
  private accessToken: string | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey.trim();
  }

  private async fetchRefreshToken(): Promise<string> {
    const url = `${CLOUDREVE_TOKEN_SERVER.replace(/\/+$/, "")}/token`;
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
    const data = getData(await requestJson<CloudreveRefreshResponse>(
      "/session/token/refresh",
      { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) },
    )) as CloudreveRefreshResponse | null;
    if (!data?.access_token) throw new CloudreveError("Cloudreve 刷新 token 失败");
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  private async fileInfo(uri: string, token: string): Promise<unknown> {
    return getData(await requestJson(
      `/file?uri=${encodeURIComponent(uri)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ));
  }

  private async findRemoteByMd5(remoteDir: string, md5: string, token: string): Promise<string | null> {
    // Cloudreve v4 的 name 过滤语法：在 uri 值内追加 ?name=<md5>（与 upload_with_direct_link.py 一致）
    const data = getData(await requestJson(
      `/file?uri=${encodeURIComponent(`${remoteDir.replace(/\/+$/, "")}?name=${md5}`)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ));
    const files = isRecord(data) && Array.isArray(data.files) ? data.files : [];
    for (const entry of files) {
      if (isRecord(entry) && extractMd5(String(entry.name ?? "")) === md5) {
        return String(entry.path ?? "");
      }
    }
    return null;
  }

  private async getSourceLink(uri: string, token: string): Promise<string | null> {
    const sourceData = getData(await requestJson<CloudreveSourceItem[]>("/file/source", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
    if ("id" in value && "type" in value) {
      const hasPolicyKeys = ["chunk_size", "max_size", "relay"].some(key => key in value);
      const isStringType = typeof value.type === "string" && !/^\d+$/.test(value.type);
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
    for (const uri of [remoteDir, "cloudreve://my"]) {
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
    const data = getData(await requestJson<CloudreveSession>("/file/upload", {
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
    }));
    const session = (isRecord(data) ? data : {}) as CloudreveSession;
    const sessionId = session.session_id ?? session.id;
    if (!sessionId) throw new CloudreveError("Cloudreve 上传会话创建失败");
    return session;
  }

  private async uploadChunk(sessionId: string, index: number, chunk: ArrayBuffer, token: string): Promise<void> {
    const response = await fetch(`${CLOUDREVE_API}/file/upload/${encodeURIComponent(sessionId)}/${index}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: chunk,
    });
    if (!response.ok) throw new CloudreveError(`分块 ${index} 上传失败：HTTP ${response.status}`);
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
        await requestJson("/file/create", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ uri: current, type: "folder" }),
        });
      } catch {
        // 文件夹已存在时忽略
      }
    }
  }

  async uploadImage(file: File): Promise<string> {
    if (!file) throw new CloudreveError("请选择有效的图片文件");
    if (!file.type.startsWith("image/")) throw new CloudreveError("仅支持图片文件上传到 Cloudreve");
    if (file.size <= 0) throw new CloudreveError("图片文件为空");
    if (file.size > 15 * 1024 * 1024) throw new CloudreveError("图片过大，请选择 15MB 以内的图片");

    const token = await this.ensureAccessToken();
    const buffer = await file.arrayBuffer();
    const md5 = md5Hex(buffer);
    const dotIndex = file.name.lastIndexOf(".");
    const ext = dotIndex >= 0 ? file.name.slice(dotIndex) : ".png";
    const baseName = dotIndex > 0 ? file.name.slice(0, dotIndex) : "image";
    const remoteName = `${baseName}.${md5}${ext}`;
    const remoteDir = DEFAULT_REMOTE_DIR.replace(/\/+$/, "");
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
      await this.uploadChunk(sessionId, index, chunk, token);
    }

    const link = await this.getSourceLink(remoteUri, token);
    if (!link) throw new CloudreveError("Cloudreve 上传成功但未生成直链");
    return link;
  }
}

export default CloudreveUploader;
