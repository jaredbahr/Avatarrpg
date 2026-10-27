/**
 * Reproducibly builds the Ba Dan residents' G sheets (issue #284): the
 * PixelLab residents of `art/source/<name>-g` (household adult, relief watch,
 * Mira, Gao, Pella, Dorin), each an eight-heading idle (4 cels) and walk
 * (8 cels) plus a rest cel, packed as the party's G locomotion is.
 *
 * Usage:
 *   node --import tsx scripts/art/resident-g.ts [--resident <name>] [--pin]
 *
 * The source of each heading is the take its `assembly.json` names under
 * `raw/` (192 px cels drawn by `animate-with-skeleton-v3` from the resident's
 * own rotation, motion retargeted from CMU capture; see
 * `art/source/residents-g-design/README.md`). The cels are untoned, as
 * Kaya's are: the residents were edited from her untoned G south.
 *
 * Every cel goes through the G build's own map (`normalise`, 75%
 * nearest-neighbour into the 128x192 cel). The placement is not hand set:
 * `placeHeading` solves it per heading against the bounds `art:validate`
 * holds every eight-way sheet to (ADR 0050, 0051, 0052), in the order the
 * enemy packer records (`enemy-g.ts`):
 *
 * - `headingDx` moves idle and walk sideways together, the fewest pixels that
 *   bring idle cel 0's feet within 16 px of the anchor column;
 * - `idleDy` the fewest pixels that stand every idle cel within 6 px of the
 *   foot line;
 * - `walkDx` aligns the walk's head and torso with idle cel 0's where their
 *   mean best-overlap offset exceeds 2 px, then moves the fewest further
 *   pixels that keep every cel's feet within 32 px of the column;
 * - `walkDy` the fewest pixels that keep every walk cel inside the stride
 *   envelope (12 px above where it stands, 10 below the line) and the walk's
 *   mean lowest row within 3.5 px of idle cel 0's;
 * - `restCel` is the walk cel that stands like idle (lowest row within 3 px of
 *   idle cel 0's, feet within 12 px of the column) and best overlaps idle
 *   cel 0.
 *
 * `--pin` writes `art/source/<name>-g/pins.json` with the SHA-256 of every
 * source cel the build reads; it never rewrites one. The build then records
 * the SHA-256 of every decoded atlas cel there, which `art:validate` holds
 * the shipped WebP to.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ClipName, Heading } from '../../src/content/assets/clips';
import { headingClip } from '../../src/content/assets/clips';
import { atlasJsonText } from '../../src/render/sheets/atlasJson';
import { layoutSheet } from '../../src/render/sheets/layout';
import { FRAME_H, FRAME_W, WEBP_QUALITY, checkSources, normalise, sha256 } from './g-sprites';
import type { Image } from './lib/image';
import { newImage, pixelAt, readPng, setPixel } from './lib/image';
import { alphaBounds, lowestOpaqueRow } from './lib/trim';
import { decodeWebp, encodeWebp } from './lib/webp';
import {
  REST_CENTRE,
  STAND_CENTRE,
  STRIDE_CENTRE,
  STAND_TOLERANCE,
  STRIDE_ABOVE,
  STRIDE_BELOW,
  celHash,
  footCentre,
} from './validate';

export const IDLE_CELS = 4;
export const WALK_CELS = 8;
/** The anchor (0.5, 0.85) of a 128x192 cel. */
export const FOOT_LINE = Math.round(0.85 * FRAME_H);
export const COLUMN = 0.5 * FRAME_W;
/** The packer keeps the walk's mean lowest row this close to idle's (validate allows 4). */
const MEAN_TOLERANCE = 3.5;

export type ResidentName = 'household' | 'watch' | 'mira' | 'gao' | 'pella' | 'dorin';
export const RESIDENT_NAMES: readonly ResidentName[] = [
  'household',
  'watch',
  'mira',
  'gao',
  'pella',
  'dorin',
];
/** The asset key each sheet's frames are named under: the residents' existing sprite keys. */
export const RESIDENT_KEYS: Readonly<Record<ResidentName, string>> = {
  household: 'npc.household',
  watch: 'npc.guard',
  mira: 'npc.elder',
  gao: 'npc.shopkeeper',
  pella: 'npc.kid',
  dorin: 'npc.dorin',
};

/** The source folders' direction names, in the order of the atlas headings. */
export const DIRECTIONS: readonly (readonly [string, Heading])[] = [
  ['east', 'east'],
  ['north-east', 'northEast'],
  ['north', 'north'],
  ['north-west', 'northWest'],
  ['west', 'west'],
  ['south-west', 'southWest'],
  ['south', 'south'],
  ['south-east', 'southEast'],
];

export const residentSource = (name: ResidentName): string => `art/source/${name}-g`;
export const residentPins = (name: ResidentName): string => `${residentSource(name)}/pins.json`;

export interface ResidentPins {
  /** SHA-256 of each source cel, relative to the resident's source folder. */
  readonly cels: Readonly<Record<string, string>>;
  /** SHA-256 of each decoded atlas cel's RGBA, written by the build. */
  readonly frames: Readonly<Record<string, string>>;
}

/** Which raw take each heading uses (`assembly.json`). */
type Assembly = Readonly<Record<string, { readonly idle: string; readonly walk: string }>>;

export function readAssembly(name: ResidentName, root = '.'): Assembly {
  return JSON.parse(
    readFileSync(join(root, residentSource(name), 'assembly.json'), 'utf8'),
  ) as Assembly;
}

/** Every source cel the build reads, relative to the resident's source folder. */
export function residentSourceFiles(assembly: Assembly): string[] {
  const files: string[] = [];
  for (const [direction] of DIRECTIONS) {
    const take = assembly[direction];
    if (!take) throw new Error(`assembly.json names no takes for ${direction}.`);
    for (let i = 0; i < IDLE_CELS; i++) files.push(`raw/${take.idle}/${pad(i)}.png`);
    for (let i = 0; i < WALK_CELS; i++) files.push(`raw/${take.walk}/${pad(i)}.png`);
  }
  return files;
}

const pad = (i: number) => String(i).padStart(2, '0');

/** The clip frame counts of a resident sheet: idle, walk and rest in every heading. */
export function residentCounts(): Partial<Record<ClipName, number>> {
  const counts: Partial<Record<ClipName, number>> = {};
  for (const [, heading] of DIRECTIONS) {
    counts[headingClip('idle', heading)] = IDLE_CELS;
    counts[headingClip('walk', heading)] = WALK_CELS;
    counts[headingClip('rest', heading)] = 1;
  }
  return counts;
}

export interface Placement {
  readonly headingDx: number;
  readonly idleDy: number;
  readonly walkDx: number;
  readonly walkDy: number;
  readonly restCel: number;
}

const alphaOf = (cel: Image, x: number, y: number) =>
  x < 0 || y < 0 || x >= cel.width || y >= cel.height
    ? 0
    : (cel.data[(y * cel.width + x) * 4 + 3] ?? 0);

/** Opaque-pixel overlap of `b` shifted by (dx, dy) against `a`, over rows [y0, y1). */
function overlap(a: Image, b: Image, dx: number, dy: number, y0 = 0, y1 = a.height): number {
  let both = 0;
  let either = 0;
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < a.width; x++) {
      const p = alphaOf(a, x, y) >= 8;
      const q = alphaOf(b, x - dx, y - dy) >= 8;
      if (p && q) both++;
      if (p || q) either++;
    }
  return either === 0 ? 0 : both / either;
}

/** The fewest-pixel shift in [-24, 24] that satisfies `ok`, nearest `from` first. */
function nearest(from: number, ok: (d: number) => boolean): number | undefined {
  for (let step = 0; step <= 24; step++)
    for (const d of step === 0 ? [from] : [from - step, from + step]) if (ok(d)) return d;
  return undefined;
}

/**
 * Solves one heading's placement from its 192 px source cels, against the
 * bounds `art:validate` holds an eight-way sheet to. Throws when no shift can
 * satisfy them: such a take needs a retake, not a placement.
 */
export function placeHeading(idleSrc: readonly Image[], walkSrc: readonly Image[]): Placement {
  const idle0 = normalise(idleSrc[0] as Image, 0, 0);
  const centre0 = footCentre(idle0) ?? COLUMN;
  const base =
    Math.abs(centre0 - COLUMN) <= STAND_CENTRE
      ? 0
      : Math.round(COLUMN - centre0 + Math.sign(centre0 - COLUMN) * STAND_CENTRE);
  // A prop on the ground (a spear butt) pulls the feet's centre off the
  // column; when no walk cel then stands close enough to rest on, the whole
  // heading moves the fewest further pixels toward the column that gives one.
  const toward = Math.sign(COLUMN - centre0) || 1;
  let last: Error | undefined;
  for (let extra = 0; extra <= 8; extra++) {
    try {
      return placeAt(idleSrc, walkSrc, base + toward * extra);
    } catch (error) {
      last = error as Error;
      if (!last.message.startsWith('no walk cel')) throw last;
    }
  }
  throw last ?? new Error('no placement');
}

function placeAt(
  idleSrc: readonly Image[],
  walkSrc: readonly Image[],
  headingDx: number,
): Placement {
  const at = (src: Image, dx: number, dy: number) => normalise(src, dx, dy);

  const idleRows = idleSrc.map((cel) => lowestOpaqueRow(at(cel, headingDx, 0)));
  const idleDy = nearest(0, (d) =>
    idleRows.every((row) => Math.abs(row + d - FOOT_LINE) <= STAND_TOLERANCE),
  );
  if (idleDy === undefined) throw new Error(`idle feet ${idleRows.join(',')} cannot meet the line`);
  const idle = at(idleSrc[0] as Image, headingDx, idleDy);
  const idleRow = lowestOpaqueRow(idle);

  // Head and torso: the upper 60% of the idle silhouette.
  const raw = walkSrc.map((cel) => at(cel, headingDx, idleDy));
  const bodyTop = alphaBounds(idle)?.y ?? 0;
  const torsoEnd = Math.round(bodyTop + (idleRow - bodyTop) * 0.6);
  const bestDx = raw.map((cel) => {
    let best = 0;
    let score = -1;
    for (let dx = -10; dx <= 10; dx++) {
      const s = overlap(idle, cel, dx, 0, bodyTop, torsoEnd);
      if (s > score + 1e-9 || (Math.abs(s - score) <= 1e-9 && Math.abs(dx) < Math.abs(best))) {
        score = s;
        best = dx;
      }
    }
    return best;
  });
  const meanDx = bestDx.reduce((a, b) => a + b, 0) / bestDx.length;
  const alignDx = Math.abs(meanDx) > 2 ? Math.round(meanDx) : 0;
  // Then the fewest further pixels that keep every stride's feet within the column bound.
  const centres = raw.map((cel) => footCentre(cel) ?? COLUMN);
  const walkDx = nearest(alignDx, (d) =>
    centres.every((c) => Math.abs(c + d - COLUMN) <= STRIDE_CENTRE),
  );
  if (walkDx === undefined) throw new Error(`walk feet ${centres.join(',')} straddle the column`);

  const walkRows = walkSrc.map((cel) => lowestOpaqueRow(at(cel, headingDx + walkDx, idleDy)));
  const stands = Math.max(FOOT_LINE - STAND_TOLERANCE, Math.min(FOOT_LINE, idleRow));
  const mean = walkRows.reduce((a, b) => a + b, 0) / walkRows.length;
  const walkDy = nearest(0, (d) => {
    const inside = walkRows.every(
      (row) => row + d >= stands - STRIDE_ABOVE && row + d <= FOOT_LINE + STRIDE_BELOW,
    );
    return inside && Math.abs(mean + d - idleRow) <= MEAN_TOLERANCE;
  });
  if (walkDy === undefined)
    throw new Error(`walk feet ${walkRows.join(',')} cannot fit the stride envelope`);

  const walk = walkSrc.map((cel) => at(cel, headingDx + walkDx, idleDy + walkDy));
  let restCel = -1;
  let restScore = -1;
  walk.forEach((cel, i) => {
    const row = lowestOpaqueRow(cel);
    const centre = footCentre(cel) ?? -999;
    if (Math.abs(row - idleRow) > 3 || Math.abs(centre - COLUMN) > REST_CENTRE) return;
    const s = overlap(idle, cel, 0, 0);
    if (s > restScore) {
      restScore = s;
      restCel = i;
    }
  });
  if (restCel < 0) throw new Error('no walk cel stands like idle for the rest');
  return { headingDx, idleDy, walkDx, walkDy, restCel };
}

/** Writes a fresh source pin file. Refuses to overwrite one. */
export function pinResident(name: ResidentName, root = '.'): void {
  const path = join(root, residentPins(name));
  if (existsSync(path)) throw new Error(`${path} exists; a pin file is never rewritten by --pin.`);
  const cels: Record<string, string> = {};
  for (const file of residentSourceFiles(readAssembly(name, root)))
    cels[file] = sha256(readFileSync(join(root, residentSource(name), file)));
  writeFileSync(path, `${JSON.stringify({ cels, frames: {} }, null, 2)}\n`);
}

export interface ResidentBuild {
  readonly bytes: number;
  readonly placements: Readonly<Record<string, Placement>>;
  readonly frames: Readonly<Record<string, string>>;
}

export async function buildResident(
  name: ResidentName,
  options: {
    readonly root?: string;
    readonly outDir?: string;
    /** Where the pins are read and the decoded-cel pins written; the resident's own by default. */
    readonly pinsPath?: string;
    readonly log?: (s: string) => void;
  } = {},
): Promise<ResidentBuild> {
  const root = options.root ?? '.';
  const outDir = options.outDir ?? join(root, 'public/art/units');
  const log = options.log ?? console.log;
  const source = join(root, residentSource(name));
  const pinsPath = options.pinsPath ?? join(root, residentPins(name));
  if (!existsSync(pinsPath)) throw new Error(`${pinsPath} is missing; pin the sources with --pin.`);
  const pins = JSON.parse(readFileSync(pinsPath, 'utf8')) as ResidentPins;
  const assembly = readAssembly(name, root);
  const problems = checkSources(source, residentSourceFiles(assembly), pins.cels, 'source');
  if (problems.length > 0)
    throw new Error(`${name} G sources do not match ${pinsPath}:\n${problems.join('\n')}`);

  const key = RESIDENT_KEYS[name];
  const cels = new Map<string, Image>();
  const placements: Record<string, Placement> = {};
  for (const [direction, heading] of DIRECTIONS) {
    const take = assembly[direction] as { idle: string; walk: string };
    const read = (job: string, i: number) => readPng(join(source, 'raw', job, `${pad(i)}.png`));
    const idleSrc = Array.from({ length: IDLE_CELS }, (_, i) => read(take.idle, i));
    const walkSrc = Array.from({ length: WALK_CELS }, (_, i) => read(take.walk, i));
    let p: Placement;
    try {
      p = placeHeading(idleSrc, walkSrc);
    } catch (error) {
      throw new Error(`${name} ${direction}: ${(error as Error).message}`);
    }
    placements[direction] = p;
    idleSrc.forEach((cel, i) =>
      cels.set(
        `${key}/${headingClip('idle', heading)}/${i}`,
        normalise(cel, p.headingDx, p.idleDy),
      ),
    );
    const walk = walkSrc.map((cel) => normalise(cel, p.headingDx + p.walkDx, p.idleDy + p.walkDy));
    walk.forEach((cel, i) => cels.set(`${key}/${headingClip('walk', heading)}/${i}`, cel));
    cels.set(`${key}/${headingClip('rest', heading)}/0`, walk[p.restCel] as Image);
  }

  const image = `${name}-g.webp`;
  const layout = layoutSheet(key, residentCounts(), FRAME_W, FRAME_H);
  const atlas = newImage(layout.width, layout.height);
  for (const [frame, rect] of layout.frames) {
    const pixels = cels.get(frame);
    if (!pixels) throw new Error(`No pixels prepared for ${frame}.`);
    for (let y = 0; y < pixels.height; y++)
      for (let x = 0; x < pixels.width; x++)
        setPixel(atlas, rect.x + x, rect.y + y, pixelAt(pixels, x, y));
  }
  const webp = await encodeWebp(atlas, WEBP_QUALITY, true);
  const json = `${JSON.stringify(JSON.parse(atlasJsonText(layout.frames, image, layout.width, layout.height)))}\n`;
  const decoded = await decodeWebp(webp);
  const frames: Record<string, string> = {};
  for (const [frame, rect] of layout.frames) frames[frame] = celHash(decoded, rect);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, image), webp);
  writeFileSync(join(outDir, `${name}-g.json`), json);
  writeFileSync(pinsPath, `${JSON.stringify({ ...pins, frames }, null, 2)}\n`);
  log(`wrote ${image} (${layout.width}x${layout.height}, ${webp.length} B) and ${name}-g.json`);
  return { bytes: webp.length, placements, frames };
}

async function main(argv: readonly string[]): Promise<void> {
  const at = argv.indexOf('--resident');
  const only = at < 0 ? undefined : (argv[at + 1] as ResidentName | undefined);
  if (only && !RESIDENT_NAMES.includes(only)) throw new Error(`Unknown resident ${only}.`);
  for (const name of only ? [only] : RESIDENT_NAMES) {
    if (argv.includes('--pin')) {
      pinResident(name);
      console.log(`wrote ${residentPins(name)} source pins`);
    }
    const { placements } = await buildResident(name);
    for (const [direction, p] of Object.entries(placements))
      console.log(
        `  ${name} ${direction}: heading dx ${p.headingDx}, idle dy ${p.idleDy}, walk dx ${p.walkDx}, walk dy ${p.walkDy}, rest ${p.restCel}`,
      );
  }
}

if (process.argv[1]?.endsWith('resident-g.ts')) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
