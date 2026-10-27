/**
 * Packs the party's sheets on the world's native G1 grid (ADR 0089): Kaya,
 * Sura and Bo at one art pixel a world pixel, 64 px a tile, a 64x96 cel.
 *
 * Usage:
 *   node --import tsx scripts/art/party-g1.ts [--character <kaya|sura|bo>]
 *
 * The source is `art/source/party-g1/cels/<name>/`, written by that folder's
 * `tools/assemble.py` from the curated roots and the PixelLab takes (its
 * README is the recipe). Every cel is already placed there; this script only
 * lays the cels out on pages, encodes them losslessly, and writes the same
 * files the G sheets always had, so every clip name, timing, key frame and
 * attack is unchanged:
 *
 * - `<name>-g`      idle, walk and rest in eight headings, the mirrored cast
 *                   and KO, and (Kaya and Sura) the riverside wave and tea;
 * - `<name>-g-2`    the fighting stance in eight headings;
 * - `<name>-g-3`    the knockouts on the four diagonals;
 * - `<name>-g-4`    the hits in eight headings;
 * - `<name>-g-bend` the bend, and `<name>-bend.json` its set (ADR 0055);
 * - `<name>-g-clips.json` the knockouts' and hits' clip data.
 *
 * A held cel is packed once: a hit's last frame and a bend's held and closing
 * frames name a cel already on the page. Then it decodes every page and
 * records the SHA-256 of each cel's RGBA in `art/source/party-g1/pins/`, which
 * `art:validate` holds the shipped WebP to.
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

export const SOURCE = 'art/source/party-g1';
export const PARTY = ['kaya', 'sura', 'bo'] as const;
export type PartyName = (typeof PARTY)[number];
const OUT = 'public/art/units';
const PAGE_W = 2048;
const GUTTER = 2;

interface PackClip {
  readonly cels: readonly string[];
  /** A trimmed take's cel per frame (a hit ends on its first cel). */
  readonly frameNames?: readonly number[];
  /** A bend's cel indices, in the order of `cels`. */
  readonly cel_names?: readonly number[];
  readonly frameSize?: { readonly w: number; readonly h: number };
  readonly anchor?: { readonly x: number; readonly y: number };
  readonly fps?: number;
  readonly loop?: boolean;
  readonly frameMs?: readonly number[];
}

interface Pack {
  readonly key: string;
  readonly clips: Readonly<Record<string, PackClip>>;
  readonly bend: { readonly facings: Readonly<Record<string, { readonly frames: string[] }>> };
}

/** Which page each clip packs on; the riverside's wave and tea join page 1. */
export function pageOf(clip: string): '' | '-2' | '-3' | '-4' | '-bend' {
  if (clip.startsWith('stance')) return '-2';
  if (clip.startsWith('ko') && clip !== 'ko') return '-3';
  if (clip.startsWith('hit')) return '-4';
  if (clip.startsWith('bend')) return '-bend';
  return '';
}

/** The atlas frame name of each cel of a clip, in cel order. */
export function celNames(key: string, clip: string, def: PackClip): string[] {
  const ids = def.cel_names ?? def.cels.map((_, i) => i);
  return ids.map((i) => `${key}/${clip}/${i}`);
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function readPack(name: PartyName): Pack {
  return JSON.parse(readFileSync(join(SOURCE, 'cels', name, 'pack.json'), 'utf8')) as Pack;
}

export async function buildParty(name: PartyName): Promise<void> {
  const dir = join(SOURCE, 'cels', name);
  const pack = readPack(name);
  const pages = new Map<string, Item[]>();
  const sources: Record<string, string> = {};
  for (const [clip, def] of Object.entries(pack.clips)) {
    const names = celNames(pack.key, clip, def);
    const items = pages.get(pageOf(clip)) ?? [];
    def.cels.forEach((file, i) => {
      const path = join(dir, file);
      sources[file] = sha256(readFileSync(path));
      items.push({ name: names[i] ?? '', image: readPng(path) });
    });
    pages.set(pageOf(clip), items);
  }
  const frames: Record<string, string> = {};
  const bendFrames: Record<string, string> = {};
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
    for (const [frame, rect] of rects)
      (suffix === '-bend' ? bendFrames : frames)[frame] = celHash(decoded, rect);
  }
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
  writeFileSync(join(OUT, `${name}-bend.json`), JSON.stringify(pack.bend));
  mkdirSync(join(SOURCE, 'pins'), { recursive: true });
  writeFileSync(
    join(SOURCE, 'pins', `${name}.json`),
    `${JSON.stringify({ sources, frames }, null, 1)}\n`,
  );
  writeFileSync(
    join(SOURCE, 'pins', `${name}-bend.json`),
    `${JSON.stringify({ frames: bendFrames }, null, 1)}\n`,
  );
  console.log(
    `${name}: ${Object.keys(frames).length} cels, ${Object.keys(bendFrames).length} bend cels`,
  );
}

/** The trimmed cast and KO rectangles the manifest declares (`partyG1.ts`, generated here). */
export function trimsText(packs: Readonly<Record<PartyName, Pack>>): string {
  const rows = PARTY.map((name) => {
    const clip = (c: 'cast' | 'ko') => {
      const def = packs[name].clips[c];
      if (!def?.frameSize || !def.anchor) throw new Error(`${name}: ${c} has no trimmed rectangle`);
      return `{ frameSize: { w: ${def.frameSize.w}, h: ${def.frameSize.h} }, anchor: { x: ${def.anchor.x}, y: ${def.anchor.y} } }`;
    };
    return `  ${name}: {\n    cast: ${clip('cast')},\n    ko: ${clip('ko')},\n  },`;
  });
  return [
    '/**',
    ' * Generated by `scripts/art/party-g1.ts` (ADR 0089); do not edit by hand.',
    ' *',
    " * The party's mirrored cast and one-cel KO on the G1 grid are trimmed cels,",
    " * like the knockouts: the cast is the east bend's stance, wind-up and strike,",
    " * the KO the south-east knockout's last cel. These are their rectangles and",
    ' * foot anchors, which the manifest declares on the two clips.',
    ' */',
    'export const PARTY_G1_TRIMS = {',
    ...rows,
    '} as const;',
    '',
  ].join('\n');
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at >= 0 ? argv[at + 1] : undefined;
}

if (process.argv[1]?.endsWith('party-g1.ts')) {
  const only = argValue(process.argv, '--character');
  const names = only ? [only as PartyName] : [...PARTY];
  for (const name of names) await buildParty(name);
  const packs = Object.fromEntries(PARTY.map((name) => [name, readPack(name)])) as Record<
    PartyName,
    Pack
  >;
  writeFileSync('src/content/assets/partyG1.ts', trimsText(packs));
}
