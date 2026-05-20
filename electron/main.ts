import { app, BrowserWindow, Menu, session, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as https from 'https';
import * as fs from 'fs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
    const urlObj = new URL(reqUrl);
    
    const headers: Record<string, string> = {
      'Cookie': options.headers?.Cookie || '',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Origin': 'https://geekai.co',
      'Referer': 'https://geekai.co/chat',
      ...options.headers,
    };
    
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers,
    };
    
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: data,
          headers: res.headers as Record<string, string>,
        });
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
});

ipcMain.handle('upload-to-cos', async (_event, bufferArray, options) => {
  return new Promise((resolve, reject) => {
    const buffer = Buffer.from(bufferArray);
    const urlObj = new URL(options.url);
    
    const headers: Record<string, string> = {
      'Content-Type': options.headers['Content-Type'] || 'application/octet-stream',
      'Content-Length': String(buffer.length),
      'Host': urlObj.hostname,
      ...options.headers,
    };
    
    console.log('[DEBUG] COS Upload Headers:', headers);
    console.log('[DEBUG] COS Upload URL:', options.url);
    console.log('[DEBUG] COS Upload Buffer Length:', buffer.length);
    
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'PUT',
      headers,
    };
    
    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log('[DEBUG] COS Response Status:', res.statusCode);
        console.log('[DEBUG] COS Response Body:', data);
        if (res.statusCode === 200) {
          resolve({ success: true, status: res.statusCode });
        } else {
          reject(new Error(`COS上传失败: ${res.statusCode}, 响应: ${data}`));
        }
      });
    });
    
    req.on('error', (e) => {
      console.error('[DEBUG] COS Upload Error:', e);
      reject(e);
    });
    
    req.write(buffer);
    req.end();
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

ipcMain.handle('download-file', async (_event, url, savePath) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const fileName = path.basename(urlObj.pathname) || 'video.mp4';
    const filePath = path.join(savePath, fileName);
    
    const req = https.request(url, (res) => {
      if (res.statusCode === 200) {
        const fileStream = fs.createWriteStream(filePath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`File downloaded to: ${filePath}`);
          resolve({ success: true, filePath });
        });
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
