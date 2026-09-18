/**
 * Every sheet and image the manifest names and every map painting the
 * content names, checked against the files on disk.
 *
 *   npx tsx scripts/art/validate.ts
 *
 * `validateContent` already checks the manifest's shape and clip table in the
 * unit tests; this is the half that needs the files: the atlas JSON exists
 * under `public/`, parses, names every frame the clips use at the size the
 * entry promises, points at a PNG that exists at the size the JSON claims,
 * stays inside 2048 px, and keeps the art bible's clear margin on every
 * frame's border; every `image` entry's file exists, is the PNG or WebP its
 * name says, and measures what its kind of key promises (a portrait is
 * 512x512), because the loader falls back to the drawn placeholder on a
 * missing file and a typo would otherwise ship green; and every map's
 * `backdrop` exists and measures the grid times its pixels a tile
 * (ADR 0009). Exit 1 on any problem, so CI can run it.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ALL_MAPS } from '../../src/content';
import { CLIP_NAMES } from '../../src/content/assets/clips';
import type { AssetEntry } from '../../src/content/assets/manifest';
import { ASSETS } from '../../src/content/assets/manifest';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import { MARGIN } from './lib/align';
import type { Image } from './lib/image';
import { imageSize, readPng } from './lib/image';
import { webpSize } from './lib/webp';
import { CEL_FRAMES, CEL_SIZE, FX_CEL_SHEETS } from '../../src/content/fxCels';

/** The largest texture every device in the matrix takes. */
const MAX_ATLAS = 2048;

/** What an image entry's file must measure, by key prefix; any other image key just has to fit a texture. */
export const IMAGE_SIZES: Readonly<Record<string, { width: number; height: number }>> = {
  'portrait.': { width: 512, height: 512 },
};

/** Larger than this and it is not the flat-shaded 512 px picture the packs ask for. */
export const MAX_IMAGE_BYTES = 512 * 1024;

/** True if any pixel on the frame's outer `margin` rows and columns is opaque. */
function borderTouched(
  image: Image,
  frame: { x: number; y: number; w: number; h: number },
  margin: number,
): boolean {
  for (let y = frame.y; y < frame.y + frame.h; y++) {
    for (let x = frame.x; x < frame.x + frame.w; x++) {
      const inBand =
        x < frame.x + margin ||
        x >= frame.x + frame.w - margin ||
        y < frame.y + margin ||
        y >= frame.y + frame.h - margin;
      if (!inBand) continue;
      if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) > 8) return true;
    }
  }
  return false;
}

export function validateSheets(publicDir = 'public'): string[] {
  const problems: string[] = [];
  for (const [key, entry] of Object.entries(ASSETS)) {
    if (entry.kind !== 'sheet') continue;
    const jsonPath = resolve(publicDir, entry.atlas);
    if (!existsSync(jsonPath)) {
      problems.push(`${key}: ${entry.atlas} is missing under ${publicDir}/`);
      continue;
    }
    let atlas;
    try {
      atlas = parseAtlasJson(readFileSync(jsonPath, 'utf8'));
    } catch (error) {
      problems.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (atlas.width > MAX_ATLAS || atlas.height > MAX_ATLAS) {
      problems.push(`${key}: atlas is ${atlas.width}x${atlas.height}; the limit is ${MAX_ATLAS}`);
    }
    const pngPath = join(dirname(jsonPath), atlas.image);
    if (!existsSync(pngPath)) {
      problems.push(`${key}: ${atlas.image} is missing beside ${entry.atlas}`);
      continue;
    }
    const image = readPng(pngPath);
    if (image.width !== atlas.width || image.height !== atlas.height) {
      problems.push(
        `${key}: ${atlas.image} is ${image.width}x${image.height}, the JSON says ${atlas.width}x${atlas.height}`,
      );
      continue;
    }
    const wantW = entry.pixelsPerTile * entry.footprint.w;
    const wantH = entry.pixelsPerTile * 1.5;
    for (const clip of CLIP_NAMES) {
      const def = entry.clips[clip];
      if (!def) continue;
      for (const name of def.frames) {
        const frame = atlas.frames.get(name);
        if (!frame) {
          problems.push(`${key}: frame "${name}" is not in ${entry.atlas}`);
          continue;
        }
        if (frame.w !== wantW || frame.h !== wantH) {
          problems.push(
            `${key}: frame "${name}" is ${frame.w}x${frame.h}, expected ${wantW}x${wantH}`,
          );
        }
        if (borderTouched(image, frame, MARGIN)) {
          problems.push(`${key}: frame "${name}" has art inside the ${MARGIN} px margin`);
        }
      }
    }
  }
  return problems;
}

/**
 * Every `image` entry: a site-relative url, a file under `public/` that is
 * the PNG or WebP its name says, at the size its kind of key promises.
 */
export function validateImages(
  publicDir = 'public',
  entries: Readonly<Record<string, AssetEntry>> = ASSETS,
): string[] {
  const problems: string[] = [];
  for (const [key, entry] of Object.entries(entries)) {
    if (entry.kind !== 'image') continue;
    if (/^[a-z]+:/i.test(entry.url) || entry.url.startsWith('/')) {
      problems.push(
        `${key}: ${entry.url} must be relative to the site root (the loader adds the base)`,
      );
      continue;
    }
    const path = resolve(publicDir, entry.url);
    if (!existsSync(path)) {
      problems.push(`${key}: ${entry.url} is missing under ${publicDir}/`);
      continue;
    }
    const bytes = new Uint8Array(readFileSync(path));
    if (bytes.length > MAX_IMAGE_BYTES) {
      problems.push(
        `${key}: ${entry.url} is ${Math.round(bytes.length / 1024)} KB; the limit is ${MAX_IMAGE_BYTES / 1024} KB`,
      );
    }
    const header = imageSize(bytes);
    if (!header || header.format === 'jpeg') {
      problems.push(`${key}: ${entry.url} must be a PNG or a WebP`);
      continue;
    }
    if (!entry.url.toLowerCase().endsWith(`.${header.format}`)) {
      problems.push(`${key}: ${entry.url} is a ${header.format} named as something else`);
    }
    const prefix = Object.keys(IMAGE_SIZES).find((candidate) => key.startsWith(candidate));
    const want = prefix ? IMAGE_SIZES[prefix] : undefined;
    if (want) {
      if (header.width !== want.width || header.height !== want.height) {
        problems.push(
          `${key}: ${entry.url} is ${header.width}x${header.height}, expected ${want.width}x${want.height}`,
        );
      }
    } else if (header.width > MAX_ATLAS || header.height > MAX_ATLAS) {
      problems.push(`${key}: ${entry.url} exceeds the ${MAX_ATLAS} px texture limit`);
    }
  }
  return problems;
}

/** Every map painting the content names: present, and the grid times its pixels a tile. */
export function validateBackdrops(publicDir = 'public'): string[] {
  const problems: string[] = [];
  for (const map of ALL_MAPS) {
    const backdrop = map.backdrop;
    if (!backdrop) continue;
    const path = resolve(publicDir, backdrop.url);
    if (!existsSync(path)) {
      problems.push(`${map.id}: ${backdrop.url} is missing under ${publicDir}/`);
      continue;
    }
    let size: { width: number; height: number } | null = null;
    if (backdrop.url.endsWith('.webp')) size = webpSize(new Uint8Array(readFileSync(path)));
    else if (backdrop.url.endsWith('.png')) size = readPng(path);
    else {
      problems.push(`${map.id}: ${backdrop.url} must be a .webp or a .png`);
      continue;
    }
    if (!size) {
      problems.push(`${map.id}: ${backdrop.url} is not a readable image`);
      continue;
    }
    const wantW = map.width * backdrop.pixelsPerTile;
    const wantH = map.height * backdrop.pixelsPerTile;
    if (size.width !== wantW || size.height !== wantH) {
      problems.push(
        `${map.id}: ${backdrop.url} is ${size.width}x${size.height}, expected ${wantW}x${wantH} ` +
          `(${map.width}x${map.height} tiles at ${backdrop.pixelsPerTile} px)`,
      );
    }
    if (size.width > MAX_ATLAS || size.height > MAX_ATLAS) {
      problems.push(`${map.id}: ${backdrop.url} exceeds the ${MAX_ATLAS} px texture limit`);
    }
  }
  return problems;
}

/** Cels need clear gutters so adjacent frames cannot bleed into a GPU sample. */
export function validateFxCels(publicDir = 'public'): string[] {
  const problems: string[] = [];
  for (const sheet of FX_CEL_SHEETS) {
    const path = resolve(publicDir, sheet.url);
    if (!existsSync(path)) {
      problems.push(`${sheet.url} is missing`);
      continue;
    }
    const image = readPng(path);
    if (image.width !== CEL_SIZE * CEL_FRAMES || image.height !== CEL_SIZE * sheet.clips.length) {
      problems.push(`${sheet.url} does not match its cel grid`);
      continue;
    }
    sheet.clips.forEach((clip, row) => {
      for (let col = 0; col < CEL_FRAMES; col++) {
        const frame = { x: col * CEL_SIZE, y: row * CEL_SIZE, w: CEL_SIZE, h: CEL_SIZE };
        if (borderTouched(image, frame, MARGIN)) problems.push(`${clip}/${col} touches its gutter`);
        let ink = 0;
        for (let y = frame.y; y < frame.y + frame.h; y++)
          for (let x = frame.x; x < frame.x + frame.w; x++)
            if ((image.data[(y * image.width + x) * 4 + 3] ?? 0) > 128) ink++;
        if (ink < 100) problems.push(`${clip}/${col} is empty or too faint`);
      }
    });
  }
  return problems;
}

if (process.argv[1]?.endsWith('validate.ts')) {
  const problems = [
    ...validateSheets(),
    ...validateImages(),
    ...validateBackdrops(),
    ...validateFxCels(),
  ];
  if (problems.length === 0) {
    console.log('Every sheet and image in the manifest and every map painting checks out.');
    process.exit(0);
  }
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
