/**
 * Packs the Ba Dan residents' and the forest bandits' sheets on the world's
 * native G1 grid (ADR 0091): one art pixel a world pixel, 64 px a tile, a
 * 64x96 cel (the bruiser's 80x96, for his club), the party's recipe (ADR 0089).
 *
 * Usage:
 *   node --import tsx scripts/art/residents-g1.ts [--name <name>]
 *
 * The source is `art/source/residents-g1/cels/<name>/`, written by that
 * folder's `tools/assemble.py` from the curated roots and the PixelLab takes
 * (its README is the recipe). Every cel is already placed there; this script
 * only lays the cels out on pages, encodes them losslessly, and writes the
 * same files the G sheets always had, so every clip name and timing is
 * unchanged:
 *
 * - `<name>-g`         idle, walk and rest in eight headings; for a bandit also
 *                      the mirrored legacy cast, hit and KO;
 * - `<name>-g-2`       (bandits) the knockouts on the four diagonals;
 * - `<name>-g-3`       (bandits) the hits in eight headings;
 * - `<name>-g-clips.json` (bandits) the knockouts' and hits' clip data.
 *
 * A held cel is packed once: a hit's last frame names its first cel. Then it
 * decodes every page and records the SHA-256 of each cel's RGBA in
 * `art/source/residents-g1/pins/`, which `art:validate` holds the shipped WebP
 * to, and writes the bandits' trimmed hit and KO rectangles to
 * `src/content/assets/banditsG1.ts`.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AtlasFrame } from '../../src/render/sheets/atlasJson';
import { atlasJsonText } from '../../src/render/sheets/atlasJson';
import { composeAtlas, shelfPack } from './lib/atlas';
import type { Item } from './lib/atlas';
import type { Image } from './lib/image';
import { readPng } from './lib/image';
import { decodeWebp, encodeWebpLossless } from './lib/webp';
import { celHash } from './validate';

export const SOURCE = 'art/source/residents-g1';
export const RESIDENTS = ['household', 'watch', 'mira', 'gao', 'pella', 'dorin'] as const;
export const BANDITS = ['thug', 'slinger', 'bruiser'] as const;
export const NAMES = [...RESIDENTS, ...BANDITS] as const;
export type G1Name = (typeof NAMES)[number];
export type BanditName = (typeof BANDITS)[number];
const OUT = 'public/art/units';
const PAGE_W = 2048;
const GUTTER = 2;

interface PackClip {
  readonly cels: readonly string[];
  /** A trimmed take's cel per frame (a hit ends on its first cel). */
  readonly frameNames?: readonly number[];
  readonly frameSize?: { readonly w: number; readonly h: number };
  readonly anchor?: { readonly x: number; readonly y: number };
  readonly fps?: number;
  readonly loop?: boolean;
  readonly frameMs?: readonly number[];
}

export interface Pack {
  readonly key: string;
  readonly kind: 'resident' | 'bandit';
  readonly grid: { readonly pixelsPerTile: number; readonly frame: readonly [number, number] };
  readonly clips: Readonly<Record<string, PackClip>>;
}

/** Which page each clip packs on: a bandit's knockouts on page 2, its hits on page 3, as before. */
export function pageOf(clip: string): '' | '-2' | '-3' {
  if (clip.startsWith('ko') && clip !== 'ko') return '-2';
  if (clip.startsWith('hit') && clip !== 'hit') return '-3';
  return '';
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function readPack(name: G1Name): Pack {
  return JSON.parse(readFileSync(join(SOURCE, 'cels', name, 'pack.json'), 'utf8')) as Pack;
}

export async function buildG1(name: G1Name): Promise<void> {
  const dir = join(SOURCE, 'cels', name);
  const pack = readPack(name);
  const pages = new Map<string, Item[]>();
  const sources: Record<string, string> = {};
  for (const [clip, def] of Object.entries(pack.clips)) {
    const items = pages.get(pageOf(clip)) ?? [];
    def.cels.forEach((file, i) => {
      const path = join(dir, file);
      sources[file] = sha256(readFileSync(path));
      items.push({ name: `${pack.key}/${clip}/${i}`, image: readPng(path) });
    });
    pages.set(pageOf(clip), items);
  }
  const frames: Record<string, string> = {};
  for (const [suffix, items] of [...pages.entries()].sort()) {
    const { placed, height } = shelfPack(items, PAGE_W, GUTTER, false);
    const width = Math.min(PAGE_W, Math.max(...placed.map((p) => p.x + p.width)) + GUTTER);
    if (height > PAGE_W) throw new Error(`${name}-g${suffix} needs ${height} px of a 2048 px page`);
    const atlas = composeAtlas(items, placed, width, height, GUTTER);
    const stem = `${name}-g${suffix}`;
    const bytes = await encodeWebpLossless(atlas);
    writeFileSync(join(OUT, `${stem}.webp`), bytes);
    const rects = new Map<string, AtlasFrame>(
      placed.map((p) => [p.name, { x: p.x, y: p.y, w: p.width, h: p.height }]),
    );
    writeFileSync(join(OUT, `${stem}.json`), atlasJsonText(rects, `${stem}.webp`, width, height));
    const decoded: Image = await decodeWebp(new Uint8Array(bytes));
    for (const [frame, rect] of rects) frames[frame] = celHash(decoded, rect);
  }
  if (pack.kind === 'bandit') {
    // The knockouts' and hits' clip data, in the order of the shipped file (frozen in `shipped/`).
    const shipped = JSON.parse(
      readFileSync(join(SOURCE, 'shipped', `${name}-g-clips.json`), 'utf8'),
    ) as Record<string, unknown>;
    const clipData: Record<string, unknown> = {};
    for (const clip of Object.keys(shipped)) {
      const def = pack.clips[clip];
      if (!def?.frameNames || !def.frameSize || !def.anchor)
        throw new Error(`${name}: no packed take for ${clip}`);
      clipData[clip] = {
        frames: def.frameNames.map((i) => `${pack.key}/${clip}/${i}`),
        fps: def.fps,
        loop: def.loop,
        frameMs: def.frameMs,
        frameSize: def.frameSize,
        anchor: def.anchor,
      };
    }
    writeFileSync(join(OUT, `${name}-g-clips.json`), JSON.stringify(clipData));
  }
  mkdirSync(join(SOURCE, 'pins'), { recursive: true });
  writeFileSync(
    join(SOURCE, 'pins', `${name}.json`),
    `${JSON.stringify({ sources, frames }, null, 1)}\n`,
  );
  console.log(`${name}: ${Object.keys(frames).length} cels`);
}

/** The bandits' trimmed hit and KO rectangles the manifest declares (`banditsG1.ts`, generated here). */
export function trimsText(packs: Readonly<Record<BanditName, Pack>>): string {
  const rows = BANDITS.map((name) => {
    const clip = (c: 'hit' | 'ko') => {
      const def = packs[name].clips[c];
      if (!def?.frameSize || !def.anchor) throw new Error(`${name}: ${c} has no trimmed rectangle`);
      return `{ frameSize: { w: ${def.frameSize.w}, h: ${def.frameSize.h} }, anchor: { x: ${def.anchor.x}, y: ${def.anchor.y} } }`;
    };
    return `  ${name}: {\n    hit: ${clip('hit')},\n    ko: ${clip('ko')},\n  },`;
  });
  return [
    '/**',
    ' * Generated by `scripts/art/residents-g1.ts` (ADR 0091); do not edit by hand.',
    ' *',
    " * The bandits' mirrored one-cel hit and KO on the G1 grid are trimmed cels,",
    " * like the knockouts: the hit is the east hit's deepest flinch, the KO the",
    " * south-east knockout's last cel. These are their rectangles and foot",
    ' * anchors, which the manifest declares on the two clips.',
    ' */',
    'export const BANDITS_G1_TRIMS = {',
    ...rows,
    '} as const;',
    '',
  ].join('\n');
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at >= 0 ? argv[at + 1] : undefined;
}

if (process.argv[1]?.endsWith('residents-g1.ts')) {
  const only = argValue(process.argv, '--name');
  const names = only ? [only as G1Name] : [...NAMES];
  for (const name of names) await buildG1(name);
  const packs = Object.fromEntries(BANDITS.map((name) => [name, readPack(name)])) as Record<
    BanditName,
    Pack
  >;
  writeFileSync('src/content/assets/banditsG1.ts', trimsText(packs));
}
