// Generates the static Workbench Meter icon at 16/48/128 px into public/assets/.
// Vite copies these files into dist/assets/. Run with: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/assets');

const TRANSPARENT = [0, 0, 0, 0];
const CASING = [26, 27, 23, 255];       // #1a1b17
const BORDER = [106, 102, 89, 255];     // #6a6659
const TRACK = [64, 63, 55, 255];        // #403f37
const ACCENT = [228, 147, 80, 255];     // #e49350

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function inRoundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x >= right || y < top || y >= bottom) return false;
  const cx = x < left + radius ? left + radius : x >= right - radius ? right - radius - 1 : x;
  const cy = y < top + radius ? top + radius : y >= bottom - radius ? bottom - radius - 1 : y;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function pngForSize(size) {
  const inset = Math.max(1, Math.round(size * 0.05));
  const radius = Math.max(2, Math.round(size * 0.2));
  const borderWidth = Math.max(1, Math.round(size * 0.045));
  const innerInset = inset + borderWidth;
  const innerRadius = Math.max(1, radius - borderWidth);

  const barPad = Math.max(3, Math.round(size * 0.2));
  const gap = Math.max(1, Math.round(size * 0.07));
  const barWidth = Math.max(1, Math.floor((size - barPad * 2 - gap * 2) / 3));
  const barTop = barPad;
  const barBottom = size - barPad;
  const barHeight = barBottom - barTop;
  const fills = [0.46, 0.78, 0.28];

  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      let px = TRANSPARENT;
      const inCase = inRoundedRect(x, y, inset, inset, size - inset, size - inset, radius);
      if (inCase) {
        const inInner = inRoundedRect(x, y, innerInset, innerInset, size - innerInset, size - innerInset, innerRadius);
        px = inInner ? CASING : BORDER;

        for (let i = 0; i < 3; i++) {
          const left = barPad + i * (barWidth + gap);
          const right = left + barWidth;
          if (x >= left && x < right && y >= barTop && y < barBottom) {
            const fillTop = barBottom - Math.max(1, Math.round(barHeight * fills[i]));
            px = y >= fillTop ? ACCENT : TRACK;
          }
        }
      }
      raw[o++] = px[0];
      raw[o++] = px[1];
      raw[o++] = px[2];
      raw[o++] = px[3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 48, 128]) {
  writeFileSync(resolve(OUT_DIR, `icon${size}.png`), pngForSize(size));
  console.log(`wrote public/assets/icon${size}.png`);
}
