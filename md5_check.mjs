// 临时验证脚本：逐字复制 cloudreveUpload.ts 的 md5Hex 和 imageUpload.ts 修复后的 md5Fallback
// 用标准 MD5 测试向量和 Python hashlib 交叉验证

function cloudreveMd5(input) {
  const bytes = new Uint8Array(input);
  const bitLen = bytes.length * 8;
  const padLen = ((448 - (bitLen % 512)) + 512) % 512;
  const padded = new Uint8Array(bitLen / 8 + padLen / 8 + 8);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);
  const M = new Uint32Array(padded.buffer);
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
             5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
             4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
             6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);
  const h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];
  const rot = (x, n) => (x << n) | (x >>> (32 - n));
  for (let i = 0; i < M.length; i += 16) {
    const w = M.subarray(i, i + 16);
    let [a, b, c, d] = h;
    for (let j = 0; j < 64; j++) {
      let f, g;
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
    const hex = x.toString(16).padStart(8, "0");
    return hex[6] + hex[7] + hex[4] + hex[5] + hex[2] + hex[3] + hex[0] + hex[1];
  }).join("");
}

function imageUploadMd5(input) {
  const data = new Uint8Array(input);
  const s = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];
  const K = [0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391];
  // MD5 每 16 轮用同一组位移量，共 4 组；必须按 j 取扁平 64 项，不能 [j % 16]
  const SHIFT = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
                 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
                 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
                 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const pad = (data) => {
    const bitLength = data.length * 8;
    const paddingLength = (448 - (bitLength % 512) + 512) % 512;
    const totalLength = bitLength + paddingLength + 64;
    const bytes = new Uint8Array(totalLength / 8);
    bytes.set(data); bytes[data.length] = 0x80;
    const view = new DataView(bytes.buffer);
    view.setBigUint64(bytes.length - 8, BigInt(bitLength), true);
    return new Uint32Array(bytes.buffer);
  };
  const rotateLeft = (x, n) => (x << n) | (x >>> (32 - n));
  const blocks = pad(data);
  for (let i = 0; i < blocks.length; i += 16) {
    const M = blocks.subarray(i, i + 16);
    let [a, b, c, d] = s;
    for (let j = 0; j < 64; j++) {
      let f, g;
      if (j < 16) { f = (b & c) | (~b & d); g = j; }
      else if (j < 32) { f = (d & b) | (~d & c); g = (5 * j + 1) % 16; }
      else if (j < 48) { f = b ^ c ^ d; g = (3 * j + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * j) % 16; }
      const temp = d; d = c; c = b;
      b = (b + rotateLeft(a + f + K[j] + M[g], SHIFT[j])) >>> 0;
      a = temp;
    }
    s[0] = (s[0] + a) >>> 0; s[1] = (s[1] + b) >>> 0; s[2] = (s[2] + c) >>> 0; s[3] = (s[3] + d) >>> 0;
  }
  // MD5 摘要要求每个 32 位字以小端序字节输出，toString(16) 是大端序，需按字节反转
  return s.map(x => {
    const hex = x.toString(16).padStart(8, '0');
    return hex[6] + hex[7] + hex[4] + hex[5] + hex[2] + hex[3] + hex[0] + hex[1];
  }).join('');
}

const vectors = [
  ["", "d41d8cd98f00b204e9800998ecf8427e"],
  ["abc", "900150983cd24fb0d6963f7d28e17f72"],
  ["message digest", "f96b697d7cb7938d525a2f31aaf161d0"],
  ["abcdefghijklmnopqrstuvwxyz", "c3fcd3d76192e4007dfb496cca67e13b"],
  ["The quick brown fox jumps over the lazy dog", "9e107d9d372bb6826bd81d3542a419d6"],
  ["The quick brown fox jumps over the lazy dog.", "e4d909c290d0fb1ca068ffaddf22cbd0"],
  ["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", "d174ab98d277d9f5a5611c2c9f419d9f"],
];

let allOk = true;
for (const [input, expected] of vectors) {
  const buf = new TextEncoder().encode(input).buffer;
  const a = cloudreveMd5(buf);
  const b = imageUploadMd5(buf);
  const ok = a === expected && b === expected;
  if (!ok) allOk = false;
  console.log(JSON.stringify(input.length > 30 ? input.slice(0, 30) + "..." : input), "cloudreveMd5:", a, "imageUploadMd5:", b, ok ? "PASS" : "FAIL (expected " + expected + ")");
}

const big = new Uint8Array(1000);
for (let i = 0; i < 1000; i++) big[i] = (i * 7 + 3) & 0xff;
console.log("1000-byte binary  cloudreveMd5:", cloudreveMd5(big.buffer));
console.log("1000-byte binary  imageUploadMd5:", imageUploadMd5(big.buffer));
console.log(allOk ? "=== ALL VECTORS PASS ===" : "=== VECTOR MISMATCH ===");
