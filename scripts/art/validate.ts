/**
 * Every sheet the manifest names, checked against the files on disk.
 *
 *   npx tsx scripts/art/validate.ts
 *
 * `validateContent` already checks the manifest's shape and clip table in the
 * unit tests; this is the half that needs the files: the atlas JSON exists
 * under `public/`, parses, names every frame the clips use at the size the
 * entry promises, points at a PNG that exists at the size the JSON claims,
 * stays inside 2048 px, and keeps the art bible's clear margin on every
 * frame's border. Exit 1 on any problem, so CI can run it.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CLIP_NAMES } from '../../src/content/assets/clips';
import { ASSETS } from '../../src/content/assets/manifest';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import { MARGIN } from './lib/align';
import type { Image } from './lib/image';
import { readPng } from './lib/image';

const MAX_ATLAS = 2048;

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

if (process.argv[1]?.endsWith('validate.ts')) {
  const problems = validateSheets();
  if (problems.length === 0) {
    console.log('Every sheet in the manifest checks out.');
    process.exit(0);
  }
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
