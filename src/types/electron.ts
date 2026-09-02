export interface DownloadProgressPayload {
  taskId: string;
  progress: number;
  receivedBytes: number;
  totalBytes: number;
}

export interface HttpProxyConfig {
  useSystemProxy: boolean;
  httpProxy?: string;
}

export interface CheckDirResult {
  success: boolean;
  exists?: boolean;
  error?: string;
}

export interface ElectronApi {
  selectFolder: () => Promise<{ success?: boolean; path?: string }>;
  checkDir: (targetPath: string) => Promise<CheckDirResult>;
  setCookies: (ck: string) => Promise<unknown>;
  setHttpProxyConfig: (config: HttpProxyConfig) => Promise<{ success: boolean; error?: string }>;
  downloadFile: (url: string, path: string, taskId?: string, headers?: Record<string, string>) => Promise<{ success: boolean; filePath: string; savePath: string }>;
  openPath: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
  onDownloadProgress: (callback: (payload: DownloadProgressPayload) => void) => () => void;
  makeRequest: (url: string, options: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null | undefined;
  }) => Promise<{ status: number; body: string; headers: Record<string, string> }>;
  uploadToCos: (data: Uint8Array | ArrayBuffer | number[], options: {
    url: string;
    headers: Record<string, string>;
  }) => Promise<void>;
  setCorsOrigins: (baseUrls: string[]) => Promise<{ success: boolean; error?: string }>;
  clearCookies: () => Promise<{ success: boolean; error?: string }>;
  readDataFile: (filename: string) => Promise<unknown>;
  writeDataFile: (filename: string, data: unknown) => Promise<{ success: boolean; error?: string }>;
  encryptString: (plainText: string) => Promise<{ success: boolean; encrypted?: string; available?: boolean; error?: string }>;
  decryptString: (encrypted: string) => Promise<{ success: boolean; decrypted?: string; error?: string }>;
}

export interface UpdateInfo {
  version: string;
  url: string;
  publishedAt?: string;
  error?: string;
}

export interface UpdateApi {
  checkForUpdates: () => Promise<UpdateInfo>;
  openDownload: (url: string) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronApi;
    updateAPI?: UpdateApi;
  }
}
