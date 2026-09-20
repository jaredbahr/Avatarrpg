/**
 * Repack the reviewed Riko directional contact sources.
 *
 *   node --import tsx scripts/art/riko-directional-contact.ts
 *
 * The source PNGs and reviewed normalised cells are tracked under
 * docs/art/sources so this pass does not depend on task-local generated-image
 * storage. It validates both source levels, patches only the two free Riko
 * atlas cells with the exact reviewed 128x192 cells, checks the legacy pixels,
 * then repeats the measured lossless PNG and semantic JSON compaction pass
 * used for the units budget.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { newImage, pixelAt, readPng, setPixel, writePng } from './lib/image';
import { alphaBounds } from './lib/trim';

const UNITS = 'public/art/units';
const RIKO_ATLAS = join(UNITS, 'walking-riko.png');
const RIKO_JSON = join(UNITS, 'walking-riko.json');
const FRAME_WIDTH = 128;
const FRAME_HEIGHT = 192;
const VISIBLE_HEIGHT = 119;
const ALPHA_THRESHOLD = 8;

const SOURCES = [
  {
    direction: 'screenUp',
    path: 'docs/art/sources/riko-directional-contact/riko-screen-up.png',
    cellPath: 'docs/art/sources/riko-directional-contact/riko-screen-up-cell.png',
    x: 512,
    frame: 'unit.non.riko/meleeNorth/0',
  },
  {
    direction: 'screenDown',
    path: 'docs/art/sources/riko-directional-contact/riko-screen-down.png',
    cellPath: 'docs/art/sources/riko-directional-contact/riko-screen-down-cell.png',
    x: 640,
    frame: 'unit.non.riko/meleeSouth/0',
  },
] as const;

function readReviewedCell(sourcePath: string, cellPath: string): ReturnType<typeof readPng> {
  const source = readPng(sourcePath);
  if (source.width !== 1024 || source.height !== 1536) {
    throw new Error(
      `${sourcePath}: expected 1024x1536 source, got ${source.width}x${source.height}`,
    );
  }
  if (!alphaBounds(source, ALPHA_THRESHOLD)) {
    throw new Error(`${sourcePath}: no visible pixels at alpha ${ALPHA_THRESHOLD}`);
  }

  const cell = readPng(cellPath);
  if (cell.width !== FRAME_WIDTH || cell.height !== FRAME_HEIGHT) {
    throw new Error(`${cellPath}: expected ${FRAME_WIDTH}x${FRAME_HEIGHT} cell`);
  }
  const bounds = alphaBounds(cell, ALPHA_THRESHOLD);
  if (!bounds || bounds.height !== VISIBLE_HEIGHT || bounds.y !== 44) {
    throw new Error(
      `${cellPath}: expected alpha>${ALPHA_THRESHOLD} bounds with height ${VISIBLE_HEIGHT} at y=44`,
    );
  }
  if (bounds.x < 8 || bounds.x + bounds.width > FRAME_WIDTH - 8) {
    throw new Error(`${cellPath}: contact cell violates the eight-pixel side margin`);
  }
  return cell;
}

function copyCell(
  target: ReturnType<typeof newImage>,
  cell: ReturnType<typeof readPng>,
  x: number,
): void {
  for (let y = 0; y < FRAME_HEIGHT; y++) {
    for (let dx = 0; dx < FRAME_WIDTH; dx++) {
      const rgba = pixelAt(cell, dx, y);
      setPixel(target, x + dx, 384 + y, rgba);
    }
  }
}

function patchRikoAtlas(): void {
  const before = readPng(RIKO_ATLAS);
  if (before.width !== 1024 || before.height !== 576)
    throw new Error(`Riko atlas must be 1024x576, got ${before.width}x${before.height}`);
  const after = newImage(before.width, before.height);
  after.data.set(before.data);
  for (const source of SOURCES) {
    copyCell(after, readReviewedCell(source.path, source.cellPath), source.x);
  }

  for (let y = 0; y < before.height; y++) {
    for (let x = 0; x < before.width; x++) {
      const inContactCell = x >= 512 && x < 768 && y >= 384 && y < 576;
      if (inContactCell) continue;
      const a = (y * before.width + x) * 4;
      for (let channel = 0; channel < 4; channel++) {
        if (before.data[a + channel] !== after.data[a + channel])
          throw new Error(`legacy atlas pixel changed at ${x},${y},channel ${channel}`);
      }
    }
  }
  writePng(RIKO_ATLAS, after);

  const atlas = JSON.parse(readFileSync(RIKO_JSON, 'utf8')) as {
    frames: Record<string, unknown>;
    meta: unknown;
  };
  const frame = (x: number, y = 384) => ({
    frame: { x, y, w: FRAME_WIDTH, h: FRAME_HEIGHT },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: FRAME_WIDTH, h: FRAME_HEIGHT },
    sourceSize: { w: FRAME_WIDTH, h: FRAME_HEIGHT },
  });
  for (const source of SOURCES) atlas.frames[source.frame] = frame(source.x);
  // The legacy side-facing melee uses the existing cast pixels. Keep aliases
  // in the atlas so the manifest can satisfy the normal clip naming contract
  // without allocating or changing another cell.
  atlas.frames['unit.non.riko/melee/0'] = frame(256, 0);
  atlas.frames['unit.non.riko/melee/1'] = frame(384, 0);
  writeFileSync(RIKO_JSON, JSON.stringify(atlas));
}

function repackLossless(): void {
  const choices: Record<
    string,
    { deflateLevel: number; deflateStrategy: number; filterType: number }
  > = {
    'bruiser.png': { deflateLevel: 9, deflateStrategy: 0, filterType: -1 },
    'crossbow.png': { deflateLevel: 9, deflateStrategy: 0, filterType: -1 },
    'grumbler.png': { deflateLevel: 9, deflateStrategy: 1, filterType: -1 },
    'thug.png': { deflateLevel: 9, deflateStrategy: 0, filterType: -1 },
  };
  for (const [name, options] of Object.entries(choices)) {
    const path = join(UNITS, name);
    const before = PNG.sync.read(readFileSync(path));
    const bytes = PNG.sync.write(before, options);
    const after = PNG.sync.read(bytes);
    if (!before.data.equals(after.data))
      throw new Error(`${name}: lossless re-encode changed pixels`);
    writeFileSync(path, bytes);
  }
}

function compactJson(): void {
  for (const name of readdirSync(UNITS).filter((entry) => entry.endsWith('.json'))) {
    const path = join(UNITS, name);
    writeFileSync(path, JSON.stringify(JSON.parse(readFileSync(path, 'utf8'))));
  }
}

patchRikoAtlas();
repackLossless();
compactJson();
console.log(
  `Riko directional contact packed; units bytes: ${[...readdirSync(UNITS)].reduce((sum, name) => sum + statSync(join(UNITS, name)).size, 0)}`,
);
