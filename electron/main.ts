import { app, BrowserWindow, Menu, session, ipcMain, dialog, screen, shell, safeStorage, net } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as https from 'https';
import * as fs from 'fs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const IPC_TIMEOUT_MS = 30_000;
const HEAD_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_DOWNLOAD_REDIRECTS = 5;
const DOWNLOAD_PROGRESS_INTERVAL_MS = 200;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 把下载文件名净化为不含路径分隔符与 Windows 非法字符的安全名 */
const sanitizeFileName = (name: string): string => (
  path.basename(name).replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '') || 'video.mp4'
);

/** 从 IPC 收到的二进制负载还原 Buffer：优先 ArrayBuffer/Uint8Array（结构化克隆零拷贝），兼容旧的 number[] */
const toBufferFromIpcPayload = (payload: unknown): Buffer => {
  if (payload instanceof ArrayBuffer) return Buffer.from(new Uint8Array(payload));
  if (ArrayBuffer.isView(payload)) {
    const view = payload as NodeJS.ArrayBufferView;
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  }
  if (Array.isArray(payload)) return Buffer.from(payload);
  throw new Error('上传内容无效');
};

const assertHttpsUrl = (value: unknown): URL => {
  if (typeof value !== 'string') throw new Error('URL 参数无效');
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') throw new Error('仅允许 HTTPS 请求');
  return parsed;
};

const readResponseBody = (res: NodeJS.ReadableStream, limit = MAX_RESPONSE_BYTES): Promise<string> => new Promise((resolve, reject) => {
  let data = '';
  let size = 0;
  res.on('data', (chunk: Buffer | string) => {
    size += Buffer.byteLength(chunk);
    if (size > limit) {
      reject(new Error('响应体过大'));
      if ('destroy' in res && typeof res.destroy === 'function') res.destroy();
      return;
    }
    data += chunk;
  });
  res.on('end', () => resolve(data));
  res.on('error', reject);
});

const getAdaptiveWindowBounds = () => {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(Math.max(Math.floor(screenWidth * 0.9), 1200), 1680);
  const height = Math.min(Math.max(Math.floor(screenHeight * 0.9), 800), 1050);

  return {
    width: Math.min(width, screenWidth),
    height: Math.min(height, screenHeight),
  };
};

const getAppIconPath = () => (
  app.isPackaged
    ? path.join(__dirname, '../dist/app-icon.png')
    : path.join(__dirname, '../public-build/app-icon.png')
);

// CORS 注入过滤器：内置平台域 + 用户配置的自定义平台域（经 set-cors-origins IPC 动态更新）。
// 开启 webSecurity 后，渲染进程跨源调用这些 API 依赖这里注入的 CORS 头。
const builtinCorsUrls = [
  'https://geekai.co/*',
  'https://*.geekai.co/*',
  'https://apizzz.com/*',
  'https://*.apizzz.com/*',
  'https://api.klingai.com/*',
  'https://ark.cn-beijing.volces.com/*',
];
let customCorsUrls: string[] = [];

const registerPlatformCorsHandlers = () => {
  const platformRequestFilter = { urls: [...builtinCorsUrls, ...customCorsUrls] };

  session.defaultSession.webRequest.onBeforeSendHeaders(platformRequestFilter, (details, callback) => {
    const headers = { ...details.requestHeaders };
    if (details.url.startsWith('https://geekai.co') || details.url.includes('.geekai.co')) {
      headers['Origin'] = 'https://geekai.co';
      headers['Referer'] = 'https://geekai.co/chat';
    }
    callback({ cancel: false, requestHeaders: headers });
  });

  session.defaultSession.webRequest.onHeadersReceived(platformRequestFilter, (details, callback) => {
    callback({
      cancel: false,
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, HEAD, OPTIONS'],
        'Access-Control-Allow-Headers': ['*'],
      },
    });
  });
};

ipcMain.handle('set-cors-origins', async (_event, baseUrls: unknown) => {
  try {
    const urls = Array.isArray(baseUrls)
      ? baseUrls.filter((value): value is string => typeof value === 'string').map(value => {
          try {
            const parsed = new URL(value);
            return parsed.protocol === 'https:' ? `${parsed.origin}/*` : null;
          } catch {
            return null;
          }
        }).filter((value): value is string => !!value)
      : [];
    const next = Array.from(new Set(urls)).slice(0, 50);
    if (JSON.stringify(next) === JSON.stringify(customCorsUrls)) return { success: true };
    customCorsUrls = next;
    registerPlatformCorsHandlers();
    return { success: true };
  } catch (error) {
    console.error('Failed to update CORS origins:', error);
    return { success: false, error: String(error) };
  }
});

const createWindow = () => {
  const windowBounds = getAdaptiveWindowBounds();
  const mainWindow = new BrowserWindow({
    ...windowBounds,
    minWidth: 1100,
    minHeight: 760,
    center: true,
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'AIVideoForge - AI 视频工坊',
  });

  // 导航守卫：主窗口只允许停留在应用自身页面，外部链接交给系统浏览器，
  // 防止远程内容获得 preload 暴露的 electronAPI 能力。
  const isAppUrl = (target: string): boolean => {
    try {
      const parsed = new URL(target);
      if (process.env.NODE_ENV === 'development') {
        return parsed.protocol === 'file:' || parsed.origin === 'http://localhost:5173';
      }
      return parsed.protocol === 'file:';
    } catch {
      return false;
    }
  };
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAppUrl(targetUrl)) {
      event.preventDefault();
      if (/^https?:/i.test(targetUrl)) void shell.openExternal(targetUrl);
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (/^https?:/i.test(targetUrl)) void shell.openExternal(targetUrl);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    const configStr = await session.defaultSession.cookies.get({ url: 'https://geekai.co' });
    console.log('Cookies loaded:', configStr.length);
  });

  registerPlatformCorsHandlers();

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  const menu = Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [
        { role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    // 生产环境不暴露刷新/DevTools，避免绕过界面直接读取本地存储
    ...(process.env.NODE_ENV === 'development' || !app.isPackaged
      ? [{
          label: '视图',
          submenu: [
            { role: 'reload' as const },
            { role: 'forceReload' as const },
            { type: 'separator' as const },
            { role: 'toggleDevTools' as const },
          ],
        }]
      : []),
  ]);

  Menu.setApplicationMenu(menu);
};

ipcMain.handle('set-cookies', async (_event, ck) => {
  try {
    const cookieParts = ck.split(';');
    for (const part of cookieParts) {
      const trimmed = part.trim();
      if (trimmed) {
        const [name, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (name && value) {
          await session.defaultSession.cookies.set({
            url: 'https://geekai.co',
            name,
            value,
            domain: '.geekai.co',
            secure: true,
            path: '/',
          });
        }
      }
    }
    console.log('Cookies set via Electron session API');
    return { success: true };
  } catch (e) {
    console.error('Failed to set cookies:', e);
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('clear-cookies', async () => {
  try {
    const cookies = await session.defaultSession.cookies.get({ domain: '.geekai.co' });
    for (const cookie of cookies) {
      const host = (cookie.domain ?? '').replace(/^\./, '');
      await session.defaultSession.cookies.remove(`https://${host}`, cookie.name);
    }
    return { success: true };
  } catch (e) {
    console.error('Failed to clear cookies:', e);
    return { success: false, error: String(e) };
  }
});

ipcMain.handle('set-http-proxy-config', async (_event, config) => {
  try {
    const useSystemProxy = isRecord(config) && config.useSystemProxy === true;
    const mode = useSystemProxy ? 'system' : 'direct';
    await session.defaultSession.setProxy({ mode });
    console.log(`Proxy mode set: ${mode}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to set proxy config:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('make-request', async (_event, reqUrl, options) => {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = assertHttpsUrl(reqUrl);
      const requestOptions = isRecord(options) ? options : {};
      const method = typeof requestOptions.method === 'string' ? requestOptions.method.toUpperCase() : 'GET';
      if (!['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) throw new Error('不支持的请求方法');
      const inputHeaders = isRecord(requestOptions.headers) ? requestOptions.headers : {};
      const headers: Record<string, string> = {
        'Cookie': typeof inputHeaders.Cookie === 'string' ? inputHeaders.Cookie : '',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        'Accept': method === 'HEAD' ? '*/*' : 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Origin': 'https://geekai.co',
        'Referer': 'https://geekai.co/chat',
      };
      for (const [key, value] of Object.entries(inputHeaders)) {
        if (typeof value === 'string') headers[key] = value;
      }
      const req = https.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method,
        headers,
      }, async (res) => {
        try {
          if (method === 'HEAD') {
            res.resume();
            resolve({ status: res.statusCode, body: '', headers: res.headers as Record<string, string> });
            return;
          }
          const body = await readResponseBody(res);
          resolve({ status: res.statusCode, body, headers: res.headers as Record<string, string> });
        } catch (error) {
          reject(error);
        }
      });
      req.setTimeout(method === 'HEAD' ? HEAD_TIMEOUT_MS : IPC_TIMEOUT_MS, () => req.destroy(new Error('请求超时')));
      req.on('error', reject);
      if (requestOptions.body) {
        req.write(typeof requestOptions.body === 'string' ? requestOptions.body : JSON.stringify(requestOptions.body));
      }
      req.end();
    } catch (error) {
      reject(error);
    }
  });
});

ipcMain.handle('upload-to-cos', async (_event, bufferPayload, options) => {
  return new Promise((resolve, reject) => {
    try {
      const buffer = toBufferFromIpcPayload(bufferPayload);
      if (buffer.length <= 0 || buffer.length > MAX_UPLOAD_BYTES) throw new Error('上传文件大小无效');
      const urlObj = assertHttpsUrl(isRecord(options) ? options.url : undefined);
      const inputHeaders = isRecord(options) && isRecord(options.headers) ? options.headers : {};
      const allowedHeaders = new Set(['Content-Type', 'Authorization', 'x-cos-security-token']);
      const headers: Record<string, string> = {
        'Content-Type': typeof inputHeaders['Content-Type'] === 'string' ? inputHeaders['Content-Type'] : 'application/octet-stream',
        'Content-Length': String(buffer.length),
        'Host': urlObj.hostname,
      };
      for (const [key, value] of Object.entries(inputHeaders)) {
        if (allowedHeaders.has(key) && typeof value === 'string') headers[key] = value;
      }
      if (!headers.Authorization || !headers['x-cos-security-token']) throw new Error('COS 上传凭证缺失');
      const req = https.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'PUT',
        headers,
      }, async (res) => {
        try {
          const data = await readResponseBody(res, 1024 * 1024);
          if (res.statusCode === 200 || res.statusCode === 204) {
            resolve({ success: true, status: res.statusCode });
          } else {
            reject(new Error(`COS上传失败: ${res.statusCode}, 响应: ${data}`));
          }
        } catch (error) {
          reject(error);
        }
      });
      req.setTimeout(IPC_TIMEOUT_MS, () => req.destroy(new Error('COS上传超时')));
      req.on('error', reject);
      req.write(buffer);
      req.end();
    } catch (error) {
      reject(error);
    }
  });
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: '选择下载路径',
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle('check-dir', async (_event, targetPath: string) => {
  if (!targetPath) return { success: false, exists: false, error: '路径为空' };
  try {
    if (!fs.existsSync(targetPath)) return { success: false, exists: false, error: '路径不存在' };
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) return { success: true, exists: true };
    return { success: false, exists: true, error: '路径不是文件夹' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('download-file', async (event, fileUrl: string, savePath: string, taskId?: string, requestHeaders?: Record<string, string>) => {
  return new Promise((resolve, reject) => {
    if (!savePath) {
      reject(new Error('未设置下载路径'));
      return;
    }

    // 安全校验：仅允许 HTTPS 下载，防止 file:// 或 HTTP 协议
    let urlObj: URL;
    try {
      urlObj = new URL(fileUrl);
      if (urlObj.protocol !== 'https:') {
        reject(new Error('仅允许下载 HTTPS 资源'));
        return;
      }
    } catch {
      reject(new Error('下载 URL 无效'));
      return;
    }

    // 校验并创建下载目录；失败时给出明确的中文提示，避免后续写入时报原生错误
    try {
      if (fs.existsSync(savePath)) {
        const stat = fs.statSync(savePath);
        if (!stat.isDirectory()) {
          reject(new Error(`下载路径「${savePath}」不是文件夹，自动下载失败`));
          return;
        }
      } else {
        fs.mkdirSync(savePath, { recursive: true });
      }
    } catch (error) {
      reject(new Error(`创建下载目录失败（${error instanceof Error ? error.message : String(error)}），请检查下载路径「${savePath}」是否存在或可写`));
      return;
    }
    // 先解码再取 basename，并剔除路径分隔符/非法字符；taskId 同样净化，防止目录穿越写出
    const urlFileName = sanitizeFileName(decodeURIComponent(path.basename(urlObj.pathname)) || `video-${Date.now()}.mp4`);
    let fileName = urlFileName;
    if (taskId) {
      const ext = path.extname(urlFileName) || '.mp4';
      fileName = `${sanitizeFileName(String(taskId))}${ext}`;
    }
    const resolvedDir = path.resolve(savePath);
    const filePath = path.resolve(resolvedDir, fileName);
    if (!filePath.startsWith(resolvedDir + path.sep)) {
      reject(new Error('下载文件名不合法，已拒绝写入目标目录之外'));
      return;
    }

    const headers: Record<string, string> = {};
    if (requestHeaders && typeof requestHeaders.Authorization === 'string') {
      headers.Authorization = requestHeaders.Authorization;
    }

    // 进度节流：最多每 DOWNLOAD_PROGRESS_INTERVAL_MS 或百分比变化时发送一次，避免事件风暴拖垮渲染进程
    let lastProgressSentAt = 0;
    let lastProgressValue = -1;
    const sendProgress = (progress: number, receivedBytes: number, totalBytes: number) => {
      if (!taskId) return;
      const now = Date.now();
      if (progress !== 100 && progress === lastProgressValue && now - lastProgressSentAt < DOWNLOAD_PROGRESS_INTERVAL_MS) return;
      lastProgressSentAt = now;
      lastProgressValue = progress;
      event.sender.send('download-progress', { taskId, progress, receivedBytes, totalBytes });
    };

    const cleanupPartialFile = () => {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Failed to cleanup partial download:', error);
      }
    };

    const startRequest = (targetUrl: URL, redirectCount: number) => {
      const req = https.request(targetUrl, { headers }, (res) => {
        // 跟随 CDN 常见的 3xx 重定向（仅 https，限制跳数）
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) {
          res.resume();
          const location = res.headers.location;
          if (!location || redirectCount >= MAX_DOWNLOAD_REDIRECTS) {
            reject(new Error(`下载失败: HTTP ${res.statusCode}${location ? '（重定向次数过多）' : '（缺少重定向地址）'}`));
            return;
          }
          try {
            const nextUrl = new URL(location, targetUrl);
            if (nextUrl.protocol !== 'https:') {
              reject(new Error('仅允许下载 HTTPS 资源'));
              return;
            }
            startRequest(nextUrl, redirectCount + 1);
          } catch {
            reject(new Error('下载重定向地址无效'));
          }
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`下载失败: HTTP ${res.statusCode}`));
          return;
        }

        const totalBytes = Number(res.headers['content-length'] || 0);
        let receivedBytes = 0;
        const fileStream = fs.createWriteStream(filePath);

        res.on('data', (chunk: Buffer) => {
          receivedBytes += chunk.length;
          if (totalBytes > 0) {
            const progress = Math.min(99, Math.floor((receivedBytes / totalBytes) * 100));
            sendProgress(progress, receivedBytes, totalBytes);
          }
        });

        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`File downloaded to: ${filePath}`);
          sendProgress(100, receivedBytes, totalBytes);
          resolve({ success: true, filePath, savePath });
        });
        fileStream.on('error', (error) => {
          res.destroy();
          cleanupPartialFile();
          reject(error);
        });
        res.on('error', (error) => {
          fileStream.destroy();
          cleanupPartialFile();
          reject(error);
        });
      });

      // 空闲超时：连接停滞时主动断开，避免 Promise 永久挂起导致任务卡在“下载中”
      req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => req.destroy(new Error('下载超时，请检查网络后重试')));
      req.on('error', (e) => {
        cleanupPartialFile();
        reject(e);
      });

      req.end();
    };

    startRequest(urlObj, 0);
  });
});

ipcMain.handle('open-path', async (_event, targetPath: string) => {
  if (!targetPath) return { success: false, error: '路径为空' };

  try {
    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        const error = await shell.openPath(targetPath);
        return error ? { success: false, error } : { success: true };
      }
      shell.showItemInFolder(targetPath);
      return { success: true };
    }

    const parentPath = path.dirname(targetPath);
    if (parentPath && fs.existsSync(parentPath)) {
      const error = await shell.openPath(parentPath);
      return error ? { success: false, error } : { success: true };
    }

    return { success: false, error: '路径不存在' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('read-data-file', async (_event, filename: string) => {
  try {
    if (!filename || filename.includes('..')) throw new Error('文件名无效');
    const filePath = path.join(app.getPath('userData'), filename);
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to read data file ${filename}:`, error);
    return null;
  }
});

ipcMain.handle('write-data-file', async (_event, filename: string, data: unknown) => {
  try {
    if (!filename || filename.includes('..')) throw new Error('文件名无效');
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, filename);
    const tempPath = filePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
    return { success: true };
  } catch (error) {
    console.error(`Failed to write data file ${filename}:`, error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('encrypt-string', async (_event, plainText: string) => {
  try {
    if (typeof plainText !== 'string') throw new Error('待加密内容无效');
    const available = safeStorage.isEncryptionAvailable();
    if (!plainText) return { success: true, encrypted: '', available };
    if (!available) return { success: false, available, error: '当前系统不支持加密存储' };
    const encryptedBuffer = safeStorage.encryptString(plainText);
    return { success: true, encrypted: encryptedBuffer.toString('base64'), available };
  } catch (error) {
    console.error('Failed to encrypt string:', error);
    return { success: false, error: String(error), available: safeStorage.isEncryptionAvailable() };
  }
});

ipcMain.handle('decrypt-string', async (_event, encryptedBase64: string) => {
  try {
    if (typeof encryptedBase64 !== 'string') throw new Error('待解密内容无效');
    if (!encryptedBase64) return { success: true, decrypted: '' };
    if (!safeStorage.isEncryptionAvailable()) return { success: false, error: '当前系统不支持加密存储' };
    const buffer = Buffer.from(encryptedBase64, 'base64');
    const decrypted = safeStorage.decryptString(buffer);
    return { success: true, decrypted };
  } catch (error) {
    console.error('Failed to decrypt string:', error);
    return { success: false, error: String(error) };
  }
});

const updateSource = process.env.AIVIDEOFORGE_UPDATE_URL || 'https://api.github.com/repos/LuluDeer/AIVideoForge/releases/latest';
const updateDownloadPage = 'https://github.com/LuluDeer/AIVideoForge/releases/latest';

ipcMain.handle('check-for-updates', async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IPC_TIMEOUT_MS);

  try {
    const source = new URL(updateSource);
    if (source.protocol !== 'https:') throw new Error('更新源必须使用 HTTPS');

    // Electron's network stack follows the operating-system/Electron session
    // proxy configuration. Node.js fetch bypasses the Windows system proxy.
    const response = await net.fetch(source.toString(), {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'AIVideoForge' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`更新服务返回 HTTP ${response.status}`);

    const release = await response.json() as { tag_name?: string; html_url?: string; published_at?: string };
    return {
      version: release.tag_name || '',
      url: release.html_url || updateDownloadPage,
      publishedAt: release.published_at,
    };
  } catch (error) {
    const cause = error instanceof Error && isRecord(error.cause) ? error.cause : undefined;
    const code = cause && typeof cause.code === 'string' ? cause.code : '';
    const errorMessage = error instanceof Error ? error.message : '';
    let message = '暂时无法连接更新服务，请检查网络后重试。';

    if (controller.signal.aborted) message = '连接更新服务超时，请检查网络后重试。';
    else if (code === 'ECONNREFUSED') message = '更新服务连接被拒绝，请检查系统代理、DNS 或 hosts 设置后重试。';
    else if (errorMessage === '更新源必须使用 HTTPS') message = errorMessage;
    else if (errorMessage.startsWith('更新服务返回 HTTP')) message = errorMessage;

    return { version: '', url: updateDownloadPage, error: message };
  } finally {
    clearTimeout(timeout);
  }
});

ipcMain.handle('open-update-download', async (_event, targetUrl: string) => {
  const parsed = new URL(targetUrl);
  if (parsed.protocol !== 'https:') throw new Error('下载页必须使用 HTTPS');
  await shell.openExternal(parsed.toString());
  return { success: true };
});

app.whenReady().then(async () => {
  try {
    await session.defaultSession.setProxy({ mode: 'direct' });
  } catch (error) {
    console.error('Failed to initialize direct proxy mode:', error);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
