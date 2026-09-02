import { describe, expect, it } from 'vitest';
import { md5HexAsync } from './md5Async';
import { md5Hex } from './md5';

describe('md5HexAsync', () => {
  it('Worker 不可用时回退同步实现且结果一致', async () => {
    const data = new TextEncoder().encode('hello world').buffer as ArrayBuffer;
    const expected = md5Hex(data);
    expect(await md5HexAsync(data)).toBe(expected);
    // 回退路径不得转移/消耗调用方 buffer
    expect(data.byteLength).toBe(11);
  });
});
