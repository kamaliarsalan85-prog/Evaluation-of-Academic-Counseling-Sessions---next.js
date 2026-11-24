import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter None
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), rowStart + 1);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function hexToRgba(hex: string): [number, number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function inRoundedRect(
  x: number,
  y: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  radius: number
): boolean {
  if (x < rx || x > rx + rw || y < ry || y > ry + rh) return false;
  const cx = Math.max(rx + radius, Math.min(x, rx + rw - radius));
  const cy = Math.max(ry + radius, Math.min(y, ry + rh - radius));
  return Math.hypot(x - cx, y - cy) <= radius;
}

function renderIcon(size: number, maskable: boolean): Buffer {
  const rgba = new Uint8Array(size * size * 4);
  const navy = hexToRgba('#142B4A');
  const white = hexToRgba('#FFFFFF');
  const blue = hexToRgba('#2878D0');
  const slate = hexToRgba('#E2E8F0');
  const green = hexToRgba('#20A36B');

  const padScale = maskable ? 0.72 : 0.88;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // Map pixel to virtual 512x512 canvas centered
      const nx = ((px + 0.5) / size - 0.5) / padScale + 0.5;
      const ny = ((py + 0.5) / size - 0.5) / padScale + 0.5;
      const x = nx * 512;
      const y = ny * 512;

      let color = navy;

      // White clipboard body
      if (inRoundedRect(x, y, 96, 88, 320, 344, 40)) {
        color = white;
      }
      // Blue top clip
      if (inRoundedRect(x, y, 184, 64, 144, 52, 18)) {
        color = blue;
      }
      // Two form lines
      if (inRoundedRect(x, y, 148, 168, 216, 24, 12)) {
        color = slate;
      }
      if (inRoundedRect(x, y, 148, 220, 168, 24, 12)) {
        color = slate;
      }
      // Green badge
      if (Math.hypot(x - 256, y - 328) <= 58) {
        color = green;
        const d1 = distToSegment(x, y, 230, 328, 248, 346);
        const d2 = distToSegment(x, y, 248, 346, 284, 308);
        if (Math.min(d1, d2) <= 9) {
          color = white;
        }
      }

      const idx = (py * size + px) * 4;
      rgba[idx] = color[0];
      rgba[idx + 1] = color[1];
      rgba[idx + 2] = color[2];
      rgba[idx + 3] = color[3];
    }
  }

  return encodePng(size, size, rgba);
}

const publicDir = path.resolve(process.cwd(), 'public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), renderIcon(192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), renderIcon(512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), renderIcon(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), renderIcon(180, false));
console.log('Generated PWA PNG icons in public/.');
