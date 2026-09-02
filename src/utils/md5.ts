/**
 * 计算二进制数据的标准 MD5 十六进制摘要。
 *
 * 注：不要在密钥派生等安全场景使用 MD5，这里仅用于文件去重/命名等场景。
 * 实现已用 RFC 1321 标准测试向量校验（见 md5.test.ts）。
 */
export function md5Hex(input: ArrayBuffer): string {
  const bytes = new Uint8Array(input);
  const bitLen = bytes.length * 8;
  const padLen = ((448 - (bitLen % 512)) + 512) % 512;
  const padded = new Uint8Array(bitLen / 8 + padLen / 8 + 8);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  // MD5 规范：64 位长度以小端序写入（低 32 位在前）
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);
  const M = new Uint32Array(padded.buffer);
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
             5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
             4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
             6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);
  const h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];
  const rot = (x: number, n: number): number => (x << n) | (x >>> (32 - n));
  for (let i = 0; i < M.length; i += 16) {
    const w = M.subarray(i, i + 16);
    let [a, b, c, d] = h;
    for (let j = 0; j < 64; j++) {
      let f: number;
      let g: number;
      if (j < 16) { f = (b & c) | (~b & d); g = j; }
      else if (j < 32) { f = (d & b) | (~d & c); g = (5 * j + 1) % 16; }
      else if (j < 48) { f = b ^ c ^ d; g = (3 * j + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * j) % 16; }
      const tmp = d; d = c; c = b;
      b = (b + rot(a + f + K[j] + w[g], s[j])) >>> 0;
      a = tmp;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
  }
  // MD5 摘要要求每个 32 位字以小端序字节输出，toString(16) 是大端序，需按字节反转
  return h.map(x => {
    const hex = x.toString(16).padStart(8, '0');
    return hex[6] + hex[7] + hex[4] + hex[5] + hex[2] + hex[3] + hex[0] + hex[1];
  }).join('');
}
