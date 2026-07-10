type Validator<T> = (value: unknown) => value is T;

type StorageErrorHandler = (error: unknown) => void;

const getLocalStorage = (): Storage | undefined => {
  try {
    if (typeof window === 'undefined') return undefined;
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export function parseJson<T>(raw: string | null | undefined, fallback: T, validator?: Validator<T>): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return validator && !validator(parsed) ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

export function readJsonStorage<T>(key: string, fallback: T, validator?: Validator<T>): T {
  const storage = getLocalStorage();
  if (!storage) return fallback;
  return parseJson(storage.getItem(key), fallback, validator);
}

export function writeJsonStorage<T>(key: string, value: T, onError?: StorageErrorHandler): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    onError?.(error);
    return false;
  }
}

export function removeStorageKey(key: string, onError?: StorageErrorHandler): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    onError?.(error);
    return false;
  }
}

/**
 * 通过 Electron IPC 读取 userData 目录下的 JSON 文件。
 * 在非 Electron 环境（如测试）中返回 fallback。
 */
export async function readDataFileAsync<T>(filename: string, fallback: T): Promise<T> {
  try {
    const api = window.electronAPI;
    if (!api?.readDataFile) return fallback;
    const data = await api.readDataFile(filename);
    return (data ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/**
 * 通过 Electron IPC 将数据写入 userData 目录下的 JSON 文件（原子写入）。
 * 在非 Electron 环境（如测试）中静默失败。
 */
export async function writeDataFileAsync(filename: string, data: unknown): Promise<boolean> {
  try {
    const api = window.electronAPI;
    if (!api?.writeDataFile) return false;
    const result = await api.writeDataFile(filename, data);
    return result?.success === true;
  } catch {
    return false;
  }
}
