import { md5Hex } from './md5';

/**
 * 异步 MD5：优先在 Web Worker 中计算，避免大文件（50-200MB）同步计算冻结主线程。
 * Worker 不可用（测试环境/浏览器降级）或计算失败时回退到同步实现。
 * buffer 通过结构化克隆传入，调用方保留原 buffer 继续使用。
 */
let worker: Worker | null = null;
let pendingId = 0;
const pending = new Map<number, (hex: string | null) => void>();

const getWorker = (): Worker | null => {
  if (typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./md5.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; hex: string | null }>) => {
      const resolve = pending.get(event.data.id);
      pending.delete(event.data.id);
      resolve?.(event.data.hex);
    };
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      pending.forEach(resolve => resolve(null));
      pending.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
};

export async function md5HexAsync(buffer: ArrayBuffer): Promise<string> {
  const activeWorker = getWorker();
  if (!activeWorker) return md5Hex(buffer);
  const id = ++pendingId;
  const hex = await new Promise<string | null>((resolve) => {
    pending.set(id, resolve);
    activeWorker.postMessage({ id, buffer });
  });
  pending.delete(id);
  return hex ?? md5Hex(buffer);
}
