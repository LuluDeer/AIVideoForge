const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setCookies: (ck) => ipcRenderer.invoke('set-cookies', ck),
  makeRequest: (url, options) => ipcRenderer.invoke('make-request', url, options),
  uploadToCos: (buffer, options) => ipcRenderer.invoke('upload-to-cos', buffer, options),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  downloadFile: (url, savePath) => ipcRenderer.invoke('download-file', url, savePath),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),
});
