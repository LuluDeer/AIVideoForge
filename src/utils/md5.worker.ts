/// <reference lib="webworker" />
/**
 * MD5 计算 Worker：把大文件摘要从渲染进程主线程移开，避免上传时 UI 冻结。
 * 注意：主线程通过结构化克隆传入 buffer（不转移），原 buffer 在调用方仍可继续使用。
 */
import { md5Hex } from './md5';

interface Md5Request {
  id: number;
  buffer: ArrayBuffer;
}

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<Md5Request>) => void) | null;
  postMessage: (message: { id: number; hex: string | null }) => void;
};

ctx.onmessage = (event) => {
  const { id, buffer } = event.data;
  try {
    ctx.postMessage({ id, hex: md5Hex(buffer) });
  } catch {
    ctx.postMessage({ id, hex: null });
  }
};
