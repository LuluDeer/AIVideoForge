// md5 utility: prefer Node's crypto when available (fast, reliable).
// Fallback: small JS implementation (kept for browser/renderer).
// Exports: async function md5Hex(buffer: ArrayBuffer): Promise<string>

async function jsMd5Hex(input: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(input);
  const bitLen = bytes.length * 8;
  const padLen = ((448 - (bitLen % 512)) + 512) % 512;
  const padded = new Uint8Array(bitLen / 8 + padLen / 8 + 8);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  // write little-endian length: low 32 bits then high 32 bits
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);
  const M = new Uint32Array(padded.buffer);
  const s = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
             5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
             4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
             6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const K = Array.from({length:64}, (_, i) => Math.floor(Math.abs(Math.sin(i+1)) * 0x100000000) >>> 0);
  const h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];
  const rot = (x:number,n:number) => (x << n) | (x >>> (32 - n));
  for (let i = 0; i < M.length; i += 16) {
    const w = M.subarray(i, i + 16);
    let [a,b,c,d] = h;
    for (let j = 0; j < 64; j++) {
      let f:number, g:number;
      if (j < 16) { f = (b & c) | (~b & d); g = j; }
      else if (j < 32) { f = (d & b) | (~d & c); g = (5 * j + 1) % 16; }
      else if (j < 48) { f = b ^ c ^ d; g = (3 * j + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * j) % 16; }
      const tmp = d; d = c; c = b;
      b = (b + rot((a + f + K[j] + (w[g] >>> 0)) >>> 0, s[j])) >>> 0;
      a = tmp;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
  }
  // output little-endian hex per 32-bit word
  return h.map(x => {
    const hex = x.toString(16).padStart(8, '0');
    return hex[6]+hex[7]+hex[4]+hex[5]+hex[2]+hex[3]+hex[0]+hex[1];
  }).join('');
}

export async function md5Hex(buffer: ArrayBuffer): Promise<string> {
  try {
    if (typeof process !== 'undefined' && (process as any).versions && (process as any).versions.node) {
      const crypto = await import('crypto');
      const b = Buffer.from(buffer);
      return crypto.createHash('md5').update(b).digest('hex');
    }
  } catch {
    // fall back to JS impl
  }
  return await jsMd5Hex(buffer);
}
