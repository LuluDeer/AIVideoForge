import { app, BrowserWindow, Menu, session, ipcMain, dialog, screen, shell } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as https from 'https';
import * as fs from 'fs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const IPC_TIMEOUT_MS = 30_000;
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

const createWindow = () => {
  const windowBounds = getAdaptiveWindowBounds();
  const mainWindow = new BrowserWindow({
    ...windowBounds,
    minWidth: 1100,
    minHeight: 760,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    title: '极客智坊视频批量生成工具',
  });

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    headers['Origin'] = 'https://geekai.co';
    headers['Referer'] = 'https://geekai.co/chat';
    callback({ cancel: false, requestHeaders: headers });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      cancel: false,
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
        'Access-Control-Allow-Headers': ['*'],
      },
    });
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    const configStr = await session.defaultSession.cookies.get({ url: 'https://geekai.co' });
    console.log('Current cookies:', configStr);
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

ipcMain.handle('make-request', async (_event, reqUrl, options) => {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = assertHttpsUrl(reqUrl);
      const requestOptions = isRecord(options) ? options : {};
      const method = typeof requestOptions.method === 'string' ? requestOptions.method.toUpperCase() : 'GET';
      if (!['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].includes(method)) throw new Error('不支持的请求方法');
      const inputHeaders = isRecord(requestOptions.headers) ? requestOptions.headers : {};
      const headers: Record<string, string> = {
        'Cookie': typeof inputHeaders.Cookie === 'string' ? inputHeaders.Cookie : '',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
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
          const body = await readResponseBody(res);
          resolve({ status: res.statusCode, body, headers: res.headers as Record<string, string> });
        } catch (error) {
          reject(error);
        }
      });
      req.setTimeout(IPC_TIMEOUT_MS, () => req.destroy(new Error('请求超时')));
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

ipcMain.handle('download-file', async (_event, fileUrl: string, savePath: string) => {
  return new Promise((resolve, reject) => {
    if (!savePath) {
      reject(new Error('未设置下载路径'));
      return;
    }

    fs.mkdirSync(savePath, { recursive: true });
    const urlObj = new URL(fileUrl);
    const fileName = decodeURIComponent(path.basename(urlObj.pathname)) || `video-${Date.now()}.mp4`;
    const filePath = path.join(savePath, fileName);
    
    const req = https.request(fileUrl, (res) => {
      if (res.statusCode === 200) {
        const fileStream = fs.createWriteStream(filePath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`File downloaded to: ${filePath}`);
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

app.whenReady().then(() => {
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
