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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
      webSecurity: false,
    },
    title: 'AIVideoForge - AI 视频工坊',
  });

  const platformRequestFilter = {
    urls: [
      'https://geekai.co/*',
      'https://*.geekai.co/*',
      'https://apizzz.com/*',
      'https://*.apizzz.com/*',
      'https://api.klingai.com/*',
      'https://ark.cn-beijing.volces.com/*',
    ],
  };

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

  mainWindow.webContents.on('did-finish-load', async () => {
    const configStr = await session.defaultSession.cookies.get({ url: 'https://geekai.co' });
    console.log('Cookies loaded:', configStr.length);
  });

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
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
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

ipcMain.handle('upload-to-cos', async (_event, bufferArray, options) => {
  return new Promise((resolve, reject) => {
    try {
      if (!Array.isArray(bufferArray)) throw new Error('上传内容无效');
      const buffer = Buffer.from(bufferArray);
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

ipcMain.handle('download-file', async (event, fileUrl: string, savePath: string, taskId?: string) => {
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

    fs.mkdirSync(savePath, { recursive: true });
    const urlFileName = decodeURIComponent(path.basename(urlObj.pathname)) || `video-${Date.now()}.mp4`;
    // 优先使用 taskId 作为文件名，避免中转站默认同名文件互相覆盖
    let fileName = urlFileName;
    if (taskId) {
      const ext = path.extname(urlFileName) || '.mp4';
      fileName = `${taskId}${ext}`;
    }
    const filePath = path.join(savePath, fileName);

    const sendProgress = (progress: number, receivedBytes: number, totalBytes: number) => {
      if (taskId) {
        event.sender.send('download-progress', { taskId, progress, receivedBytes, totalBytes });
      }
    };

    const req = https.request(fileUrl, (res) => {
      if (res.statusCode === 200) {
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
        fileStream.on('error', reject);
      } else {
        reject(new Error(`下载失败: HTTP ${res.statusCode}`));
      }
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.end();
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
