/**
 * WebP for the map paintings: encoding through libwebp compiled to wasm
 * (`@jsquash/webp`, dev-only, nothing native to build), and reading a file's
 * size back from its header without decoding it, for the validator.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import encode, { init } from '@jsquash/webp/encode.js';
import type { Image } from './image';

let ready: Promise<unknown> | null = null;

/**
 * The package's glue fetches its wasm over HTTP, which a script has no server
 * for, so the module is compiled from the package's own file and handed in.
 * Node has had SIMD since 16.4, which is the variant the glue picks.
 */
function encoder(): Promise<unknown> {
  if (!ready) {
    const require = createRequire(import.meta.url);
    const wasm = readFileSync(require.resolve('@jsquash/webp/codec/enc/webp_enc_simd.wasm'));
    ready = WebAssembly.compile(wasm).then((module) => init(module));
  }
  return ready;
}

/** Lossy WebP at `quality` (0-100). Paintings are opaque; alpha is forced to 255. */
export async function encodeWebp(image: Image, quality: number): Promise<Uint8Array> {
  await encoder();
  const data = new Uint8ClampedArray(image.data.length);
  data.set(image.data);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const pixels = { data, width: image.width, height: image.height, colorSpace: 'srgb' };
  const buffer = await encode(pixels as ImageData, { quality });
  return new Uint8Array(buffer);
}

const ascii = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

/**
 * The pixel size in a WebP's header: the lossy frame's 14-bit dimensions,
 * the lossless stream's, or the extended container's canvas. Null when the
 * bytes are not a WebP.
 */
export function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    return null;
  }
  const chunk = ascii(bytes, 12, 4);
  const p = 20;
  const at = (i: number): number => bytes[i] ?? 0;
  if (chunk === 'VP8 ') {
    // A key frame: 3 bytes of frame tag, the start code 9d 01 2a, then two 14-bit sizes.
    if (at(p + 3) !== 0x9d || at(p + 4) !== 0x01 || at(p + 5) !== 0x2a) return null;
    return {
      width: (at(p + 6) | (at(p + 7) << 8)) & 0x3fff,
      height: (at(p + 8) | (at(p + 9) << 8)) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    if (at(p) !== 0x2f) return null;
    const bits = (at(p + 1) | (at(p + 2) << 8) | (at(p + 3) << 16) | (at(p + 4) << 24)) >>> 0;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return {
      width: 1 + (at(p + 4) | (at(p + 5) << 8) | (at(p + 6) << 16)),
      height: 1 + (at(p + 7) | (at(p + 8) << 8) | (at(p + 9) << 16)),
    };
  }
  return null;
}
