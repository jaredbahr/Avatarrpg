/**
 * Reproducibly builds the quarry bandits' G sheets (ADR 0060): the toned
 * PixelLab slinger, bruiser and quarry bender, each with an eight-heading
 * idle and walk packed by the shared enemy packer (`enemy-g.ts`), beside its
 * old sheet's cast, hit and KO cels.
 *
 * Usage:
 *   node --import tsx scripts/art/bandits-g.ts --import <models-p1-bandits> [--unit <name>]
 *   node --import tsx scripts/art/bandits-g.ts [--unit <name>]
 *
 * `--import` copies the supervisor's selection out of the P1 hand-off into
 * `art/source/<unit>-g/cels` and writes the unit's pin file: each facing's
 * offered `final-toned` idle (four cels, already in play order) and walk,
 * except the retakes that replaced a walk — quarry bender north and
 * south-east (`final-r3-toned`, `selection-r3.json`), bruiser west and
 * south-west (`final-r3-toned`) and bruiser south-east, r4b
 * (`final-r4-toned`; the supervisor chose no crouch-lunge over the travel
 * number, and its idle stays the take-1 idle). Every cel must be the one its
 * tone manifest wrote with the thug's frozen `params-v3.json`; nothing is
 * re-toned, and neither the copy nor the pin file is ever overwritten.
 *
 * Without `--import` the build reads the copies, which must match their pins.
 *
 * The placement is measured by the rules in `enemy-g.ts` on each selected
 * walk's `gates.json`, and each walk's `speed_px_per_frame` sets its clip
 * time per tile in the manifest. The bruiser's club reaches past the 128 px
 * cel's margin in five headings, so his sheet packs 160 px cels (the
 * manifest's `frameSize`), centred, which moves no foot off the anchor.
 *
 * The cast, hit and KO cels are each bandit's old sheet's, copied verbatim
 * into `art/source/<unit>-actions` and still mirrored like the thug's.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { sha256 } from './g-sprites';
import type { EnemyG, EnemyGPins, EnemyGPlacement } from './enemy-g';
import { argValue, buildEnemyG, enemyHeadings, enemySourceFiles } from './enemy-g';

/** The frozen thug tone, applied with each unit's own skin mask (REPORT §4). */
export const BANDIT_TONE = {
  tool: 'models-p1-bandits/scripts/tone_p1.py',
  params: 'd6f5afc6a8cee9a096fafcc29f9532f847065812a61e95cdc9356d0bdda61494',
} as const;

export type BanditName = 'slinger' | 'bruiser' | 'quarrybender';
export const BANDIT_NAMES: readonly BanditName[] = ['slinger', 'bruiser', 'quarrybender'];

/** The hand-off folder of each walk a retake replaced: [toned set, take]. */
export const BANDIT_RETAKES: Readonly<
  Partial<Record<BanditName, Readonly<Record<string, readonly [string, string]>>>>
> = {
  quarrybender: {
    north: ['final-r3-toned', 'north-r3'],
    'south-east': ['final-r3-toned', 'south-east-r3'],
  },
  bruiser: {
    west: ['final-r3-toned', 'west-r3'],
    'south-west': ['final-r3-toned', 'south-west-r3b'],
    'south-east': ['final-r4-toned', 'south-east-r4b'],
  },
};

/**
 * [direction, heading, rest cel, walk dx, walk dy, idle dy, heading dx],
 * measured by the rules in `enemy-g.ts`. North idles stood 2-4 px above the
 * foot line; the south-east idles' near feet stood 16.1-19.9 px left of the
 * column, up to 4 px past the bound; east and west walks were drawn high, as
 * the thug's were.
 */
const PLACEMENTS: Readonly<Record<BanditName, readonly EnemyGPlacement[]>> = {
  slinger: [
    ['east', 'east', 2, 0, 14, 0, 0],
    ['north-east', 'northEast', 5, 0, 7, 0, 0],
    ['north', 'north', 6, 0, 0, 4, 0],
    ['north-west', 'northWest', 6, 0, 7, 0, 0],
    ['west', 'west', 2, 5, 15, 0, 0],
    ['south-west', 'southWest', 3, 0, 8, 0, 0],
    ['south', 'south', 6, 0, -7, 0, 0],
    ['south-east', 'southEast', 6, 0, 5, 0, 1],
  ],
  bruiser: [
    ['east', 'east', 2, 0, 11, 0, 0],
    ['north-east', 'northEast', 6, 2, 5, 0, 0],
    ['north', 'north', 2, 3, 0, 2, 0],
    ['north-west', 'northWest', 6, -3, 5, 0, 0],
    ['west', 'west', 3, 6, 13, 0, 0],
    // The sole rule gives 5 px down; his idle stands 2 px below the line, so
    // the walk's mean lowest row comes back within 3.5 px of it at 1.
    ['south-west', 'southWest', 2, 3, 1, 0, 0],
    ['south', 'south', 2, 0, -4, 0, 0],
    ['south-east', 'southEast', 5, -3, 3, 0, 4],
  ],
  quarrybender: [
    ['east', 'east', 5, -3, 13, 0, 0],
    ['north-east', 'northEast', 2, 0, 8, 0, 0],
    ['north', 'north', 7, 0, 0, 4, 0],
    ['north-west', 'northWest', 6, -3, 6, 0, 0],
    ['west', 'west', 5, 5, 15, 0, 0],
    ['south-west', 'southWest', 2, 0, 7, 0, 0],
    ['south', 'south', 5, 0, -6, 0, 0],
    ['south-east', 'southEast', 6, -2, 3, 0, 4],
  ],
};

const bandit = (name: BanditName): EnemyG => ({
  key: `unit.enemy.${name}`,
  name,
  pins: `art/source/${name}-g/pins.json`,
  actions: `art/source/${name}-actions`,
  tone: BANDIT_TONE,
  frameW: name === 'bruiser' ? 160 : 128,
  headings: enemyHeadings(PLACEMENTS[name]),
});

export const BANDITS: Readonly<Record<BanditName, EnemyG>> = {
  slinger: bandit('slinger'),
  bruiser: bandit('bruiser'),
  quarrybender: bandit('quarrybender'),
};

/** The repo copy of a bandit's selected cels. */
export const banditCels = (name: BanditName): string => `art/source/${name}-g/cels`;

/**
 * Where a copied cel comes from in the hand-off: the toned set whose tone
 * manifest names it, and its name in that manifest.
 */
export function banditOrigin(name: BanditName, file: string): { set: string; file: string } {
  const walk = /^walk\/([a-z-]+)\/(\d\d\.png)$/.exec(file);
  const retake = walk?.[1] ? BANDIT_RETAKES[name]?.[walk[1]] : undefined;
  if (walk && retake) return { set: `${name}/${retake[0]}`, file: `walk/${retake[1]}/${walk[2]}` };
  return { set: `${name}/final-toned`, file };
}

/** Copies a bandit's selection into the repo and pins it. Refuses to overwrite either. */
export function importBandit(
  name: BanditName,
  handoff: string,
  root = '.',
): { copied: number; pins: string } {
  const def = BANDITS[name];
  const pinsPath = join(root, def.pins);
  const cels = join(root, banditCels(name));
  if (existsSync(pinsPath))
    throw new Error(`${pinsPath} exists; a pin file is never rewritten by --import.`);
  if (existsSync(cels)) throw new Error(`${cels} exists; a copied set is never rewritten.`);
  const files = enemySourceFiles(def);
  const manifests = new Map<string, { params: string | undefined; out: Map<string, string> }>();
  const manifest = (set: string) => {
    let found = manifests.get(set);
    if (!found) {
      const path = join(handoff, set, 'tone-manifest.json');
      const json = existsSync(path)
        ? (JSON.parse(readFileSync(path, 'utf8')) as {
            params_sha256?: string;
            files?: Record<string, { out?: string }>;
          })
        : {};
      found = {
        params: json.params_sha256,
        out: new Map(Object.entries(json.files ?? {}).map(([file, e]) => [file, e.out ?? ''])),
      };
      manifests.set(set, found);
    }
    return found;
  };
  const problems: string[] = [];
  const pixellab: Record<string, string> = {};
  const origin: Record<string, string> = {};
  for (const file of files.pixellab) {
    const from = banditOrigin(name, file);
    const path = join(handoff, from.set, from.file);
    const toned = manifest(from.set);
    if (toned.params !== BANDIT_TONE.params)
      problems.push(`${from.set} was not toned with the frozen parameters`);
    if (!existsSync(path)) {
      problems.push(`${from.set}/${from.file} is missing`);
      continue;
    }
    const hash = sha256(readFileSync(path));
    if (toned.out.get(from.file) !== hash)
      problems.push(`${from.set}/${from.file} is not the cel its tone manifest wrote`);
    pixellab[file] = hash;
    origin[file] = `${from.set}/${from.file}`;
  }
  if (problems.length > 0)
    throw new Error(`${name} cannot be imported:\n${[...new Set(problems)].join('\n')}`);
  for (const file of files.pixellab) {
    mkdirSync(resolve(cels, file, '..'), { recursive: true });
    copyFileSync(join(handoff, origin[file]!), join(cels, file));
  }
  const actions = Object.fromEntries(
    files.actions.map((file) => [file, sha256(readFileSync(join(root, def.actions, file)))]),
  );
  const pins: EnemyGPins = { pixellab, actions, tone: BANDIT_TONE, origin, frames: {} };
  mkdirSync(resolve(pinsPath, '..'), { recursive: true });
  writeFileSync(pinsPath, `${JSON.stringify(pins, null, 2)}\n`);
  return { copied: files.pixellab.length, pins: pinsPath };
}

if (process.argv[1]?.endsWith('bandits-g.ts')) {
  const argv = process.argv.slice(2);
  const unit = argValue(argv, '--unit');
  if (unit && !BANDIT_NAMES.includes(unit as BanditName))
    throw new Error(`Pass --unit <${BANDIT_NAMES.join('|')}>; got ${unit}.`);
  const names = unit ? [unit as BanditName] : BANDIT_NAMES;
  const handoff = argValue(argv, '--import');
  for (const name of names) {
    if (handoff) {
      const { copied, pins } = importBandit(name, resolve(handoff));
      console.log(`copied ${copied} ${name} cels and wrote ${pins} source pins`);
    } else {
      await buildEnemyG(BANDITS[name], banditCels(name), { outDir: resolve('public/art/units') });
    }
  }
}
