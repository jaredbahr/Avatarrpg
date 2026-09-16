/**
 * What arrived: every picture in the intake folder, its size from its
 * header, what the game thinks it is from its name and shape, and the
 * command that takes it in.
 *
 *   npm run art:inventory [-- --in art/raw/incoming]
 *
 * Read-only, and it never decodes a file, so a folder of paintings is
 * listed in a moment. The summary at the end says which of the portraits,
 * which clips of each sheet and which maps are present, and what it could
 * not place, which is the list of questions for the owner before anything
 * is processed.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ALL_MAPS } from '../../src/content';
import { CLIP_FRAME_COUNTS, CLIP_NAMES } from '../../src/content/assets/clips';
import type { ClipName } from '../../src/content/assets/clips';
import { ASSETS } from '../../src/content/assets/manifest';
import { imageSize } from './lib/image';
import type { Catalogue, Inventory } from './lib/inventory';
import { guessAsset } from './lib/inventory';

/** The keys the game knows, in the words a file might be named by. */
export function catalogue(): Catalogue {
  const keys = Object.keys(ASSETS);
  return {
    portraits: keys
      .filter((k) => k.startsWith('portrait.'))
      .map((k) => k.slice('portrait.'.length)),
    units: keys
      .filter((k) => k.startsWith('unit.') && !k.startsWith('unit.test.'))
      .map((k) => ({ key: k, name: k.slice(k.lastIndexOf('.') + 1) })),
    maps: ALL_MAPS.map((m) => ({
      id: m.id,
      words: [...new Set([...m.id.split('_'), ...m.name.toLowerCase().split(/[^a-z0-9]+/)])].filter(
        Boolean,
      ),
    })),
  };
}

function walk(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (/\.(png|jpe?g|webp)$/i.test(entry)) out.push(full);
  }
  return out;
}

export interface Row {
  readonly file: string;
  readonly size: string;
  readonly inventory: Inventory;
}

export function inventory(dir: string): Row[] {
  const known = catalogue();
  return walk(dir).map((path) => {
    const bytes = new Uint8Array(readFileSync(path));
    const header = imageSize(bytes);
    const file = relative(dir, path);
    return {
      file,
      size: header ? `${header.width}x${header.height} ${header.format}` : 'unreadable',
      inventory: guessAsset(file, header, known, header?.format ?? null),
    };
  });
}

function describe(row: Row): string {
  const g = row.inventory.guess;
  switch (g.kind) {
    case 'portrait':
      return g.key;
    case 'frame':
      return `${g.unit} ${g.clip}/${g.index}`;
    case 'reference':
      return `reference for ${g.unit}`;
    case 'map':
      return `map ${g.id}`;
    default:
      return '?';
  }
}

export function main(argv: readonly string[]): number {
  let dir = 'art/raw/incoming';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--in' && argv[i + 1]) dir = argv[i + 1] ?? dir;
  }
  const root = resolve(dir);
  if (!existsSync(root)) {
    console.log(`Nothing under ${root}: fetch the intake there first.`);
    return 0;
  }
  const rows = inventory(root);
  if (rows.length === 0) {
    console.log(`No pictures under ${root}.`);
    return 0;
  }

  const width = Math.max(...rows.map((r) => r.file.length));
  for (const row of rows) {
    const { confidence, verdict, next } = row.inventory;
    console.log(
      `${row.file.padEnd(width)}  ${row.size.padEnd(20)}  ${describe(row).padEnd(34)}  ${confidence.padEnd(5)}  ${verdict}`,
    );
    console.log(`${''.padEnd(width)}  -> ${next}`);
  }

  const known = catalogue();
  const portraits = new Set(
    rows.map((r) => r.inventory.guess).flatMap((g) => (g.kind === 'portrait' ? [g.name] : [])),
  );
  const missing = known.portraits.filter((p) => !portraits.has(p));
  console.log(
    `\nPortraits: ${portraits.size} of ${known.portraits.length}${missing.length ? `; missing ${missing.join(', ')}` : ''}`,
  );

  const frames = new Map<string, Map<ClipName, Set<number>>>();
  for (const row of rows) {
    const g = row.inventory.guess;
    if (g.kind !== 'frame') continue;
    const clips = frames.get(g.unit) ?? new Map<ClipName, Set<number>>();
    const indices = clips.get(g.clip) ?? new Set<number>();
    indices.add(g.index);
    clips.set(g.clip, indices);
    frames.set(g.unit, clips);
  }
  for (const [unit, clips] of frames) {
    const parts = CLIP_NAMES.map((clip) => {
      const have = clips.get(clip)?.size ?? 0;
      const want = CLIP_FRAME_COUNTS[clip];
      return `${clip} ${have}/${want.min}${want.max !== want.min ? `-${want.max}` : ''}`;
    });
    console.log(`Sheet ${unit}: ${parts.join(', ')}`);
  }

  const maps = rows.map((r) => r.inventory.guess).flatMap((g) => (g.kind === 'map' ? [g.id] : []));
  if (maps.length) console.log(`Maps: ${[...new Set(maps)].join(', ')}`);

  const unknown = rows.filter((r) => r.inventory.guess.kind === 'unknown');
  if (unknown.length) console.log(`Ask about: ${unknown.map((r) => r.file).join(', ')}`);
  return 0;
}

if (process.argv[1]?.endsWith('inventory.ts')) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
