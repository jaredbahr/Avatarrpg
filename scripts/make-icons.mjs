/**
 * Generates the PWA icon PNGs from scratch — no binary assets checked in by
 * hand, no image library. Writes minimal, valid 8-bit RGBA PNGs using zlib.
 *
 *   node scripts/make-icons.mjs
 *
 * The mark is the four-nations quadrant wheel: fire / water / earth / air
 * around a dark centre. Re-run after changing the palette below.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../public/icons');

const BG = [0x1b, 0x14, 0x10, 0xff];
const QUADRANTS = [
  [0xd1, 0x46, 0x2f, 0xff], // fire   - top left
  [0x3e, 0x8f, 0xb0, 0xff], // water  - top right
  [0x6f, 0x9e, 0x4c, 0xff], // earth  - bottom right
  [0xe8, 0xdc, 0xc0, 0xff], // air    - bottom left
];
const RING = [0xd9, 0xa4, 0x41, 0xff];
const CORE = [0x12, 0x0d, 0x0a, 0xff];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const rgba = pixel(x, y, size);
      const o = rowStart + 1 + x * 4;
      raw[o] = rgba[0];
      raw[o + 1] = rgba[1];
      raw[o + 2] = rgba[2];
      raw[o + 3] = rgba[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** @param {number} inset fraction of the canvas kept clear (maskable safe zone) */
function mark(inset) {
  return (x, y, size) => {
    const cx = size / 2;
    const cy = size / 2;
    const r = (size / 2) * (1 - inset);
    const dx = x - cx + 0.5;
    const dy = y - cy + 0.5;
    const dist = Math.hypot(dx, dy);

    if (dist > r) return BG;
    if (dist > r * 0.93) return RING;
    if (dist < r * 0.22) return CORE;

    // Quadrants, starting top-left and running clockwise.
    const q = dx >= 0 ? (dy < 0 ? 1 : 2) : dy < 0 ? 0 : 3;
    const base = QUADRANTS[q];
    // Subtle radial shading so the mark is not four flat blocks.
    const shade = 0.82 + 0.18 * (1 - dist / r);
    return [
      Math.round(base[0] * shade),
      Math.round(base[1] * shade),
      Math.round(base[2] * shade),
      255,
    ];
  };
}

mkdirSync(outDir, { recursive: true });

const targets = [
  ['icon-192.png', 192, 0.06],
  ['icon-512.png', 512, 0.06],
  ['icon-512-maskable.png', 512, 0.22],
  ['apple-touch-icon.png', 180, 0.02],
];

for (const [name, size, inset] of targets) {
  writeFileSync(resolve(outDir, name), png(size, mark(inset)));
  console.log(`wrote icons/${name} (${size}x${size})`);
}

// An SVG favicon so the browser tab stays crisp at any size.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Four Nations Tactics">
  <circle cx="32" cy="32" r="31" fill="#1b1410"/>
  <g>
    <path d="M32 32 L32 4 A28 28 0 0 0 4 32 Z" fill="#d1462f"/>
    <path d="M32 32 L60 32 A28 28 0 0 0 32 4 Z" fill="#3e8fb0"/>
    <path d="M32 32 L32 60 A28 28 0 0 0 60 32 Z" fill="#6f9e4c"/>
    <path d="M32 32 L4 32 A28 28 0 0 0 32 60 Z" fill="#e8dcc0"/>
  </g>
  <circle cx="32" cy="32" r="28" fill="none" stroke="#d9a441" stroke-width="3"/>
  <circle cx="32" cy="32" r="7" fill="#120d0a"/>
</svg>
`;
writeFileSync(resolve(outDir, 'favicon.svg'), favicon);
console.log('wrote icons/favicon.svg');
