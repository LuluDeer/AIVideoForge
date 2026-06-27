export interface ElectronApi {
  selectFolder: () => Promise<{ success?: boolean; path?: string }>;
  setCookies: (ck: string) => Promise<unknown>;
  downloadFile: (url: string, path: string) => Promise<{ success: boolean; filePath: string; savePath: string }>;
  openPath: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
  makeRequest: (url: string, options: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null | undefined;
  }) => Promise<{ status: number; body: string; headers: Record<string, string> }>;
  uploadToCos: (data: number[], options: {
    url: string;
    headers: Record<string, string>;
  }) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronApi;
  }
}