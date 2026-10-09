/**
 * WebP for the map paintings and lossy sheets: encoding and decoding through
 * libwebp compiled to wasm (`@jsquash/webp`, dev-only, nothing native to
 * build), and reading a file's size back from its header without decoding it.
 * A lossy sheet is validated on its decoded pixels, since that is what ships.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import decode, { init as initDecoder } from '@jsquash/webp/decode.js';
import encode, { init } from '@jsquash/webp/encode.js';
import type { EncodeOptions } from '@jsquash/webp/meta.js';
import type { Image } from './image';
import { LOSSY_MAX_RGB, LOSSY_MEAN_RGB, lossyError } from './lossy-compare';

let ready: Promise<unknown> | null = null;
let decoderReady: Promise<unknown> | null = null;

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

function decoder(): Promise<unknown> {
  if (!decoderReady) {
    const require = createRequire(import.meta.url);
    const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
    decoderReady = WebAssembly.compile(wasm).then((module) => initDecoder(module));
  }
  return decoderReady;
}

/** The RGBA pixels a browser draws for a WebP file. */
export async function decodeWebp(bytes: Uint8Array): Promise<Image> {
  await decoder();
  const decoded = await decode(bytes as unknown as ArrayBuffer);
  return {
    width: decoded.width,
    height: decoded.height,
    data: new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
  };
}

/** Lossless WebP, exact to the pixel; test fixtures derive from decoded atlases with it. */
export async function encodeWebpLossless(image: Image): Promise<Uint8Array> {
  await encoder();
  const data = new Uint8ClampedArray(image.data.length);
  data.set(image.data);
  const pixels = { data, width: image.width, height: image.height, colorSpace: 'srgb' };
  const buffer = await encode(pixels as ImageData, {
    lossless: 1,
    quality: 0,
    method: 0,
    exact: 1,
  });
  return new Uint8Array(buffer);
}

/**
 * Lossy WebP; ordinary paintings are opaque, upright scene layers retain alpha.
 * The alpha plane is coded losslessly (the encoder's default `alpha_quality`
 * of 100), so a transparent edge never moves; `options` override the rest.
 */
export async function encodeWebp(
  image: Image,
  quality: number,
  preserveAlpha = false,
  options: Partial<EncodeOptions> = {},
): Promise<Uint8Array> {
  await encoder();
  const data = new Uint8ClampedArray(image.data.length);
  data.set(image.data);
  if (!preserveAlpha) for (let i = 3; i < data.length; i += 4) data[i] = 255;
  const pixels = { data, width: image.width, height: image.height, colorSpace: 'srgb' };
  const buffer = await encode(pixels as ImageData, { quality, ...options });
  return new Uint8Array(buffer);
}

/**
 * Upright scenery and surround atlases: lossy with an exact alpha plane. Chosen
 * from a 4x comparison sheet (not kept): q85 softens small
 * flowers, q90 shows no ringing or edge halo. Sharp YUV keeps the outline's
 * colour from bleeding into the transparent side of the edge.
 */
export const UPRIGHT_WEBP_QUALITY = 90;
export const UPRIGHT_WEBP_OPTIONS: Partial<EncodeOptions> = { method: 6, use_sharp_yuv: 1 };

/**
 * Encode an upright piece or atlas the way it ships: q90, stepping up one
 * quality at a time only when the decoded pixels miss the fine-grain contract
 * (`lossyError` limits). Pieces that already meet it stay byte-identical; the
 * finest-grained paintings need a few steps more. Throws when even q100 misses it.
 */
export async function encodeUprightWebp(image: Image): Promise<Uint8Array> {
  for (let quality = UPRIGHT_WEBP_QUALITY; ; quality++) {
    const bytes = await encodeWebp(image, quality, true, UPRIGHT_WEBP_OPTIONS);
    const error = lossyError(image, await decodeWebp(bytes));
    if (error.maxRgb <= LOSSY_MAX_RGB && error.meanRgb < LOSSY_MEAN_RGB) return bytes;
    if (quality >= 100)
      throw new Error(
        `encodeUprightWebp: q100 still misses the lossy contract (max ${error.maxRgb}, mean ${error.meanRgb.toFixed(2)}); fit the source first`,
      );
  }
}

const ascii = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

/** True when a RIFF WebP contains a lossless VP8L image chunk. */
export function isLosslessWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP')
    return false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    // Unsigned: a corrupt chunk size with its top bit set must not walk backwards.
    const size =
      ((bytes[offset + 4] ?? 0) |
        ((bytes[offset + 5] ?? 0) << 8) |
        ((bytes[offset + 6] ?? 0) << 16) |
        ((bytes[offset + 7] ?? 0) << 24)) >>>
      0;
    if (ascii(bytes, offset, 4) === 'VP8L') return true;
    offset += 8 + size + (size & 1);
  }
  return false;
}

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
