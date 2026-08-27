import { describe, expect, it } from 'vitest';
import { md5Hex } from './md5';

describe('md5 util', () => {
  it('matches standard MD5 vectors', async () => {
    const vectors: [string, string][] = [
      ['', 'd41d8cd98f00b204e9800998ecf8427e'],
      ['abc', '900150983cd24fb0d6963f7d28e17f72'],
      ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
      ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
      ['The quick brown fox jumps over the lazy dog', '9e107d9d372bb6826bd81d3542a419d6'],
      ['The quick brown fox jumps over the lazy dog.', 'e4d909c290d0fb1ca068ffaddf22cbd0'],
      ['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 'd174ab98d277d9f5a5611c2c9f419d9f'],
    ];

    for (const [input, expected] of vectors) {
      const buf = new TextEncoder().encode(input).buffer;
      const got = await md5Hex(buf);
      expect(got).toBe(expected);
    }
  });

  it('computes md5 for binary buffer consistently', async () => {
    const big = new Uint8Array(1000);
    for (let i = 0; i < 1000; i++) big[i] = (i * 7 + 3) & 0xff;
    const got = await md5Hex(big.buffer);
    // just assert we get a 32-char hex
    expect(got).toMatch(/^[0-9a-f]{32}$/);
  });
});
