import { afterEach, describe, expect, it, vi } from 'vitest';
import CloudreveUploader, { CloudreveError } from './cloudreveUpload';

// "abc" 的标准 MD5，与文件名嵌入 md5 约定一致
const ABC_MD5 = '900150983cd24fb0d6963f7d28e17f72';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const imageFile = (content = 'abc', name = 'abc.png', type = 'image/png'): File =>
  new File([content], name, { type });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CloudreveUploader', () => {
  it('重复文件走 MD5 秒传：列出同名文件并直接返回已存在直链，不重新上传', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const raw = String(url);
      calls.push(raw);
      if (raw.endsWith('/token')) return jsonResponse({ refresh_token: 'refresh-1' });
      if (raw.includes('/session/token/refresh')) return jsonResponse({ code: 0, data: { access_token: 'access-1' } });
      if (raw.includes('/file?uri=')) {
        // findRemoteByMd5 传入 ?name=<md5> 过滤语法
        if (raw.includes('%3Fname%3D')) {
          return jsonResponse({
            code: 0,
            data: { files: [{ name: `旧图.${ABC_MD5}.png`, path: `cloudreve://my/图片/旧图.${ABC_MD5}.png` }] },
          });
        }
        return jsonResponse({ code: 0, data: {} });
      }
      if (raw.includes('/file/source')) return jsonResponse({ code: 0, data: [{ link: 'https://cdn.example.com/abc.png' }] });
      throw new Error(`未预期的请求: ${raw}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const uploader = new CloudreveUploader({
      apiKey: 'secret-key',
      baseUrl: 'https://cr.example.com/',
      tokenServer: 'https://cr.example.com/t/',
      remoteDir: 'cloudreve://my/图片/',
    });
    const link = await uploader.uploadImage(imageFile());

    expect(link).toBe('https://cdn.example.com/abc.png');
    // 自定义实例地址确实生效
    expect(calls.some(u => u.startsWith('https://cr.example.com/api/v4/session/token/refresh'))).toBe(true);
    expect(calls.some(u => u === 'https://cr.example.com/t/token')).toBe(true);
    // 秒传查找必须命中配置的远端目录且带 md5 过滤
    expect(calls.some(u => u.includes('%3Fname%3D') && u.includes('cloudreve%3A%2F%2Fmy%2F%E5%9B%BE%E7%89%87'))).toBe(true);
    // 未发生真实分块上传
    expect(calls.some(u => u.includes('/file/upload/'))).toBe(false);
  });

  it('api_key 无效时抛出明确的鉴权错误', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 401)));
    const uploader = new CloudreveUploader({ apiKey: 'bad-key' });
    await expect(uploader.uploadImage(imageFile())).rejects.toThrow(/鉴权失败/);
  });

  it('拒绝非图片文件', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})));
    const uploader = new CloudreveUploader({ apiKey: 'k' });
    await expect(uploader.uploadImage(imageFile('x', 'note.txt', 'text/plain'))).rejects.toThrow(/仅支持图片文件/);
  });

  it('令牌服务返回非 2xx 时抛出 CloudreveError 而不是裸 TypeError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ msg: 'boom' }, 500)));
    const uploader = new CloudreveUploader({ apiKey: 'k' });
    await expect(uploader.uploadImage(imageFile())).rejects.toThrow(CloudreveError);
  });
});