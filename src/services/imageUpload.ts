import type { ImageUploadResponse } from '../types';
import { parseJson } from '../utils/storage';

/**
 * 平台级图片上传配置。所有字段均可选；不填则沿用 geekai 默认值。
 * 在 PlatformDef.imageUploadConfig 里按需覆盖即可。
 */
export interface ImageUploaderConfig {
  /** 获取 COS 上传凭证的接口路径，默认 /api/cos/credential */
  credentialEndpoint?: string;
  /** MD5 秒传检查接口路径前缀，默认 /api/block（会拼 /:md5） */
  cacheCheckEndpoint?: string;
  /** 上传记录回调接口路径，默认 /api/block */
  recordEndpoint?: string;
  /** COS bucket 上传域名，默认 geekai-1317767639.cos.ap-shanghai.myqcloud.com */
  cosBucket?: string;
  /** 上传成功后的公开访问域名前缀（不含尾部斜杠），默认 https://static.geekai.co */
  storageUrlPrefix?: string;
  /** Origin / Referer 请求头的站点域名，默认 https://geekai.co */
  siteOrigin?: string;
}

const DEFAULT_CONFIG: Required<ImageUploaderConfig> = {
  credentialEndpoint: '/api/cos/credential',
  cacheCheckEndpoint: '/api/block',
  recordEndpoint: '/api/block',
  cosBucket: 'geekai-1317767639.cos.ap-shanghai.myqcloud.com',
  storageUrlPrefix: 'https://static.geekai.co',
  siteOrigin: 'https://geekai.co',
};

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;
const MAX_AUDIO_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const ALLOWED_AUDIO_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg']);
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|avi)$/i;
const AUDIO_EXT_RE = /\.(mp3|wav|m4a|aac|ogg)$/i;

const CACHE_HEAD_TIMEOUT_MS = 5_000;

type ImageUploadData = ImageUploadResponse['data'];
type CosCredential = { secret_id: string; secret_key: string; token: string };
type UploadKind = 'image' | 'video' | 'audio';
type CacheCheckResult = { block: ImageUploadResponse['data'] | null; valid: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isImageUploadData = (value: unknown): value is ImageUploadData =>
  isRecord(value) &&
  typeof value.uuid === 'string' &&
  typeof value.name === 'string' &&
  typeof value.size === 'number' &&
  typeof value.url === 'string' &&
  typeof value.md5 === 'string' &&
  typeof value.channel === 'string';

const isImageUploadResponse = (value: unknown): value is ImageUploadResponse =>
  isRecord(value) && isImageUploadData(value.data);

const isCosCredential = (value: unknown): value is CosCredential =>
  isRecord(value) &&
  typeof value.secret_id === 'string' &&
  typeof value.secret_key === 'string' &&
  typeof value.token === 'string';

class ImageUploader {
  private baseUrl: string;
  private ck: string;
  private cfg: Required<ImageUploaderConfig>;

  constructor(ck: string = '', overrides: ImageUploaderConfig = {}, baseUrl = 'https://geekai.co') {
    this.ck = ck;
    this.baseUrl = baseUrl;
    this.cfg = { ...DEFAULT_CONFIG, ...overrides };
  }

  private async computeFileMd5(buffer: ArrayBuffer): Promise<string> {
    return this.md5Fallback(buffer);
  }

  private async sha1(str: string): Promise<string> {
    try {
      const buffer = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest({ name: 'SHA-1' }, buffer);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return this.sha1Fallback(str);
    }
  }

  private async hmacSha1(key: string, data: string): Promise<string> {
    try {
      const keyBuffer = new TextEncoder().encode(key);
      const dataBuffer = new TextEncoder().encode(data);
      const cryptoKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'HMAC', hash: { name: 'SHA-1' } }, false, ['sign']);
      const hmac = await crypto.subtle.sign({ name: 'HMAC' }, cryptoKey, dataBuffer);
      return Array.from(new Uint8Array(hmac)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return this.hmacSha1Fallback(key, data);
    }
  }

  private md5Fallback(buffer: ArrayBuffer): string {
    const data = new Uint8Array(buffer);
    const s = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];
    const K = [0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391];
    
    const pad = (data: Uint8Array): Uint32Array => {
      const bitLength = data.length * 8;
      const paddingLength = (448 - (bitLength % 512) + 512) % 512;
      const totalLength = bitLength + paddingLength + 64;
      const bytes = new Uint8Array(totalLength / 8);
      bytes.set(data); bytes[data.length] = 0x80;
      const view = new DataView(bytes.buffer);
      view.setBigUint64(bytes.length - 8, BigInt(bitLength), false);
      return new Uint32Array(bytes.buffer);
    };

    const rotateLeft = (x: number, n: number): number => (x << n) | (x >>> (32 - n));
    const blocks = pad(data);
    
    for (let i = 0; i < blocks.length; i += 16) {
      const M = blocks.subarray(i, i + 16);
      let [a, b, c, d] = s;
      for (let j = 0; j < 64; j++) {
        let f, g;
        if (j < 16) { f = (b & c) | (~b & d); g = j; }
        else if (j < 32) { f = (d & b) | (~d & c); g = (5 * j + 1) % 16; }
        else if (j < 48) { f = b ^ c ^ d; g = (3 * j + 5) % 16; }
        else { f = c ^ (b | ~d); g = (7 * j) % 16; }
        const temp = d; d = c; c = b;
        b = (b + rotateLeft(a + f + K[j] + M[g], [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21][j % 16])) >>> 0;
        a = temp;
      }
      s[0] = (s[0] + a) >>> 0; s[1] = (s[1] + b) >>> 0; s[2] = (s[2] + c) >>> 0; s[3] = (s[3] + d) >>> 0;
    }
    return s.map(x => x.toString(16).padStart(8, '0')).join('');
  }

  private sha1Fallback(str: string): string {
    const data = new TextEncoder().encode(str);
    const h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    
    const blocks = (() => {
      const bitLength = data.length * 8;
      const paddingLength = (448 - (bitLength % 512) + 512) % 512;
      const totalLength = bitLength + paddingLength + 64;
      const bytes = new Uint8Array(totalLength / 8);
      bytes.set(data); bytes[data.length] = 0x80;
      const view = new DataView(bytes.buffer);
      view.setBigUint64(bytes.length - 8, BigInt(bitLength), false);
      return new Uint32Array(bytes.buffer);
    })();

    const rotateLeft = (x: number, n: number): number => (x << n) | (x >>> (32 - n));

    for (let i = 0; i < blocks.length; i += 16) {
      const w = new Uint32Array(80);
      for (let j = 0; j < 16; j++) w[j] = blocks[i + j];
      for (let j = 16; j < 80; j++) w[j] = rotateLeft(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
      
      let [a, b, c, d, e] = h;
      for (let j = 0; j < 80; j++) {
        let f, k;
        if (j < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
        else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
        else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; k = 0xCA62C1D6; }
        const temp = (rotateLeft(a, 5) + f + e + k + w[j]) >>> 0;
        e = d; d = c; c = rotateLeft(b, 30); b = a; a = temp;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0; h[4] = (h[4] + e) >>> 0;
    }
    return h.map(x => x.toString(16).padStart(8, '0')).join('');
  }

  private hmacSha1Fallback(key: string, data: string): string {
    const keyBuffer = new TextEncoder().encode(key);
    const dataBuffer = new TextEncoder().encode(data);
    const blockSize = 64;
    
    let paddedKey: Uint8Array;
    if (keyBuffer.length > blockSize) {
      const hash = this.sha1Fallback(key);
      const hashBytes = new Uint8Array(20);
      for (let i = 0; i < 20; i++) hashBytes[i] = parseInt(hash.substring(i * 2, i * 2 + 2), 16);
      paddedKey = hashBytes.slice(0, blockSize);
    } else {
      paddedKey = new Uint8Array(blockSize);
      paddedKey.set(keyBuffer);
    }
    
    const oKeyPad = new Uint8Array(blockSize);
    const iKeyPad = new Uint8Array(blockSize);
    for (let i = 0; i < blockSize; i++) { oKeyPad[i] = paddedKey[i] ^ 0x5C; iKeyPad[i] = paddedKey[i] ^ 0x36; }
    
    const innerData = new Uint8Array(iKeyPad.length + dataBuffer.length);
    innerData.set(iKeyPad); innerData.set(dataBuffer, iKeyPad.length);
    const innerHashStr = this.sha1Fallback(new TextDecoder().decode(innerData));
    const innerHash = new Uint8Array(20);
    for (let i = 0; i < 20; i++) innerHash[i] = parseInt(innerHashStr.substring(i * 2, i * 2 + 2), 16);
    
    const outerData = new Uint8Array(oKeyPad.length + innerHash.length);
    outerData.set(oKeyPad); outerData.set(innerHash, oKeyPad.length);
    return this.sha1Fallback(new TextDecoder().decode(outerData));
  }

  private async makeRequest(url: string, options: RequestInit): Promise<{ status: number; body: string; headers: Record<string, string> }> {
    const electronAPI = window.electronAPI;
    
    if (electronAPI) {
      return electronAPI.makeRequest(url, {
        method: options.method,
        headers: { Cookie: this.ck, ...(options.headers as Record<string, string>) },
        body: options.body,
      });
    } else {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', url, true);
        xhr.timeout = options.method === 'HEAD' ? CACHE_HEAD_TIMEOUT_MS : 0;
        
        xhr.setRequestHeader('Cookie', this.ck);
        xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36');
        xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
        xhr.setRequestHeader('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');
        xhr.setRequestHeader('Origin', this.cfg.siteOrigin);
        xhr.setRequestHeader('Referer', `${this.cfg.siteOrigin}/chat`);
        
        const optionHeaders = options.headers as Record<string, string> | undefined;
        if (optionHeaders) {
          for (const [key, value] of Object.entries(optionHeaders)) {
            if (key.toLowerCase() !== 'cookie') xhr.setRequestHeader(key, value);
          }
        }
        
        if (options.body) {
          xhr.setRequestHeader('Content-Type', 'application/json');
        }
        
        xhr.onload = () => {
          const responseHeaders: Record<string, string> = {};
          try {
            const ct = xhr.getResponseHeader('Content-Type');
            if (ct) responseHeaders['content-type'] = ct;
          } catch {}
          resolve({
            status: xhr.status,
            body: xhr.responseText,
            headers: responseHeaders,
          });
        };
        
        xhr.onerror = () => {
          reject(new Error('Network error'));
        };
        xhr.ontimeout = () => {
          reject(new Error('Request timeout'));
        };
        
        xhr.send(typeof options.body === 'string' ? options.body : null);
      });
    }
  }

  private normalizeStoragePrefix(): string {
    return this.cfg.storageUrlPrefix.replace(/\/+$/, '');
  }

  private parseCosKeyFromUrl(fileUrl: string): string | null {
    const prefix = `${this.normalizeStoragePrefix()}/`;
    if (!fileUrl.startsWith(prefix)) return null;
    const cosKey = fileUrl.slice(prefix.length).split(/[?#]/, 1)[0];
    return cosKey ? decodeURIComponent(cosKey) : null;
  }

  private async isCacheFileAlive(fileUrl: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(fileUrl, {
        method: 'HEAD',
        headers: { Range: 'bytes=0-1' },
      });
      if (response.status !== 200 && response.status !== 206) return false;
      // GeekAI CDN 对已删除文件会返回 200 + text/html 首页，必须校验 Content-Type
      const contentType = (response.headers?.['content-type'] ?? response.headers?.['Content-Type'] ?? '').toLowerCase();
      if (contentType.includes('text/html')) return false;
      return true;
    } catch {
      return false;
    }
  }

  async checkBlockCache(md5: string): Promise<CacheCheckResult> {
    try {
      const response = await this.makeRequest(`${this.baseUrl}${this.cfg.cacheCheckEndpoint}/${md5}`, { method: 'GET' });
      if (response.status === 200) {
        const data = parseJson<ImageUploadResponse | null>(response.body, null, isImageUploadResponse);
        const block = data?.data ?? null;
        if (!block?.url) return { block, valid: false };
        const valid = await this.isCacheFileAlive(block.url);
        return { block, valid };
      }
      return { block: null, valid: false };
    } catch {
      return { block: null, valid: false };
    }
  }

  async getCosCredential(): Promise<CosCredential> {
    const response = await this.makeRequest(`${this.baseUrl}${this.cfg.credentialEndpoint}`, { method: 'GET' });
    if (response.status !== 200) {
      throw new Error(`获取凭证失败: ${response.status}`);
    }
    const credential = parseJson<CosCredential | null>(response.body, null, isCosCredential);
    if (!credential) throw new Error('获取凭证失败: 响应格式错误');
    return credential;
  }

  private async generateCosSignature(credential: { secret_id: string; secret_key: string }, method: string, pathname: string, headers: Record<string, string>): Promise<string> {
    const { secret_id, secret_key } = credential;
    const currentTime = Math.floor(Date.now() / 1000) - 1;
    const start_time = currentTime;
    const end_time = currentTime + 900;

    const q_sign_time = `${start_time};${end_time}`;
    const q_key_time = `${start_time};${end_time}`;

    const requiredHeaders = ['cache-control', 'content-disposition', 'content-encoding', 'content-length', 'content-md5', 'expect', 'expires', 'host', 'if-match', 'if-modified-since', 'if-none-match', 'if-unmodified-since', 'origin', 'range', 'transfer-encoding'];
    const signedHeaders: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (requiredHeaders.includes(lowerKey) || lowerKey.startsWith('x-cos-')) {
        signedHeaders[lowerKey] = String(value);
      }
    }

    const q_header_list = Object.keys(signedHeaders).sort().join(';');
    const q_header_str = Object.entries(signedHeaders).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    const http_string = `${method.toLowerCase()}\n${pathname}\n\n${q_header_str}\n`;
    const sign_key = await this.hmacSha1(secret_key, q_key_time);
    const http_string_hash = await this.sha1(http_string);
    const string_to_sign = `sha1\n${q_sign_time}\n${http_string_hash}\n`;
    const signature = await this.hmacSha1(sign_key, string_to_sign);

    return `q-sign-algorithm=sha1&q-ak=${secret_id}&q-sign-time=${q_sign_time}&q-key-time=${q_key_time}&q-header-list=${q_header_list}&q-url-param-list=&q-signature=${signature}`;
  }

  private getFileExtension(fileName: string, fallback = 'bin'): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex === -1 ? fallback : fileName.substring(lastDotIndex + 1).toLowerCase();
  }

  private getImageMime(file: File): string {
    if (file.type) return file.type;
    const fileExt = this.getFileExtension(file.name, 'png');
    return fileExt === 'jpg' ? 'image/jpeg' : `image/${fileExt}`;
  }

  private getAttachmentMime(file: File): string {
    if (file.type) return file.type;
    const ext = this.getFileExtension(file.name);
    const mimeByExt: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      m4v: 'video/mp4',
      avi: 'video/x-msvideo',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      ogg: 'audio/ogg',
    };
    return mimeByExt[ext] ?? 'application/octet-stream';
  }

  private getCosFolder(kind: UploadKind): 'image' | 'file' {
    return kind === 'image' ? 'image' : 'file';
  }

  private async uploadToCos(
    buffer: ArrayBuffer,
    credential: { secret_id: string; secret_key: string; token: string },
    fileName: string,
    mime: string,
    kind: UploadKind,
    oldBlock?: ImageUploadResponse['data'] | null,
  ): Promise<string> {
    const fileExt = this.getFileExtension(fileName, kind === 'image' ? 'png' : 'bin');
    const oldCosKey = oldBlock?.url ? this.parseCosKeyFromUrl(oldBlock.url) : null;
    const now = new Date();
    const uuid = crypto.randomUUID().replace(/-/g, '');
    const cosKey = oldCosKey ?? `${this.getCosFolder(kind)}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${uuid}.${fileExt}`;
    const cosUrl = `https://${this.cfg.cosBucket}/${cosKey}`;
    const pathname = `/${cosKey}`;

    const cosHeaders: Record<string, string> = {
      'Content-Type': mime,
      'Content-Length': String(buffer.byteLength),
      'Host': this.cfg.cosBucket,
      'x-cos-security-token': credential.token,
    };

    const auth = await this.generateCosSignature(credential, 'PUT', pathname, cosHeaders);
    cosHeaders['Authorization'] = auth;

    const electronAPI = window.electronAPI;
    
    if (electronAPI) {
      await electronAPI.uploadToCos(Array.from(new Uint8Array(buffer)), {
        url: cosUrl,
        headers: cosHeaders,
      });
      return `${this.normalizeStoragePrefix()}/${cosKey}`;
    } else {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', cosUrl, true);
        
        for (const [key, value] of Object.entries(cosHeaders)) {
          if (key !== 'Content-Length' && key !== 'Host') {
            xhr.setRequestHeader(key, value);
          }
        }
        
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 204) {
            resolve(`${this.normalizeStoragePrefix()}/${cosKey}`);
          } else {
            reject(new Error(`COS上传失败: ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => {
          reject(new Error('COS上传网络错误'));
        };
        
        xhr.send(buffer);
      });
    }
  }

  private async createBlockRecord(fileName: string, fileUrl: string, md5: string, fileSize: number, mime: string, channel: 'dati' | 'chat'): Promise<ImageUploadResponse['data']> {
    const payload = { md5, name: fileName, type: mime, size: fileSize, url: fileUrl, channel };

    const response = await this.makeRequest(`${this.baseUrl}${this.cfg.recordEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.status !== 200) {
      throw new Error(`创建block记录失败: ${response.status}`);
    }
    
    const data = parseJson<ImageUploadResponse | null>(response.body, null, isImageUploadResponse);
    if (!data) throw new Error('创建block记录失败: 响应格式错误');
    return data.data;
  }

  async uploadImage(file: File): Promise<ImageUploadResponse['data']> {
    if (!file || !(file instanceof File)) throw new Error('请选择有效的图片文件');
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('仅支持 JPG、PNG、WebP 或 GIF 图片');
    if (file.size <= 0) throw new Error('图片文件为空');
    if (file.size > MAX_IMAGE_SIZE_BYTES) throw new Error('图片过大，请选择 15MB 以内的图片');
    const buffer = await file.arrayBuffer();
    const md5 = await this.computeFileMd5(buffer);

    const cacheResult = await this.checkBlockCache(md5);
    if (cacheResult.valid && cacheResult.block) {
      return cacheResult.block;
    }

    const mime = this.getImageMime(file);
    const credential = await this.getCosCredential();
    // 缓存失效时复用旧COS路径覆盖上传，恢复旧链接访问
    const fileUrl = await this.uploadToCos(buffer, credential, file.name, mime, 'image', cacheResult.block);

    // block记录不可变：查询同一MD5始终返回最早的block
    // 旧block存在时（COS文件已覆盖恢复），直接返回旧block，无需创建新block
    if (cacheResult.block) {
      return cacheResult.block;
    }

    // 无旧block记录时，才创建新block
    return await this.createBlockRecord(file.name, fileUrl, md5, buffer.byteLength, mime, 'dati');
  }

  async uploadFile(file: File, kind: 'video' | 'audio'): Promise<ImageUploadResponse['data']> {
    if (!file || !(file instanceof File)) throw new Error(`请选择有效的${kind === 'video' ? '视频' : '音频'}文件`);
    if (file.size <= 0) throw new Error(`${kind === 'video' ? '视频' : '音频'}文件为空`);
    if (kind === 'video') {
      if (!ALLOWED_VIDEO_TYPES.has(file.type) && !VIDEO_EXT_RE.test(file.name)) throw new Error('仅支持 MP4、WebM、MOV、M4V 或 AVI 视频');
      if (file.size > MAX_VIDEO_SIZE_BYTES) throw new Error('视频过大，请选择 200MB 以内的视频');
    } else {
      if (!ALLOWED_AUDIO_TYPES.has(file.type) && !AUDIO_EXT_RE.test(file.name)) throw new Error('仅支持 MP3、WAV、M4A、AAC 或 OGG 音频');
      if (file.size > MAX_AUDIO_SIZE_BYTES) throw new Error('音频过大，请选择 50MB 以内的音频');
    }

    const buffer = await file.arrayBuffer();
    const md5 = await this.computeFileMd5(buffer);

    const cacheResult = await this.checkBlockCache(md5);
    if (cacheResult.valid && cacheResult.block) {
      return cacheResult.block;
    }

    const mime = this.getAttachmentMime(file);
    const credential = await this.getCosCredential();
    // 缓存失效时复用旧COS路径覆盖上传，恢复旧链接访问
    const fileUrl = await this.uploadToCos(buffer, credential, file.name, mime, kind, cacheResult.block);

    // block记录不可变：查询同一MD5始终返回最早的block
    // 旧block存在时（COS文件已覆盖恢复），直接返回旧block，无需创建新block
    if (cacheResult.block) {
      return cacheResult.block;
    }

    // 无旧block记录时，才创建新block
    return await this.createBlockRecord(file.name, fileUrl, md5, buffer.byteLength, mime, 'chat');
  }
}

export default ImageUploader;
