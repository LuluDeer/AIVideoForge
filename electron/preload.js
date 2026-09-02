const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('updateAPI', {
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  openDownload: (targetUrl) => ipcRenderer.invoke('open-update-download', targetUrl),
});

contextBridge.exposeInMainWorld('electronAPI', {
  setCookies: (ck) => ipcRenderer.invoke('set-cookies', ck),
  setHttpProxyConfig: (config) => ipcRenderer.invoke('set-http-proxy-config', config),
  makeRequest: (url, options) => ipcRenderer.invoke('make-request', url, options),
  uploadToCos: (buffer, options) => ipcRenderer.invoke('upload-to-cos', buffer, options),
  setCorsOrigins: (baseUrls) => ipcRenderer.invoke('set-cors-origins', baseUrls),
  clearCookies: () => ipcRenderer.invoke('clear-cookies'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  checkDir: (targetPath) => ipcRenderer.invoke('check-dir', targetPath),
  downloadFile: (url, savePath, taskId, headers) => ipcRenderer.invoke('download-file', url, savePath, taskId, headers),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),
  readDataFile: (filename) => ipcRenderer.invoke('read-data-file', filename),
  writeDataFile: (filename, data) => ipcRenderer.invoke('write-data-file', filename, data),
  encryptString: (plainText) => ipcRenderer.invoke('encrypt-string', plainText),
  decryptString: (encrypted) => ipcRenderer.invoke('decrypt-string', encrypted),
  onDownloadProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('download-progress', listener);
    return () => ipcRenderer.removeListener('download-progress', listener);
  },
});
