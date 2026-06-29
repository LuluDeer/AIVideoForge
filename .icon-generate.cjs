const fs = require('fs');
const zlib = require('zlib');

const size = 256;
const radius = 93;
const data = Buffer.alloc(size * size * 4);

const clamp = (value, min = 0, max = 255) => Math.max(min, Math.min(max, value));
const hexToRgb = (hex) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((value, index) => lerp(value, b[index], t));
const start = hexToRgb('#6877ff');
const end = hexToRgb('#19b7a7');

const roundedRectAlpha = (x, y) => {
  const innerLeft = radius;
  const innerRight = size - radius - 1;
  const innerTop = radius;
  const innerBottom = size - radius - 1;
  const cx = x < innerLeft ? innerLeft : x > innerRight ? innerRight : x;
  const cy = y < innerTop ? innerTop : y > innerBottom ? innerBottom : y;
  const dist = Math.hypot(x - cx, y - cy);
  return dist <= radius ? 255 : 0;
};

const setPixel = (x, y, rgba) => {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const idx = (y * size + x) * 4;
  const srcA = rgba[3] / 255;
  const dstA = data[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA === 0) return;
  data[idx] = clamp((rgba[0] * srcA + data[idx] * dstA * (1 - srcA)) / outA);
  data[idx + 1] = clamp((rgba[1] * srcA + data[idx + 1] * dstA * (1 - srcA)) / outA);
  data[idx + 2] = clamp((rgba[2] * srcA + data[idx + 2] * dstA * (1 - srcA)) / outA);
  data[idx + 3] = clamp(outA * 255);
};

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const alpha = roundedRectAlpha(x, y);
    if (!alpha) continue;
    const t = (x + y) / (size * 2 - 2);
    const color = mix(start, end, t);
    const idx = (y * size + x) * 4;
    data[idx] = color[0];
    data[idx + 1] = color[1];
    data[idx + 2] = color[2];
    data[idx + 3] = alpha;

    const highlight = Math.max(0, 1 - Math.hypot(x - 82, y - 72) / 28);
    if (highlight > 0) setPixel(x, y, [255, 255, 255, 220 * highlight]);
  }
}

const drawLine = (x1, y1, x2, y2, width, color) => {
  const minX = Math.floor(Math.min(x1, x2) - width);
  const maxX = Math.ceil(Math.max(x1, x2) + width);
  const minY = Math.floor(Math.min(y1, y2) - width);
  const maxY = Math.ceil(Math.max(y1, y2) + width);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = lengthSq === 0 ? 0 : clamp(((x - x1) * dx + (y - y1) * dy) / lengthSq, 0, 1);
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const dist = Math.hypot(x - px, y - py);
      const alpha = clamp((width / 2 + 0.9 - dist) * 255);
      if (alpha > 0) setPixel(x, y, [color[0], color[1], color[2], color[3] * alpha / 255]);
    }
  }
};

const drawSparkle = (cx, cy, outer, inner, width) => {
  drawLine(cx, cy - outer, cx, cy + outer, width, [255, 255, 255, 242]);
  drawLine(cx - outer, cy, cx + outer, cy, width, [255, 255, 255, 242]);
  drawLine(cx - inner, cy - inner, cx + inner, cy + inner, width, [255, 255, 255, 210]);
  drawLine(cx + inner, cy - inner, cx - inner, cy + inner, width, [255, 255, 255, 210]);
};

drawSparkle(128, 128, 69, 36, 10);
drawSparkle(201, 55, 21, 0, 7);
drawSparkle(41, 197, 13, 0, 6);

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, bytes) => {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, bytes])), 0);
  return Buffer.concat([length, typeBuffer, bytes, crc]);
};

const raw = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y += 1) {
  raw[y * (size * 4 + 1)] = 0;
  data.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync('public/app-icon.png', png);

const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);
icoHeader[6] = 0;
icoHeader[7] = 0;
icoHeader[8] = 0;
icoHeader[9] = 0;
icoHeader.writeUInt16LE(1, 10);
icoHeader.writeUInt16LE(32, 12);
icoHeader.writeUInt32LE(png.length, 14);
icoHeader.writeUInt32LE(22, 18);
fs.writeFileSync('public/app-icon.ico', Buffer.concat([icoHeader, png]));
console.log('Generated public/app-icon.png and public/app-icon.ico');
