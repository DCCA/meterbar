// Joins animated WebPs (same canvas) into one: VP8X and ANIM from the first, then every
// ANMF frame in order. Each img2webp output starts with a full-canvas, non-blended frame,
// so every join point is a clean keyframe. render.sh splits the video right after its big
// fades: libwebp's lossy animation encoder otherwise keeps a faint ghost of a faded layer
// until its next keyframe, and it gives no way to request one at a given frame.
// Usage: node concat-webp.mjs out.webp in1.webp in2.webp ...
import { readFileSync, writeFileSync } from 'node:fs';

function chunks(file) {
  const data = readFileSync(file);
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`${file}: not a WebP file`);
  }
  const out = [];
  for (let i = 12; i + 8 <= data.length;) {
    const size = data.readUInt32LE(i + 4);
    const end = i + 8 + size + (size & 1);
    out.push({ id: data.toString('ascii', i, i + 4), bytes: data.subarray(i, end) });
    i = end;
  }
  return out;
}

const [outFile, ...inputs] = process.argv.slice(2);
if (!outFile || inputs.length === 0) {
  console.error('usage: node concat-webp.mjs out.webp in1.webp [in2.webp ...]');
  process.exit(2);
}

const first = chunks(inputs[0]);
const header = first.filter((c) => c.id === 'VP8X' || c.id === 'ANIM');
if (header.length !== 2) throw new Error(`${inputs[0]}: not an animated WebP`);
const canvas = header[0].bytes.subarray(12, 18).toString('hex');

/** ANMF payload bytes 12-14: the frame duration in ms (24-bit little-endian). */
const duration = (frame) => frame.readUIntLE(8 + 12, 3);

const frames = [];
for (const file of inputs) {
  const parts = chunks(file);
  const vp8x = parts.find((c) => c.id === 'VP8X');
  if (!vp8x || vp8x.bytes.subarray(12, 18).toString('hex') !== canvas) throw new Error(`${file}: canvas differs from ${inputs[0]}`);
  frames.push(...parts.filter((c) => c.id === 'ANMF').map((c) => c.bytes));
}

const body = Buffer.concat([Buffer.from('WEBP'), ...header.map((c) => c.bytes), ...frames]);
const riff = Buffer.alloc(8);
riff.write('RIFF', 0, 'ascii');
riff.writeUInt32LE(body.length, 4);
writeFileSync(outFile, Buffer.concat([riff, body]));

// Self-check: the joined file parses back to exactly the input frames and total duration.
const written = chunks(outFile).filter((c) => c.id === 'ANMF').map((c) => c.bytes);
const total = (list) => list.reduce((ms, f) => ms + duration(f), 0);
if (written.length !== frames.length || total(written) !== total(frames)) {
  throw new Error(`${outFile}: wrote ${written.length} frames / ${total(written)} ms, expected ${frames.length} / ${total(frames)}`);
}
console.log(`${outFile}: ${frames.length} frames, ${total(frames)} ms, from ${inputs.length} parts`);
