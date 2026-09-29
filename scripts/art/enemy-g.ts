/**
 * The shared packer for an enemy's G sheet (ADR 0059, ADR 0060): a toned
 * PixelLab unit's eight-heading idle and walk, packed as the party's G
 * locomotion is, beside the old sheet's cast, hit and KO cels. The thug
 * (`thug-g.ts`) and the quarry bandits (`bandits-g.ts`) are definitions of it.
 *
 * Each cel goes through the G build's own map (`normalise` in
 * `g-sprites.ts`): 75% nearest-neighbour into the 128x192 cel, in the same
 * root-locked coordinates, so the unit stands on the party's feet at the
 * party's size. The placement is measured by the party's rules (ADR 0050, as
 * amended by ADR 0051 and ADR 0052), on the walks' own `gates.json`:
 *
 * - `idleDy` levels a north idle onto the anchor's foot line; otherwise idle
 *   is the reference and never moves up or down.
 * - `walkDy` puts the walk's mean planted sole on the idle's baseline, then
 *   moves it the fewest pixels that bring its mean lowest row within 3.5 px
 *   of idle cel 0's, and every cel inside `art:validate`'s stride envelope;
 *   north walks stay level with their idle, as drawn.
 * - `walkDx` aligns the walk's head and torso with idle's where their mean
 *   best-overlap offset exceeds 2 px.
 * - `restCel` is the walk cel that stands like idle (lowest row within 3 px
 *   of idle cel 0's, feet within `art:validate`'s 12 px of the anchor
 *   column) and best overlaps idle cel 0.
 * - `headingDx` moves a whole heading sideways, idle and walk together, the
 *   fewest pixels that bring idle cel 0's feet within `art:validate`'s 16 px
 *   of the anchor column. Facing south-east, the lowest rows hold only the
 *   near foot, drawn left of a body that stands on the column (ADR 0060).
 *
 * A sheet may be wider than 128 px (`frameW`, the manifest's `frameSize`,
 * ADR 0032) when a weapon reaches past the margin; every cel, the legacy
 * actions included, is centred on it unchanged, so the feet keep the anchor.
 *
 * Any directory is not accepted: every cel must match its SHA-256 in the
 * checked-in pin file, and a missing, extra-pinned or changed cel stops the
 * build before anything is written. The build then records the SHA-256 of
 * every decoded atlas cel in the same file, which `art:validate` holds the
 * shipped WebP to.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ClipName, Heading } from '../../src/content/assets/clips';
import { headingClip } from '../../src/content/assets/clips';
import { atlasJsonText } from '../../src/render/sheets/atlasJson';
import { layoutSheet } from '../../src/render/sheets/layout';
import { FRAME_H, FRAME_W, WEBP_QUALITY, checkSources, normalise } from './g-sprites';
import type { Image } from './lib/image';
import { newImage, pixelAt, readPng, setPixel } from './lib/image';
import { decodeWebp, encodeWebp } from './lib/webp';
import { celHash } from './validate';

export const IDLE_CELS = 4;
export const WALK_CELS = 8;

export interface EnemyGHeading {
  readonly direction: string;
  readonly idle: ClipName;
  readonly walk: ClipName;
  readonly rest: ClipName;
  /** The walk folder, relative to the source. */
  readonly walkDir: string;
  readonly restCel: number;
  readonly walkDx: number;
  readonly walkDy: number;
  readonly idleDy: number;
  readonly headingDx: number;
}

export interface EnemyG {
  /** The unit asset key the atlas frames are named under. */
  readonly key: string;
  /** Output stem: `public/art/units/<name>-g.webp` and `.json`. */
  readonly name: string;
  /** The pin file, relative to the repo root. */
  readonly pins: string;
  /** The preserved legacy cast, hit and KO cels, relative to the repo root. */
  readonly actions: string;
  /** The frozen tone the cels were toned with. */
  readonly tone: { readonly tool: string; readonly params: string };
  /** The packed cel width: 128, or wider where a weapon reaches past the margin. */
  readonly frameW: number;
  readonly headings: readonly EnemyGHeading[];
}

export interface EnemyGPins {
  /** SHA-256 of each toned PixelLab cel, relative to the source set. */
  readonly pixellab: Readonly<Record<string, string>>;
  /** SHA-256 of each preserved action cel, relative to the unit's `actions` folder. */
  readonly actions: Readonly<Record<string, string>>;
  readonly tone: { readonly tool: string; readonly params: string };
  /** Where each copied cel came from in the hand-off, for a set copied into the repo. */
  readonly origin?: Readonly<Record<string, string>>;
  /** SHA-256 of each decoded atlas cel's RGBA, written by the build. */
  readonly frames: Readonly<Record<string, string>>;
}

/** [direction, heading, rest cel, walk dx, walk dy, idle dy, heading dx] in pixels. */
export type EnemyGPlacement = readonly [string, Heading, number, number, number, number, number];

export function enemyHeadings(
  rows: readonly EnemyGPlacement[],
  walkDir: (direction: string) => string = (direction) => `walk/${direction}`,
): EnemyGHeading[] {
  if (rows.length !== 8) throw new Error('An enemy G set places all eight headings.');
  return rows.map(([direction, heading, restCel, walkDx, walkDy, idleDy, headingDx]) => ({
    direction,
    idle: headingClip('idle', heading),
    walk: headingClip('walk', heading),
    rest: headingClip('rest', heading),
    walkDir: walkDir(direction),
    restCel,
    walkDx,
    walkDy,
    idleDy,
    headingDx,
  }));
}

const ACTIONS = [
  ['cast', 3],
  ['hit', 1],
  ['ko', 1],
] as const;

/** Every source file the build reads, relative to its set. */
export function enemySourceFiles(def: EnemyG): { pixellab: string[]; actions: string[] } {
  const pixellab: string[] = [];
  for (const h of def.headings) {
    for (let i = 0; i < IDLE_CELS; i++) pixellab.push(`idle/${h.direction}/${i}.png`);
    for (let i = 0; i < WALK_CELS; i++)
      pixellab.push(`${h.walkDir}/${String(i).padStart(2, '0')}.png`);
  }
  const actions = ACTIONS.flatMap(([clip, count]) =>
    Array.from({ length: count }, (_, i) => `${clip}/${i}.png`),
  );
  return { pixellab, actions };
}

/** The clip frame counts of the one page: locomotion and the legacy actions. */
export function enemyCounts(def: EnemyG): Partial<Record<ClipName, number>> {
  const counts: Partial<Record<ClipName, number>> = { cast: 3, hit: 1, ko: 1 };
  for (const h of def.headings) {
    counts[h.idle] = IDLE_CELS;
    counts[h.walk] = WALK_CELS;
    counts[h.rest] = 1;
  }
  return counts;
}

/** A 128 px cel centred on the sheet's cel, unchanged. */
function widen(cel: Image, width: number): Image {
  if (width === cel.width) return cel;
  const out = newImage(width, cel.height);
  const x0 = (width - cel.width) / 2;
  if (!Number.isInteger(x0))
    throw new Error(`A ${width} px cel cannot centre a ${cel.width} px one.`);
  for (let y = 0; y < cel.height; y++)
    for (let x = 0; x < cel.width; x++) setPixel(out, x0 + x, y, pixelAt(cel, x, y));
  return out;
}

export interface EnemyGBuildOptions {
  readonly outDir: string;
  readonly pinsPath?: string;
  readonly actions?: string;
  readonly log?: (line: string) => void;
}

export async function buildEnemyG(
  def: EnemyG,
  source: string,
  options: EnemyGBuildOptions,
): Promise<{ bytes: number; frames: Record<string, string> }> {
  const pinsPath = options.pinsPath ?? def.pins;
  const actionsDir = options.actions ?? def.actions;
  const log = options.log ?? console.log;
  if (!existsSync(pinsPath)) throw new Error(`${pinsPath} is missing; pin the sources with --pin.`);
  const pins = JSON.parse(readFileSync(pinsPath, 'utf8')) as EnemyGPins;
  const files = enemySourceFiles(def);
  const problems = [
    ...checkSources(source, files.pixellab, pins.pixellab, 'PixelLab'),
    ...checkSources(actionsDir, files.actions, pins.actions, 'action'),
  ];
  if (pins.tone?.params !== def.tone.params)
    problems.push(`${pinsPath} does not record the frozen tone parameters`);
  if (problems.length > 0)
    throw new Error(`${def.name} G sources do not match ${pinsPath}:\n${problems.join('\n')}`);

  const { key, frameW } = def;
  const frames = new Map<string, Image>();
  for (const h of def.headings) {
    const walkCel = (i: number) =>
      normalise(
        readPng(join(source, h.walkDir, `${String(i).padStart(2, '0')}.png`)),
        h.headingDx + h.walkDx,
        h.walkDy + h.idleDy,
      );
    for (let i = 0; i < IDLE_CELS; i++)
      frames.set(
        `${key}/${h.idle}/${i}`,
        normalise(readPng(join(source, 'idle', h.direction, `${i}.png`)), h.headingDx, h.idleDy),
      );
    for (let i = 0; i < WALK_CELS; i++) frames.set(`${key}/${h.walk}/${i}`, walkCel(i));
    frames.set(`${key}/${h.rest}/0`, walkCel(h.restCel));
  }
  for (const [clip, count] of ACTIONS) {
    for (let i = 0; i < count; i++) {
      const cel = readPng(join(actionsDir, clip, `${i}.png`));
      if (cel.width !== FRAME_W || cel.height !== FRAME_H)
        throw new Error(`${clip}/${i} is ${cel.width}x${cel.height}, not ${FRAME_W}x${FRAME_H}.`);
      frames.set(`${key}/${clip}/${i}`, cel);
    }
  }

  const image = `${def.name}-g.webp`;
  const layout = layoutSheet(key, enemyCounts(def), frameW, FRAME_H);
  const atlas = newImage(layout.width, layout.height);
  for (const [frame, rect] of layout.frames) {
    const narrow = frames.get(frame);
    if (!narrow) throw new Error(`No pixels prepared for ${frame}.`);
    const pixels = widen(narrow, frameW);
    for (let y = 0; y < pixels.height; y++)
      for (let x = 0; x < pixels.width; x++)
        setPixel(atlas, rect.x + x, rect.y + y, pixelAt(pixels, x, y));
  }
  const webp = await encodeWebp(atlas, WEBP_QUALITY, true);
  const json = `${JSON.stringify(JSON.parse(atlasJsonText(layout.frames, image, layout.width, layout.height)))}\n`;
  const decoded = await decodeWebp(webp);
  const frameHashes: Record<string, string> = {};
  for (const [frame, rect] of layout.frames) frameHashes[frame] = celHash(decoded, rect);

  mkdirSync(options.outDir, { recursive: true });
  writeFileSync(join(options.outDir, image), webp);
  writeFileSync(join(options.outDir, `${def.name}-g.json`), json);
  writeFileSync(pinsPath, `${JSON.stringify({ ...pins, frames: frameHashes }, null, 2)}\n`);
  log(`wrote ${image} (${layout.width}x${layout.height}, ${webp.length} B) and ${def.name}-g.json`);
  log(`wrote ${pinsPath} cel pins`);
  return { bytes: webp.length, frames: frameHashes };
}

export function argValue(argv: readonly string[], flag: string): string | undefined {
  const at = argv.indexOf(flag);
  return at < 0 ? undefined : argv[at + 1];
}
