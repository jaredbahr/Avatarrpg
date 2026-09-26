/**
 * Every sheet and image the manifest names and every map painting the
 * content names, checked against the files on disk.
 *
 *   npx tsx scripts/art/validate.ts
 *
 * `validateContent` already checks the manifest's shape and clip table in the
 * unit tests; this is the half that needs the files: the atlas JSON exists
 * under `public/`, parses, names every frame the clips use at the size the
 * entry promises, points at a PNG or WebP that exists at the size the JSON
 * claims, stays inside 2048 px, and keeps the art bible's clear margin on
 * every frame's border. A WebP sheet is lossy, so it is checked on its
 * decoded pixels: the margin, a pin per cel written by the sheet's build
 * script (a hand-edited or re-encoded cel fails), and, for a sheet declaring
 * eight-way locomotion, feet on the anchor's foot line, a rest cel's feet under
 * the column and each walk's mean foot row level with its idle's; every `image` entry's file exists, is the PNG or WebP its
 * name says, and measures what its kind of key promises (a portrait is
 * 512x512), because the loader falls back to the drawn placeholder on a
 * missing file and a typo would otherwise ship green; and every map's
 * `backdrop` exists and measures the grid times its pixels a tile
 * (ADR 0009). Exit 1 on any problem, so CI can run it.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ALL_MAPS } from '../../src/content';
import { CLIP_NAMES, HEADINGS, headingClip } from '../../src/content/assets/clips';
import type { AssetEntry } from '../../src/content/assets/manifest';
import { ASSETS } from '../../src/content/assets/manifest';
import { parseAtlasJson } from '../../src/render/sheets/atlasJson';
import { MARGIN } from './lib/align';
import type { Image } from './lib/image';
import { imageSize, readPng } from './lib/image';
import { alphaBounds, crop, lowestOpaqueRow } from './lib/trim';
import { decodeWebp, webpSize } from './lib/webp';
import { CEL_FRAMES, CEL_SIZE, FX_CEL_SHEETS } from '../../src/content/fxCels';

/** The largest texture every device in the matrix takes. */
const MAX_ATLAS = 2048;

/** What an image entry's file must measure, by key prefix; any other image key just has to fit a texture. */
export const IMAGE_SIZES: Readonly<Record<string, { width: number; height: number }>> = {
  'portrait.': { width: 512, height: 512 },
};

/**
 * Lossy sheets and the pin file their build script writes. A WebP sheet
 * without one fails: its cels cannot be compared with a lossless reference.
 */
export const WEBP_SHEET_PINS: Readonly<Record<string, string>> = {
  'unit.fire.kaya': 'art/source/kaya-g/pins.json',
};

/** How far a standing cel's lowest opaque row may sit from the anchor's foot line. */
export const STAND_TOLERANCE = 6;
/**
 * The envelope for walk and settle cels: a lifted stride, never a floating or
 * sunk figure. The grounded walks measure 10 px above to 10 px below the line
 * (a screen-vertical stride lifts the trailing foot), so 12 above now catches
 * the earlier floating east and west walks, whose feet sat 12-16 px above it.
 *
 * The lift is measured from where she stands in that heading: the anchor's
 * foot line, or her idle cel 0's feet when those stand higher (north's idle
 * stands 6 px above the line, inside `STAND_TOLERANCE`). A walk placed level
 * with that idle lifts its feet relative to that idle, not to the line; the
 * sunk bound stays on the line.
 */
export const STRIDE_ABOVE = 12;
export const STRIDE_BELOW = 10;
/**
 * How far the feet's centre may sit from the anchor column, standing and
 * mid-stride. A full 13 px/cel stride on a down-screen diagonal carries the
 * lowest (leading) foot up to 29 px from the column while the body stays on it.
 */
export const STAND_CENTRE = 16;
export const STRIDE_CENTRE = 32;
/**
 * A rest cel is the one pose between the last stride and idle, so its feet
 * stand under the figure: a stop on a lone leading foot 16 px off the column
 * reads as a slide.
 */
export const REST_CENTRE = 12;
/**
 * How far a walk or rest clip's mean lowest opaque row may sit from idle
 * cel 0's in the same heading. Per cel the lowest row swings with the stride;
 * over the cycle it stays where she stands, or the figure bobs up or down at
 * every start and stop.
 */
export const FOOT_ROW_TOLERANCE = 4;

/** SHA-256 of a decoded cel's RGBA, as the pin files record it. */
export function celHash(
  image: Image,
  frame: { x: number; y: number; w: number; h: number },
): string {
  const cel = crop(image, { x: frame.x, y: frame.y, width: frame.w, height: frame.h });
  return createHash('sha256').update(cel.data).digest('hex');
}

/** The x centre of the opaque pixels in the lowest `rows` rows of a cel. */
function footCentre(cel: Image, rows = 6): number | null {
  const bottom = lowestOpaqueRow(cel);
  let sum = 0;
  let count = 0;
  for (let y = Math.max(0, bottom - rows + 1); y <= bottom; y++) {
    for (let x = 0; x < cel.width; x++) {
      if ((cel.data[(y * cel.width + x) * 4 + 3] ?? 0) < 8) continue;
      sum += x;
      count++;
    }
  }
  return count === 0 ? null : sum / count;
}

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

export async function validateSheets(
  publicDir = 'public',
  entries: Readonly<Record<string, AssetEntry>> = ASSETS,
  pins: Readonly<Record<string, string>> = WEBP_SHEET_PINS,
): Promise<string[]> {
  const problems: string[] = [];
  for (const [key, entry] of Object.entries(entries)) {
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
    const imagePath = join(dirname(jsonPath), atlas.image);
    if (!existsSync(imagePath)) {
      problems.push(`${key}: ${atlas.image} is missing beside ${entry.atlas}`);
      continue;
    }
    const lossy = atlas.image.endsWith('.webp');
    let image: Image | undefined;
    if (atlas.image.endsWith('.png')) image = readPng(imagePath);
    else if (lossy) {
      const bytes = new Uint8Array(readFileSync(imagePath));
      if (webpSize(bytes)) image = await decodeWebp(bytes).catch(() => undefined);
    }
    if (!image) {
      problems.push(`${key}: ${atlas.image} must be a readable PNG or WebP`);
      continue;
    }
    if (image.width !== atlas.width || image.height !== atlas.height) {
      problems.push(
        `${key}: ${atlas.image} is ${image.width}x${image.height}, the JSON says ${atlas.width}x${atlas.height}`,
      );
      continue;
    }
    let pinned: Readonly<Record<string, string>> | undefined;
    if (lossy) {
      const pinPath = pins[key];
      if (!pinPath || !existsSync(pinPath)) {
        problems.push(`${key}: lossy ${atlas.image} has no cel pin file`);
      } else {
        pinned = (JSON.parse(readFileSync(pinPath, 'utf8')) as { frames?: Record<string, string> })
          .frames;
        if (!pinned) problems.push(`${key}: ${pinPath} pins no cels`);
      }
    }
    const defaultW = entry.pixelsPerTile * entry.footprint.w;
    const defaultH = entry.pixelsPerTile * 1.5;
    const wantW = entry.frameSize?.w ?? defaultW;
    const wantH = entry.frameSize?.h ?? defaultH;
    if (
      !Number.isInteger(wantW) ||
      !Number.isInteger(wantH) ||
      wantW < defaultW ||
      wantW > defaultW * 2 ||
      wantH < defaultH ||
      wantH > entry.pixelsPerTile * 2
    )
      problems.push(`${key}: declared frame exceeds the bounded art envelope`);
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
        if (pinned && pinned[name] !== celHash(image, frame)) {
          problems.push(`${key}: decoded cel "${name}" does not match its pin`);
        }
      }
    }
    if (pinned) {
      const used = new Set(CLIP_NAMES.flatMap((clip) => entry.clips[clip]?.frames ?? []));
      for (const name of Object.keys(pinned)) {
        if (!used.has(name)) problems.push(`${key}: pinned cel "${name}" is not in a clip`);
      }
    }
    if (entry.locomotion) {
      const line = Math.round(entry.anchor.y * wantH);
      const column = entry.anchor.x * wantW;
      for (const heading of HEADINGS) {
        const idleName = entry.clips[headingClip('idle', heading)]?.frames[0];
        const idleFrame = idleName ? atlas.frames.get(idleName) : undefined;
        const idleCel = idleFrame
          ? crop(image, { x: idleFrame.x, y: idleFrame.y, width: idleFrame.w, height: idleFrame.h })
          : undefined;
        // Never more than the standing tolerance above the line, so an idle
        // that itself floats cannot lift its walk's envelope with it.
        const stands = Math.max(
          line - STAND_TOLERANCE,
          Math.min(line, idleCel && alphaBounds(idleCel) ? lowestOpaqueRow(idleCel) : line),
        );
        for (const base of ['idle', 'walk', 'rest'] as const) {
          const clip = headingClip(base, heading);
          const rows: number[] = [];
          for (const name of entry.clips[clip]?.frames ?? []) {
            const frame = atlas.frames.get(name);
            if (!frame) continue;
            const cel = crop(image, { x: frame.x, y: frame.y, width: frame.w, height: frame.h });
            if (!alphaBounds(cel)) {
              problems.push(`${key}: cel "${name}" is empty`);
              continue;
            }
            const foot = lowestOpaqueRow(cel);
            rows.push(foot);
            const centre = footCentre(cel) ?? -1;
            const standing = base === 'idle';
            const grounded = standing
              ? Math.abs(foot - line) <= STAND_TOLERANCE
              : foot >= stands - STRIDE_ABOVE && foot <= line + STRIDE_BELOW;
            if (!grounded) {
              problems.push(
                `${key}: cel "${name}" puts its feet at row ${foot}, off the foot line ${line}`,
              );
            }
            const centred = standing ? STAND_CENTRE : base === 'rest' ? REST_CENTRE : STRIDE_CENTRE;
            if (Math.abs(centre - column) > centred) {
              problems.push(
                `${key}: cel "${name}" centres its feet at x ${centre.toFixed(1)}, off the anchor ${column}`,
              );
            }
          }
          const idleRow = idleCel && alphaBounds(idleCel) ? lowestOpaqueRow(idleCel) : undefined;
          if (base !== 'idle' && idleRow !== undefined && rows.length > 0) {
            const mean = rows.reduce((sum, row) => sum + row, 0) / rows.length;
            if (Math.abs(mean - idleRow) > FOOT_ROW_TOLERANCE) {
              problems.push(
                `${key}: clip "${clip}" has its mean foot row at ${mean.toFixed(2)}, ` +
                  `${(mean - idleRow).toFixed(2)} px from idle's ${idleRow}`,
              );
            }
          }
        }
      }
    }
    for (const [direction, frames] of Object.entries(entry.meleeDirections ?? {})) {
      if (!frames) continue;
      for (const name of frames) {
        const frame = atlas.frames.get(name);
        if (!frame) {
          problems.push(`${key}: ${direction} frame "${name}" is not in ${entry.atlas}`);
          continue;
        }
        if (frame.w !== wantW || frame.h !== wantH) {
          problems.push(
            `${key}: ${direction} frame "${name}" is ${frame.w}x${frame.h}, expected ${wantW}x${wantH}`,
          );
        }
        if (borderTouched(image, frame, MARGIN)) {
          problems.push(
            `${key}: ${direction} frame "${name}" has art inside the ${MARGIN} px margin`,
          );
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
    ...(await validateSheets()),
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
