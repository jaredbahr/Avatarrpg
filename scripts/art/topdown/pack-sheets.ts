/**
 * The top-down figure sheets (ADR 0104 T2): the prototype's approved PixelLab takes
 * (`prototypes/topdown/assets/`) packed into lossless atlases under `public/art/topdown/`, and the
 * numbers the manifest's `topdownSheet` builder needs into `src/content/assets/topdownSheets.ts`.
 *
 *   node --import tsx scripts/art/topdown/pack-sheets.ts [--check]
 *
 * Deterministic: the same sources pack to the same bytes. `--check` packs in memory and fails when
 * a shipped file differs or is missing, or `public/art/topdown/` holds a file the packer does not
 * write. Nothing is redrawn: every cel is a PixelLab frame, alpha-thresholded to hard alpha (it
 * already is), with the prototype's breath-vapour clean (`build8.py` `clean`) and placed on the
 * canvas PixelLab drew it on, so each clip keeps PixelLab's own registration.
 *
 * - Figures (48 px characters on PixelLab's 64 or 80 px animation canvases): every canvas is
 *   centred on an 80 px basis, whose column 40 is the anchor column. The foot line is the most
 *   common ground row (the row under the lowest sole) of the idle's cels. Idle, walk and rest share
 *   the sheet frame (the union of their ink about the anchor, plus a 1 px margin); every other clip
 *   (hits, knockouts, the cast and each heading of each ability) is trimmed to its own ink with its
 *   own anchor.
 * - The idle keeps the prototype's calm frames (`build8.py` `calm_frames`: the head within 1 px of
 *   the rest pose), the first three, played there and back at the prototype's 420 ms a cel.
 * - The walk plays at the prototype's ground per loop (`CYCLE_PX`, `STATS.cycle`) and the Ba Dan
 *   exploration pace (`WALK_PX_PER_S`, 130 px a second), so `walkMsPerTile` holds the planted foot.
 * - The Driller (a PixelLab object on a 128 px canvas, 2x2) stands on each view's base, centred
 *   under its ink; its slam per heading carries the prototype's frame times and hit frame. T5 adds its
 *   tread loop as the walk, the engine's rumble in all eight headings, a hit shudder and a jammed knockout.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Image } from '../lib/image';
import { newImage, readPng } from '../lib/image';
import { composeAtlas, shelfPack, type Item } from '../lib/atlas';
import { encodeWebpLossless } from '../lib/webp';
import { format, resolveConfig } from 'prettier';

export const SOURCE = 'prototypes/topdown/assets';
export const OUT = 'public/art/topdown';
export const DATA = 'src/content/assets/topdownSheets.ts';
/** The T3 objects (`world.route_sign`, `world.school_notice`): plain trimmed PNGs under `objects/`. */
export const OBJECTS = ['route_sign', 'school_notice'] as const;
export const OBJECTS_OUT = `${OUT}/objects`;

/** Every file shipped under `public/art/topdown/`, the objects folder included. */
export function shippedFiles(): string[] {
  const top = existsSync(OUT) ? readdirSync(OUT) : [];
  const objects = existsSync(OBJECTS_OUT) ? readdirSync(OBJECTS_OUT) : [];
  return [
    // The boards' folders (`ba-dan/`, `forest-road/`, the quarry's three) are the ground packer's
    // (`pack-ground.ts`) and `props/` the prop packer's (`pack-props.ts`), each held by its own test.
    ...top
      .filter(
        (f) =>
          ![
            'objects',
            'ba-dan',
            'forest-road',
            'quarry-gate',
            'cutting',
            'quarry-floor',
            'props',
          ].includes(f),
      )
      .map((f) => `${OUT}/${f}`),
    ...objects.map((f) => `${OBJECTS_OUT}/${f}`),
  ];
}

/** The VFX packer owns exactly these two shared-directory outputs. */
export const VFX_OUTPUTS = [`${OUT}/vfx.webp`, `${OUT}/vfx.json`] as const;

/**
 * The striking hand of an action in one heading, in frame px of its trimmed cels, on its hit cel: where its attached
 * effects start. Of the pixels the strike drew that its first cel did not (all of the hit cel's, if under four), above
 * 60% of the figure's height (so not the stepping feet), the one reaching furthest from the chest along the aim, plus
 * half its distance from the chest and a little height, since a hand raised for an overhead throw is still the hand;
 * the middle of those within a pixel of the best. A hand hidden behind the body (a punch facing north) lands on the
 * nearest drawn reach: the shoulders or the head.
 */
export function strikeHand(
  first: Image,
  hit: Image,
  anchor: { x: number; y: number },
  heading: Heading,
): { x: number; y: number } {
  const angle = (HEADINGS.indexOf(heading) * Math.PI) / 4;
  const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
  const ax = anchor.x * hit.width;
  const ay = anchor.y * hit.height;
  let top = hit.height;
  for (let i = 0; i < first.width * first.height; i++)
    if (alphaAt(first, i % first.width, Math.floor(i / first.width)))
      top = Math.min(top, Math.floor(i / first.width));
  const chest = top + 0.35 * (ay - top);
  const band: [number, number, boolean][] = [];
  for (let y = 0; y < hit.height && y + 0.5 <= top + 0.6 * (ay - top); y++)
    for (let x = 0; x < hit.width; x++)
      if (alphaAt(hit, x, y)) band.push([x, y, !alphaAt(first, x, y)]);
  const drawn = band.filter((p) => p[2]);
  const pts = drawn.length >= 4 ? drawn : band;
  const score = ([x, y]: [number, number, boolean]) => {
    const vx = x + 0.5 - ax;
    const vy = y + 0.5 - chest;
    return vx * dx + vy * dy + 0.5 * Math.hypot(vx, vy) - 0.4 * vy;
  };
  const best = Math.max(...pts.map(score));
  const near = pts.filter((p) => score(p) >= best - 1);
  const mean = (i: 0 | 1) => Math.round(near.reduce((sum, p) => sum + p[i], 0) / near.length);
  return { x: mean(0), y: mean(1) };
}

/** The game's headings (`HEADINGS` order) and PixelLab's direction names for them. */
const HEADINGS = [
  'east',
  'southEast',
  'south',
  'southWest',
  'west',
  'northWest',
  'north',
  'northEast',
] as const;
type Heading = (typeof HEADINGS)[number];
const DIR: Readonly<Record<Heading, string>> = {
  east: 'east',
  southEast: 'south-east',
  south: 'south',
  southWest: 'south-west',
  west: 'west',
  northWest: 'north-west',
  north: 'north',
  northEast: 'north-east',
};
const DIAGONALS: readonly Heading[] = ['southEast', 'southWest', 'northEast', 'northWest'];
/** A clip name for a heading: east is unsuffixed for the locomotion clips (`headingClip`). */
const sided = (base: string, heading: Heading, eastBare: boolean): string =>
  heading === 'east' && eastBare ? base : `${base}${heading[0]?.toUpperCase()}${heading.slice(1)}`;

/** The 80 px basis every figure canvas is centred on, and its anchor column. */
const BASIS = 80;
const COLUMN = BASIS / 2;
/** The top-down tile (ADR 0104: the prototype's 40 px cell); one art px is one world px. */
const PIXELS_PER_TILE = 40;
/** The prototype's idle: calm frames there and back, 420 ms a cel (`units.js`, `game13.js`). */
const IDLE_CEL_MS = 420;
const IDLE_CELS = 3;
/**
 * The exploration walk, in px a second: the prototype's 130 px/s, about 308 ms a 40 px tile (owner, 2026-11-07;
 * ADR 0104 amendment). The walk's cel time scales with it, so the feet keep pace with the ground and never slide.
 * Ba Dan's own prototype walk was 66 px/s (`game13.js` `WALK_SPEED`); the owner chose the brisker pace.
 */
const WALK_PX_PER_S = 130;

/** How the prototype times a blow: Kaya's bends (`fx.js` `MOVES`) or everyone else's (`units.js` `ATK`). */
type Timing = 'bend' | 'blow';

export interface FigureSpec {
  readonly name: string;
  readonly key: string;
  readonly folder: string;
  /** Animation keys in the folder's `meta.json` (`<type>@<group>`), pinned so a later take never moves them. */
  readonly idle: string;
  readonly walk?: string;
  /** Ground px one walk loop covers (`CYCLE_PX` / `STATS.cycle`). */
  readonly stride: number;
  readonly hit?: string;
  readonly ko?: string;
  /**
   * Knockout headings that end earlier than `KO_CELS`: how many cels they keep, the last one held. Jinu's south and
   * north knockouts spread the cape into wings from the seventh cel, so they hold the sixth.
   */
  readonly koCels?: Partial<Record<Heading, number>>;
  /**
   * Ability poses: pose name -> animation key, with how many frames the prototype plays (Kaya's jab: 11). `mirror`
   * draws a heading from another heading's cels flipped about the anchor column (the hand swaps), for a heading whose
   * own take is unusable: Wen's gauntlet turned into a hook or a rope in the west and north-west of her punch.
   */
  readonly actions: Readonly<
    Record<
      string,
      {
        readonly anim: string;
        readonly frames?: number;
        readonly mirror?: Partial<Record<Heading, Heading>>;
      }
    >
  >;
  /** The pose the legacy mirrored `cast` plays (its east heading). */
  readonly cast?: string;
  readonly timing: Timing;
}

const ROSTER: readonly FigureSpec[] = [
  {
    name: 'kaya',
    key: 'unit.fire.kaya',
    folder: 'kaya2',
    idle: 'custom-standing at rest and breathing@6c8d43',
    walk: 'custom-a relaxed natural walking cycl@e7f0ee',
    stride: 30,

    hit: 'custom-a hit reaction: flinches from @b53df1',
    ko: 'custom-knocked out: staggers back one@867b24',
    actions: {
      jab: { anim: 'custom-a martial-arts punch: draws th@ca8c40', frames: 11 },
      whip: { anim: 'custom-a fire-bending whip: from a lo@829e97' },
      stomp: { anim: 'custom-a martial-arts ground stomp: s@edf577' },
      blast: { anim: 'custom-a martial-arts double palm str@3814b6' },
    },
    cast: 'jab',
    timing: 'bend',
  },
  {
    name: 'sura',
    key: 'unit.water.sura',
    folder: 'fc_sura',
    idle: 'custom-standing at rest in a ready st@354eb4',
    walk: 'walking-8-frames@456697',
    stride: 28,

    hit: 'custom-a hit reaction: flinches from @365153',
    ko: 'custom-knocked out: staggers back one@0fd501',
    actions: {
      attack: { anim: 'custom-a water-bending strike: sweeps@cade9a' },
      ice: { anim: 'custom-an ice-bending sweep: bends lo@e455dd' },
      heal: { anim: 'custom-a healing gesture: brings both@f0450e' },
    },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'bo',
    key: 'unit.earth.bo',
    folder: 'fc_bo',
    idle: 'custom-standing at rest in a ready st@2ea427',
    walk: 'walking-8-frames@554d11',
    stride: 28,

    hit: 'custom-a hit reaction: flinches from @66539e',
    ko: 'custom-knocked out: staggers back one@ccae2f',
    actions: {
      attack: { anim: 'custom-an earth-bending strike: lifts@fcd2f3' },
      wall: { anim: 'custom-an earth-bending wall raise: d@e797f6' },
      stance: { anim: 'custom-a defensive stance: plants bot@62ab50' },
    },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'thug',
    key: 'unit.enemy.thug',
    folder: 'fc_thug',
    idle: 'custom-standing at rest in a ready st@2c9c07',
    walk: 'walking-8-frames@caf706',
    stride: 28,

    hit: 'custom-a hit reaction: flinches from @ff3c79',
    ko: 'custom-knocked out: staggers back one@c9af84',
    actions: { attack: { anim: 'custom-swings the wooden club in a bi@a051cd' } },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'slinger',
    key: 'unit.enemy.slinger',
    folder: 'fc_slinger',
    idle: 'custom-standing at rest in a ready st@1f338f',
    walk: 'walking-8-frames@08e4c0',
    stride: 28,

    hit: 'custom-a hit reaction: flinches from @c90d94',
    ko: 'custom-knocked out: staggers back one@6293c1',
    actions: { attack: { anim: 'custom-whirls the leather sling overh@7218e5' } },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'bruiser',
    key: 'unit.enemy.bruiser',
    folder: 'fc_bruiser',
    idle: 'custom-standing at rest in a ready st@c13a8a',
    walk: 'walking-8-frames@4c8a95',
    stride: 30,

    hit: 'custom-a hit reaction: flinches from @3b2327',
    ko: 'custom-knocked out: staggers back one@65522d',
    actions: { attack: { anim: 'custom-raises the heavy cudgel high w@2640df' } },
    cast: 'attack',
    timing: 'blow',
  },
  // The Ba Dan residents (`build8.py` `CH`): idle and walk; Mira and Hanru stand (no walk was drawn).
  {
    name: 'mira',
    key: 'npc.elder',
    folder: 'v7_mira',
    idle: 'custom-an elderly woman standing at r@cd6510',
    stride: 30,
    actions: {},
    timing: 'blow',
  },
  {
    name: 'gao',
    key: 'npc.shopkeeper',
    folder: 'v7_gao',
    idle: 'custom-standing at rest: the chest an@2297a3',
    walk: 'walking-8-frames@dafa05',
    stride: 30,
    actions: {},
    timing: 'blow',
  },
  {
    name: 'pella',
    key: 'npc.kid',
    folder: 'v7_pella',
    idle: 'custom-standing at rest: the chest an@28a8af',
    walk: 'walking-8-frames@45cb0d',
    stride: 30,
    actions: {},
    timing: 'blow',
  },
  {
    name: 'dorin',
    key: 'npc.dorin',
    folder: 'v7_dorin',
    idle: 'custom-standing at rest: the chest an@bb588c',
    walk: 'walking-8-frames@234afa',
    stride: 30,
    actions: {},
    timing: 'blow',
  },
  {
    name: 'household',
    key: 'npc.household',
    folder: 'v7_household',
    idle: 'custom-standing at rest: the chest an@745345',
    walk: 'walking-8-frames@1696e6',
    stride: 30,
    actions: {},
    timing: 'blow',
  },
  {
    name: 'hanru',
    key: 'npc.hanru',
    folder: 'v7_hanru',
    idle: 'custom-standing at rest: the chest an@265b11',
    stride: 30,
    actions: {},
    timing: 'blow',
  },
  // T5 (#452): the quarry cast, from the prototype's approved idle, walk and blow (`build_b3.py` `T13`), with the hits
  // and knockouts `tools/t5clips.py` posed from each one's own base, and the new mercenary sergeant.
  {
    name: 'deserter',
    key: 'unit.enemy.deserter',
    folder: 't13_deserter',
    idle: 'custom-standing at rest in a ready st@899aa0',
    walk: 'walking-8-frames@4fc032',
    stride: 28,
    hit: 'custom-a hit reaction: flinches from @72f948',
    ko: 'custom-knocked out: staggers back one@1ba06e',
    actions: {
      attack: { anim: 'custom-a martial-arts punch: draws th@6c46fe' },
      throw: { anim: 'custom-throws a small jar underarm to@28df8f' },
    },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'quarrybender',
    key: 'unit.enemy.quarrybender',
    folder: 't13_qbender',
    idle: 'custom-standing at rest in a ready st@9368ae',
    walk: 'walking-8-frames@984071',
    stride: 30,
    hit: 'custom-a hit reaction: flinches from @8a3a52',
    ko: 'custom-knocked out: staggers back one@58ab07',
    actions: { attack: { anim: 'custom-a heavy two-handed throw: crou@01c4bc' } },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'merc',
    key: 'unit.enemy.merc',
    folder: 't13_merc',
    idle: 'custom-standing at rest in a ready st@99e889',
    walk: 'walking-8-frames@6f3db0',
    stride: 28,
    hit: 'custom-a hit reaction: flinches from @fca5ad',
    ko: 'custom-knocked out: staggers back one@22478f',
    actions: { attack: { anim: 'custom-a quick low sword slash: steps@82fda6' } },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'crossbow',
    key: 'unit.enemy.crossbow',
    folder: 't13_xbow',
    idle: 'custom-standing at rest in a ready st@4c219b',
    walk: 'walking-8-frames@ed11b8',
    stride: 28,
    hit: 'custom-a hit reaction: flinches from @37b74a',
    // The second knockout group: the first (@64ab6c) ended sitting up in every heading.
    ko: 'custom-knocked out: staggers back one@b60996',
    actions: { attack: { anim: 'custom-raises the crossbow to the sho@a5e4b9' } },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'sergeant',
    key: 'unit.enemy.sergeant',
    folder: 't5_sergeant',
    idle: 'custom-standing at rest in a ready st@8c7f04',
    walk: 'walking-8-frames@ab35a1',
    stride: 28,
    hit: 'custom-a hit reaction: flinches from @eac203',
    ko: 'custom-knocked out: staggers back one@f4a18d',
    actions: { attack: { anim: 'custom-a heavy overhand sword chop: r@3e7e72' } },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'ruon',
    key: 'unit.ally.ruon',
    folder: 't13_ruon',
    idle: 'custom-standing at rest in a ready st@8f3b8e',
    walk: 'walking-8-frames@56f096',
    stride: 28,
    hit: 'custom-a hit reaction: flinches from @4ece7f',
    ko: 'custom-knocked out: staggers back one@9cddb9',
    actions: { attack: { anim: 'custom-a disciplined sabre cut: draws@4d716f' } },
    cast: 'attack',
    timing: 'blow',
  },
  // T8: the heroes the tutorial does not cast, made like Sura and Bo by `tools/t8heroes.py`: idle, walk, hit,
  // knockout and a pose for each of the level-1 and level-2 abilities; the cast is the level-1 ability's.
  {
    name: 'tenzo',
    key: 'unit.fire.tenzo',
    folder: 't8_tenzo',
    idle: 'custom-standing at rest in a ready st@c8ecc4',
    walk: 'walking-8-frames@fc70f0',
    stride: 28,
    hit: 'custom-a hit reaction: flinches from @f0afab',
    ko: 'custom-knocked out: staggers back one@4723e3',
    actions: {
      attack: { anim: 'custom-a martial-arts punch: draws th@653c55' },
      blast: { anim: 'custom-a martial-arts double palm str@eb5022' },
    },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'nilak',
    key: 'unit.water.nilak',
    folder: 't8_nilak',
    idle: 'custom-standing at rest in a ready st@56042a',
    walk: 'walking-8-frames@3d44ae',
    stride: 28,
    hit: 'custom-a hit reaction: flinches from @844649',
    ko: 'custom-knocked out: staggers back one@878a53',
    actions: {
      attack: { anim: 'custom-a whip-like arm sweep: swings @ee28e1' },
      heal: { anim: 'custom-a calm healing gesture: brings@3b80c6' },
    },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'linmei',
    key: 'unit.earth.linmei',
    folder: 't8_linmei',
    idle: 'custom-standing at rest in a ready st@21cddd',
    walk: 'walking-8-frames@66c98b',
    stride: 28,
    hit: 'custom-a hit reaction: flinches from @f714e5',
    ko: 'custom-knocked out: staggers back one@c21184',
    actions: {
      attack: { anim: 'custom-a martial-arts stomp and punch@1dbef8' },
      throw: { anim: 'custom-a heavy two-handed throw: crou@ea198c' },
    },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'nima',
    key: 'unit.air.nima',
    folder: 't8_nima',
    idle: 'custom-standing at rest in a ready st@cf3549',
    walk: 'walking-8-frames@beb4a3',
    stride: 28,
    hit: 'custom-a hit reaction: flinches from @84431d',
    ko: 'custom-knocked out: staggers back one@616959',
    actions: {
      attack: { anim: 'custom-a martial-arts open palm push:@3ec356' },
      gust: { anim: 'custom-a wide sweeping two-arm swing:@acd49d' },
    },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'jinu',
    key: 'unit.air.jinu',
    folder: 't8_jinu',
    idle: 'custom-standing at rest in a ready st@a43971',
    walk: 'walking-8-frames@60c286',
    stride: 28,
    hit: 'custom-a hit reaction: flinches from @62f5fc',
    ko: 'custom-knocked out: staggers back one@5a0a37',
    // The seventh and eighth cels spread her cape into wings in the south and north: those hold the sixth.
    koCels: { south: 6, north: 6 },
    actions: {
      attack: { anim: 'custom-a martial-arts open palm push:@dd511a' },
      gust: { anim: 'custom-a wide sweeping two-arm swing:@789b1a' },
    },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'riko',
    key: 'unit.non.riko',
    folder: 't8_riko',
    idle: 'custom-standing at rest in a ready st@099cc8',
    walk: 'walking-8-frames@705043',
    stride: 28,
    hit: 'custom-a hit reaction: flinches from @479af0',
    ko: 'custom-knocked out: staggers back one@bab294',
    actions: {
      attack: { anim: 'custom-a quick boxing combination: st@363f04' },
      block: { anim: 'custom-a precise finger strike: darts@5ed79c' },
    },
    cast: 'attack',
    timing: 'blow',
  },
  {
    name: 'wen',
    key: 'unit.non.wen',
    folder: 't8_wen',
    idle: 'custom-standing at rest in a ready st@3a8ec0',
    walk: 'walking-8-frames@655aec',
    stride: 28,
    hit: 'custom-a hit reaction: flinches from @3bbc70',
    ko: 'custom-knocked out: staggers back one@c886be',
    actions: {
      // West and north-west turned the gauntlet into a hook or a rope (twice): drawn as east and north-east, mirrored.
      attack: {
        anim: 'custom-a heavy hook punch: winds the @0e1997',
        mirror: { west: 'east', northWest: 'northEast' },
      },
      spark: { anim: 'custom-thrusts the right arm with the@c4e7db' },
    },
    cast: 'attack',
    timing: 'blow',
  },
  // T3: the town guard (the relief watch and a returnee), made like the residents: idle and walk, eight headings.
  {
    name: 'guard',
    key: 'npc.guard',
    folder: 't3_guard',
    idle: 'custom-standing at rest: the chest an@e13bd6',
    walk: 'walking-8-frames@9bfadc',
    stride: 30,
    actions: {},
    timing: 'blow',
  },
  // T10: the road keeper Dema and Sen, the Cutting's tea keeper, who borrowed Mira's and Gao's sheets, made as the
  // guard was (`tools/t10residents.py`): idle and walk, eight headings.
  {
    name: 'dema',
    key: 'npc.dema',
    folder: 't10_dema',
    idle: 'custom-standing at rest: the chest an@571e1f',
    walk: 'walking-8-frames@73450f',
    stride: 30,
    actions: {},
    timing: 'blow',
  },
  {
    name: 'sen',
    key: 'npc.sen',
    folder: 't10_sen',
    idle: 'custom-standing at rest: the chest an@3b94f2',
    walk: 'walking-8-frames@ca010f',
    stride: 30,
    actions: {},
    timing: 'blow',
  },
];

/* ------------------------------------------------------------------ */
/* Cels                                                                */
/* ------------------------------------------------------------------ */

const alphaAt = (im: Image, x: number, y: number): number =>
  im.data[(y * im.width + x) * 4 + 3] ?? 0;

/** Every pixel fully opaque or fully clear: alpha 128 and up is the figure (`build_b3.py`). */
function hardAlpha(im: Image): Image {
  const out = { width: im.width, height: im.height, data: new Uint8Array(im.data) };
  for (let i = 3; i < out.data.length; i += 4) {
    if ((out.data[i] ?? 0) >= 128) out.data[i] = 255;
    else out.data.fill(0, i - 3, i + 1);
  }
  return out;
}

/**
 * `build8.py` `clean`: drop small grey specks apart from the figure (the breath vapour an idle prompt
 * drew). Components are 8-connected opaque runs, found in row order; all but the largest that are at
 * most 24 px with a mean saturation under 40 go.
 */
function clean(im: Image): Image {
  const { width: w, height: h } = im;
  const seen = new Uint8Array(w * h);
  const comps: number[][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (seen[start] || alphaAt(im, x, y) < 128) continue;
      seen[start] = 1;
      const stack = [start];
      const comp: number[] = [];
      while (stack.length) {
        const p = stack.pop() ?? 0;
        comp.push(p);
        const cx = p % w;
        const cy = (p - cx) / w;
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const q = ny * w + nx;
            if (!seen[q] && alphaAt(im, nx, ny) >= 128) {
              seen[q] = 1;
              stack.push(q);
            }
          }
      }
      comps.push(comp);
    }
  if (comps.length < 2) return im;
  // Python's sort is stable: equal sizes keep their discovery order.
  const order = comps
    .map((c, i) => [c, i] as const)
    .sort((a, b) => b[0].length - a[0].length || a[1] - b[1]);
  const out = { width: w, height: h, data: new Uint8Array(im.data) };
  for (const [comp] of order.slice(1)) {
    if (comp.length > 24) continue;
    let sat = 0;
    for (const p of comp) {
      const r = out.data[p * 4] ?? 0;
      const g = out.data[p * 4 + 1] ?? 0;
      const b = out.data[p * 4 + 2] ?? 0;
      sat += Math.max(r, g, b) - Math.min(r, g, b);
    }
    if (sat / comp.length < 40) for (const p of comp) out.data.fill(0, p * 4, p * 4 + 4);
  }
  return out;
}

/** A cel placed on a basis canvas: its pixels and where its (0, 0) sits on the basis. */
interface Placed {
  readonly image: Image;
  readonly ox: number;
  readonly oy: number;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The ink box of a placed cel on its basis (x1, y1 exclusive), or null when it is empty. */
function inkBox(cel: Placed): Box | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < cel.image.height; y++)
    for (let x = 0; x < cel.image.width; x++)
      if (alphaAt(cel.image, x, y)) {
        x0 = Math.min(x0, x + cel.ox);
        y0 = Math.min(y0, y + cel.oy);
        x1 = Math.max(x1, x + cel.ox + 1);
        y1 = Math.max(y1, y + cel.oy + 1);
      }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

function union(boxes: readonly (Box | null)[]): Box {
  const out = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const b of boxes) {
    if (!b) continue;
    out.x0 = Math.min(out.x0, b.x0);
    out.y0 = Math.min(out.y0, b.y0);
    out.x1 = Math.max(out.x1, b.x1);
    out.y1 = Math.max(out.y1, b.y1);
  }
  if (out.x1 < 0) throw new Error('no ink');
  return out;
}

/** Cut `rect` (basis coordinates) out of a placed cel. */
function cut(cel: Placed, rect: { x: number; y: number; w: number; h: number }): Image {
  const out = newImage(rect.w, rect.h);
  for (let y = 0; y < rect.h; y++)
    for (let x = 0; x < rect.w; x++) {
      const sx = rect.x + x - cel.ox;
      const sy = rect.y + y - cel.oy;
      if (sx < 0 || sy < 0 || sx >= cel.image.width || sy >= cel.image.height) continue;
      const from = (sy * cel.image.width + sx) * 4;
      out.data.set(cel.image.data.subarray(from, from + 4), (y * rect.w + x) * 4);
    }
  return out;
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

interface Meta {
  readonly rot: Readonly<Record<string, string>>;
  readonly anims: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
}

const pngCache = new Map<string, Image>();
function png(path: string): Image {
  let found = pngCache.get(path);
  if (!found) {
    found = readPng(path);
    pngCache.set(path, found);
  }
  return found;
}

/** A figure frame: hard alpha, cleaned, centred on the 80 px basis. */
/** A placed cel flipped about the basis' anchor column: basis pixel x lands on `BASIS - 1 - x`. */
function mirrored(cel: Placed): Placed {
  const { width: w, height: h } = cel.image;
  const image = newImage(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const from = (y * w + x) * 4;
      image.data.set(cel.image.data.subarray(from, from + 4), (y * w + (w - 1 - x)) * 4);
    }
  return { image, ox: BASIS - cel.ox - w, oy: cel.oy };
}

function figureCel(folder: string, file: string): Placed {
  const raw = png(join(SOURCE, 'chars', folder, file));
  return {
    image: clean(hardAlpha(raw)),
    ox: Math.round((BASIS - raw.width) / 2),
    oy: Math.round((BASIS - raw.height) / 2),
  };
}

/** `build8.py` `calm_frames`: the frames whose head stays within 1 px of frame 0 and that barely differ from it. */
function calmFrames(folder: string, files: readonly string[]): number[] {
  const ims = files.map((f) => png(join(SOURCE, 'chars', folder, f)));
  const first = ims[0];
  if (!first) return [0];
  const top = (im: Image): number => {
    for (let y = 0; y < im.height; y++)
      for (let x = 0; x < im.width; x++) if (alphaAt(im, x, y)) return y;
    return -1;
  };
  const t0 = top(first);
  const keep: number[] = [];
  ims.forEach((im, i) => {
    if (Math.abs(top(im) - t0) > 1) return;
    let differ = 0;
    for (let p = 0; p < im.data.length; p += 4) {
      const d = (c: number) => Math.abs((im.data[p + c] ?? 0) - (first.data[p + c] ?? 0));
      if (d(0) + d(1) + d(2) > 60 || d(3) > 100) differ++;
    }
    if (differ <= 140) keep.push(i);
  });
  return keep.length >= 2 ? keep : [0, 1];
}

/** The row under the lowest opaque pixel of a placed cel. */
const groundOf = (cel: Placed): number => inkBox(cel)?.y1 ?? -1;

function mode(values: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  // Python's Counter.most_common keeps first-seen order on ties.
  let best = values[0] ?? 0;
  for (const [v, n] of counts) if (n > (counts.get(best) ?? 0)) best = v;
  return best;
}

/* ------------------------------------------------------------------ */
/* Timing                                                              */
/* ------------------------------------------------------------------ */

/** `units.js` `ATK`: 62 ms a wind-up cel, 84 on the strike, 46 a recovery cel; the strike at 55%. */
function blowTiming(n: number): { frameMs: number[]; hit: number } {
  const s = Math.round(n * 0.55);
  return { frameMs: Array.from({ length: n }, (_, i) => (i < s ? 62 : i === s ? 84 : 46)), hit: s };
}

/**
 * `fx.js` `MOVES`: Kaya's bends, 70 ms a cel and 150 on the strike (the jab its own list), then the
 * pacing pass: the wind-up 18% and the follow-through 28% quicker, the strike untouched.
 */
function bendTiming(pose: string, n: number, strike: number): { frameMs: number[]; hit: number } {
  const jab = [70, 70, 70, 80, 50, 140, 90, 70, 70, 70, 80];
  const base = Array.from({ length: n }, (_, i) =>
    pose === 'jab' ? (jab[i] ?? 70) : i === strike ? 150 : 70,
  );
  return {
    frameMs: base.map((v, i) => Math.round(i === strike ? v : v * (i < strike ? 0.82 : 0.72))),
    hit: strike,
  };
}

/** The hit reaction: a quick flinch and back to guard. */
const HIT_MS = [60, 80, 90, 80, 70, 60];
/**
 * The knockout: the fall gathers pace, then the body lies still on its last cel. PixelLab drew eight; the eighth
 * drifts (a different pose, a smear or a sit-up in most headings), so the seventh, the body flat, is the one held.
 */
const KO_MS = [70, 80, 90, 100, 110, 140, 300];
const KO_CELS = KO_MS.length;
const timed = (base: readonly number[], n: number): number[] =>
  Array.from({ length: n }, (_, i) => base[Math.min(i, base.length - 1)] ?? 80);

/* ------------------------------------------------------------------ */
/* Packing                                                             */
/* ------------------------------------------------------------------ */

interface ClipOut {
  frames: string[];
  fps: number;
  loop: boolean;
  frameMs?: number[];
  events?: { hit: number };
  frameSize?: { w: number; h: number };
  anchor?: { x: number; y: number };
  hand?: { x: number; y: number };
}

/** What the manifest's builder reads for one sheet (`topdownSheets.ts`). */
export interface SheetData {
  readonly pages: number;
  readonly frame: { readonly w: number; readonly h: number };
  readonly anchor: { readonly x: number; readonly y: number };
  readonly footprint: 1 | 2;
  /** Distinct idle cels per heading (`HEADINGS` order); the clip plays them there and back. */
  readonly idleCels: readonly number[];
  readonly idleMs: number;
  /** Walk cels per heading (0: no walk drawn, the idle's first cel is held). */
  readonly walkCels: readonly number[];
  readonly walkCelMs: number;
  readonly walkMsPerTile: number;
  readonly cast: ClipOut | null;
  readonly clipData: boolean;
  readonly actions: boolean;
  /** Driller tread geometry measured from alpha>=128 in the bottom 16 ink rows of each static heading. */
  readonly treadGrounding?: readonly {
    readonly spanPx: number;
    readonly centerXFromAnchorPx: number;
    readonly baselineYFromAnchorPx: number;
  }[];
}

interface Sheet {
  readonly name: string;
  readonly key: string;
  readonly cels: Item[];
  readonly data: SheetData;
  readonly clips: Record<string, ClipOut>;
  readonly actions: Record<string, Record<string, ClipOut>>;
}

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** A trimmed clip: its cels cut to their ink round the anchor point, plus a 1 px margin. */
function trimmed(
  cels: readonly Placed[],
  anchor: { x: number; y: number },
): { images: Image[]; frameSize: { w: number; h: number }; anchor: { x: number; y: number } } {
  const box = union([
    ...cels.map(inkBox),
    { x0: anchor.x, y0: anchor.y - 1, x1: anchor.x + 1, y1: anchor.y },
  ]);
  const rect = { x: box.x0 - 1, y: box.y0 - 1, w: box.x1 - box.x0 + 2, h: box.y1 - box.y0 + 2 };
  return {
    images: cels.map((c) => cut(c, rect)),
    frameSize: { w: rect.w, h: rect.h },
    anchor: { x: (anchor.x - rect.x) / rect.w, y: (anchor.y - rect.y) / rect.h },
  };
}

function figureSheet(spec: FigureSpec): Sheet {
  const meta = JSON.parse(
    readFileSync(join(SOURCE, 'chars', spec.folder, 'meta.json'), 'utf8'),
  ) as Meta;
  const anim = (id: string): Readonly<Record<string, readonly string[]>> => {
    const found = meta.anims[id];
    if (!found) throw new Error(`${spec.folder}: no animation ${id}`);
    return found;
  };
  const load = (files: readonly string[]) => files.map((f) => figureCel(spec.folder, f));
  const idle = anim(spec.idle);
  const walk = spec.walk ? anim(spec.walk) : undefined;

  // Idle: the calm cels per heading, or PixelLab's own rotation where the idle has no such heading.
  const idleCels = {} as Record<Heading, Placed[]>;
  for (const h of HEADINGS) {
    const files = idle[DIR[h]];
    if (files)
      idleCels[h] = load(
        calmFrames(spec.folder, files)
          .slice(0, IDLE_CELS)
          .map((i) => files[i] ?? ''),
      );
    else {
      const rot = meta.rot[DIR[h]];
      if (!rot) throw new Error(`${spec.folder}: no ${DIR[h]} idle or rotation`);
      idleCels[h] = load([rot]);
    }
  }
  const walkCels = {} as Record<Heading, Placed[]>;
  for (const h of HEADINGS) {
    const files = walk?.[DIR[h]];
    if (walk && !files) throw new Error(`${spec.folder}: walk has no ${DIR[h]}`);
    walkCels[h] = files ? load(files) : [];
  }
  const ground = mode(HEADINGS.flatMap((h) => idleCels[h].map(groundOf)));
  const anchorPoint = { x: COLUMN, y: ground };

  // The sheet frame: idle, walk and rest round the anchor, symmetric about its column.
  const loco = union(HEADINGS.flatMap((h) => [...idleCels[h], ...walkCels[h]].map(inkBox)));
  const half = Math.max(COLUMN - loco.x0, loco.x1 - COLUMN) + 1;
  const top = loco.y0 - 1;
  const bottom = Math.max(loco.y1, ground) + 1;
  const frameRect = { x: COLUMN - half, y: top, w: half * 2, h: bottom - top };
  const anchor = { x: 0.5, y: (ground - top) / frameRect.h };

  const items: Item[] = [];
  const add = (clip: string, i: number, image: Image) =>
    items.push({ name: `${spec.key}/${clip}/${i}`, image });
  for (const h of HEADINGS) {
    idleCels[h].forEach((c, i) => add(sided('idle', h, true), i, cut(c, frameRect)));
    add(sided('rest', h, true), 0, cut(idleCels[h][0] as Placed, frameRect));
    walkCels[h].forEach((c, i) => add(sided('walk', h, true), i, cut(c, frameRect)));
    if (!walk) add(sided('walk', h, true), 0, cut(idleCels[h][0] as Placed, frameRect));
  }

  const clips: Record<string, ClipOut> = {};
  const actions: Record<string, Record<string, ClipOut>> = {};
  const trimClip = (
    clip: string,
    cels: readonly Placed[],
    frameMs: number[],
    extra: Partial<ClipOut> = {},
    aim?: Heading,
  ): ClipOut => {
    const t = trimmed(cels, anchorPoint);
    t.images.forEach((im, i) => add(clip, i, im));
    const first = t.images[0];
    const hit = t.images[extra.events?.hit ?? -1];
    return {
      frames: t.images.map((_, i) => `${spec.key}/${clip}/${i}`),
      fps: 10,
      loop: false,
      frameMs,
      ...extra,
      frameSize: t.frameSize,
      anchor: { x: round6(t.anchor.x), y: round6(t.anchor.y) },
      ...(aim && first && hit && { hand: strikeHand(first, hit, t.anchor, aim) }),
    };
  };
  if (spec.hit) {
    const hit = anim(spec.hit);
    for (const h of HEADINGS) {
      const cels = load(hit[DIR[h]] ?? []);
      clips[sided('hit', h, false)] = trimClip(
        sided('hit', h, false),
        cels,
        timed(HIT_MS, cels.length),
      );
    }
  }
  if (spec.ko) {
    const ko = anim(spec.ko);
    actions.ko = {};
    for (const h of HEADINGS) {
      const cels = load((ko[DIR[h]] ?? []).slice(0, spec.koCels?.[h] ?? KO_CELS));
      const clip = sided('ko', h, false);
      // A shortened knockout still lies still on its last cel for the full hold.
      const ms = timed(KO_MS, cels.length).map((v, i, all) =>
        i === all.length - 1 ? (KO_MS[KO_MS.length - 1] ?? v) : v,
      );
      const def = trimClip(clip, cels, ms);
      actions.ko[h] = def;
      if (DIAGONALS.includes(h)) clips[clip] = def;
    }
    // The legacy one-cel KO a fall without a heading asks for: the south-east knockout's last cel.
    const se = load((ko[DIR.southEast] ?? []).slice(0, KO_CELS));
    const last = se[se.length - 1];
    if (last) clips.ko = trimClip('ko', [last], [1000]);
  }
  for (const [pose, { anim: id, frames, mirror }] of Object.entries(spec.actions)) {
    const a = anim(id);
    /** A heading's cels: its own, or (`mirror`) another heading's flipped. */
    const celsOf = (h: Heading): Placed[] => {
      const from = mirror?.[h];
      const own = load((a[DIR[from ?? h]] ?? []).slice(0, frames));
      return from ? own.map(mirrored) : own;
    };
    actions[pose] = {};
    // One shared 3D motion per move, so the strike is measured once (`moves4.py`, `build_b3.py`).
    const reach = (h: Heading, pick: (b: Box) => number) => {
      const cels = celsOf(h);
      let best = 0;
      cels.forEach((c, i) => {
        const b = inkBox(c);
        const bb = b && pick(b);
        const cur = cels[best] && inkBox(cels[best] as Placed);
        if (bb !== null && bb !== undefined && (!cur || bb > pick(cur))) best = i;
      });
      return best;
    };
    let strike: number | undefined;
    if (spec.timing === 'bend')
      strike =
        pose === 'whip'
          ? reach('south', (b) => b.x1 - b.x0)
          : pose === 'stomp'
            ? reach('south', (b) => b.y0)
            : reach('east', (b) => b.x1);
    for (const h of HEADINGS) {
      const cels = celsOf(h);
      const t =
        spec.timing === 'bend'
          ? bendTiming(pose, cels.length, strike ?? 0)
          : blowTiming(cels.length);
      actions[pose][h] = trimClip(
        `${pose}${sided('', h, false)}`,
        cels,
        t.frameMs,
        { events: { hit: t.hit } },
        h,
      );
    }
  }
  let cast: ClipOut | null = null;
  if (spec.cast) {
    const source = actions[spec.cast]?.east;
    if (!source) throw new Error(`${spec.name}: no east ${spec.cast} to cast`);
    // The legacy mirrored cast: the east heading of the pose, as its own cels.
    const a = anim(spec.actions[spec.cast]?.anim ?? '');
    const cels = load((a[DIR.east] ?? []).slice(0, spec.actions[spec.cast]?.frames));
    cast = trimClip('cast', cels, source.frameMs ?? [], { events: source.events ?? { hit: 0 } });
  }
  const celMs =
    Math.round((spec.stride / Math.max(1, walkCels.east.length) / WALK_PX_PER_S) * 1000 * 1000) /
    1000;
  return {
    name: spec.name,
    key: spec.key,
    cels: items,
    clips,
    actions,
    data: {
      pages: 1,
      frame: { w: frameRect.w, h: frameRect.h },
      anchor: { x: 0.5, y: round6(anchor.y) },
      footprint: 1,
      idleCels: HEADINGS.map((h) => idleCels[h].length),
      idleMs: IDLE_CEL_MS,
      walkCels: HEADINGS.map((h) => walkCels[h].length),
      walkCelMs: walk ? celMs : 1000,
      walkMsPerTile: Math.round((PIXELS_PER_TILE / WALK_PX_PER_S) * 1000 * 10) / 10,
      cast,
      clipData: Object.keys(clips).length > 0,
      actions: Object.keys(actions).length > 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/* The Driller                                                          */
/* ------------------------------------------------------------------ */

/** Each heading's slam: its file prefix, the frame the blow lands on and the held top frames (`build_b3.py` `SLAM`). */
const SLAM: Readonly<Record<Heading, readonly [string, number, readonly [number, number]]>> = {
  south: ['the_whole_mecha-driller_winds', 8, [6, 7]],
  southEast: ['the_whole_mecha-driller_winds', 9, [7, 8]],
  east: ['the_whole_mecha-driller_winds', 10, [6, 7]],
  northEast: ['the_whole_mecha-driller_winds', 8, [6, 7]],
  north: ['the_whole_mecha-driller_winds', 8, [6, 7]],
  northWest: ['the_whole_mecha-driller_winds', 7, [5, 6]],
  west: ['the_whole_mecha-driller_winds', 8, [6, 7]],
  southWest: ['the_mecha-driller_rears', 10, [8, 9]],
};
/** `build_b3.py` `slam_ms` with the pacing pass (`units.js` `SLAM_K`): wind-up and recovery 20% shorter, the landing frame untouched. */
function slamMs(n: number, hit: number, hold: readonly [number, number]): number[] {
  return Array.from({ length: n }, (_, i) => {
    const v =
      i < 3 ? 90 : hold.includes(i) ? 230 : i < hold[0] ? 110 : i === hit ? 170 : i < hit ? 70 : 90;
    return i === hit ? v : Math.round(v * 0.8);
  });
}

/** Ground one tread loop covers: two tiles, so the eight tread cels turn over at a readable ~77 ms at 130 px/s. */
const DRILLER_TREAD_PX = 80;
/** The hit shudder's and the jammed knockout's cel times. */
const DRILLER_HIT_MS = 70;
const DRILLER_KO_MS = 110;
const KO_PICK = [1, 2, 3, 4, 5, 6, 8, 10] as const;

function drillerSheet(): Sheet {
  const key = 'unit.enemy.driller';
  const dir = join(SOURCE, 'driller');
  const files = readdirSync(dir).sort();
  const hard = (path: string): Image => hardAlpha(png(path));
  // Each heading's view (`objects13/driller_<dir>`, cropped from PixelLab's 128 px rotation) at its place on that canvas.
  const views = {} as Record<Heading, Placed>;
  const anchors = {} as Record<Heading, { x: number; y: number }>;
  const treadGrounding = {} as Record<
    Heading,
    {
      spanPx: number;
      centerXFromAnchorPx: number;
      baselineYFromAnchorPx: number;
    }
  >;
  for (const h of HEADINGS) {
    const rot = hard(join(dir, `rotations__${DIR[h]}.png`));
    const box = inkBox({ image: rot, ox: 0, oy: 0 });
    if (!box) throw new Error(`driller: empty ${h} rotation`);
    const view = hard(join(SOURCE, 'objects13', `driller_${DIR[h].replace('-', '')}.png`));
    if (view.width !== box.x1 - box.x0 || view.height !== box.y1 - box.y0)
      throw new Error(`driller: the ${h} view is not its rotation's crop`);
    views[h] = { image: view, ox: box.x0, oy: box.y0 };
    // It stands on its base, centred under its ink.
    anchors[h] = { x: Math.round((box.x0 + box.x1) / 2), y: box.y1 };
    // The static object view is the source of truth for a grounded footprint.
    // Inspect only its bottom 16 ink rows, which retain both treads in diagonal views
    // without including upper body and weapon rows in the measured span.
    const viewBox = inkBox({ image: view, ox: 0, oy: 0 });
    if (!viewBox) throw new Error(`driller: empty ${h} static view`);
    const lowest = viewBox.y1 - 1;
    const bandTop = Math.max(viewBox.y0, lowest - 15);
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    for (let y = bandTop; y <= lowest; y++) {
      for (let x = viewBox.x0; x < viewBox.x1; x++) {
        if ((view.data[(y * view.width + x) * 4 + 3] ?? 0) < 128) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX))
      throw new Error(`driller: empty ${h} tread band`);
    treadGrounding[h] = {
      spanPx: maxX - minX + 1,
      centerXFromAnchorPx: round6((minX + maxX + 1) / 2 + box.x0 - anchors[h].x),
      baselineYFromAnchorPx: lowest + 1 + box.y0 - anchors[h].y,
    };
  }
  // T5's object clips (`prototypes/topdown/tools/t5clips.py`), one folder a clip, `<direction>_<i>.png` on the
  // rotations' own 128 px canvas. Frame 0 of each is the heading's rotation itself, the motion starts at 1.
  const t5 = (clip: string, h: Heading): Placed[] => {
    const cels: Placed[] = [];
    for (let i = 0; ; i++) {
      const path = join(dir, 't5', clip, `${DIR[h]}_${i}.png`);
      if (!existsSync(path)) break;
      cels.push({ image: hard(path), ox: 0, oy: 0 });
    }
    if (cels.length === 0) throw new Error(`driller: no ${h} ${clip}`);
    return cels;
  };
  // The tread loop is the walk: its eight drawn cels after the rotation, sharing the idle's frame and anchor.
  const treads = {} as Record<Heading, Placed[]>;
  for (const h of HEADINGS) treads[h] = t5('tread', h).slice(1);
  // A 2x2 sheet's frame is square: every view and tread cel round its own anchor, plus a 1 px margin.
  let half = 0;
  let up = 0;
  for (const h of HEADINGS) {
    for (const b of [views[h], ...treads[h]].map(inkBox)) {
      if (!b) continue;
      half = Math.max(half, anchors[h].x - b.x0, b.x1 - anchors[h].x);
      up = Math.max(up, anchors[h].y - b.y0);
    }
  }
  const side = Math.max(2 * (half + 1), up + 2);
  const items: Item[] = [];
  const add = (clip: string, i: number, image: Image) =>
    items.push({ name: `${key}/${clip}/${i}`, image });
  for (const h of HEADINGS) {
    const rect = { x: anchors[h].x - side / 2, y: anchors[h].y - (side - 1), w: side, h: side };
    const cel = cut(views[h], rect);
    add(sided('idle', h, true), 0, cel);
    add(sided('rest', h, true), 0, cel);
    treads[h].forEach((c, i) => add(sided('walk', h, true), i, cut(c, rect)));
  }
  const slam: Record<string, ClipOut> = {};
  const rumbles: Record<string, ClipOut> = {};
  const kos: Record<string, ClipOut> = {};
  const actions = { slam, rumble: rumbles, ko: kos };
  const clips: Record<string, ClipOut> = {};
  const trimClip = (
    clip: string,
    cels: Placed[],
    anchor: { x: number; y: number },
    extra: Partial<ClipOut>,
  ): ClipOut => {
    const t = trimmed(cels, anchor);
    t.images.forEach((im, i) => add(clip, i, im));
    return {
      frames: t.images.map((_, i) => `${key}/${clip}/${i}`),
      fps: 10,
      loop: false,
      ...extra,
      frameSize: t.frameSize,
      anchor: { x: round6(t.anchor.x), y: round6(t.anchor.y) },
    };
  };
  const frames = (prefix: string, h: Heading): Placed[] =>
    files
      .filter((f) => f.startsWith(`animations__${prefix}`) && f.includes(`__${DIR[h]}__frame_`))
      .map((f) => ({ image: hard(join(dir, f)), ox: 0, oy: 0 }));
  let cast: ClipOut | null = null;
  for (const h of HEADINGS) {
    const [prefix, hit, hold] = SLAM[h];
    const cels = frames(prefix, h);
    if (cels.length === 0) throw new Error(`driller: no ${h} slam`);
    const ms = slamMs(cels.length, hit, hold);
    slam[h] = trimClip(`slam${sided('', h, false)}`, cels, anchors[h], {
      frameMs: ms,
      events: { hit },
    });
    if (h === 'east') {
      // The legacy mirrored cast holds 12 cels at most: the east slam without its last recovery cel.
      cast = trimClip('cast', cels.slice(0, 12), anchors[h], {
        frameMs: ms.slice(0, 12),
        events: { hit },
      });
    }
    // The engine's rumble in all eight headings: the prototype's three (west, south-west, north-west) and T5's five
    // in the same PixelLab animation group, at the prototype's 110 ms a cel.
    const rumble = t5('rumble', h);
    rumbles[h] = trimClip(`rumble${sided('', h, false)}`, rumble, anchors[h], {
      frameMs: rumble.map(() => 110),
      loop: true,
    });
    // The hit shudder: its eight drawn cels after the rotation (a clip holds eight at most), quick.
    const shudder = t5('hit', h).slice(1);
    clips[sided('hit', h, false)] = trimClip(sided('hit', h, false), shudder, anchors[h], {
      frameMs: shudder.map(() => DRILLER_HIT_MS),
    });
    // The jammed knockout: the arm sags and the machine settles, its last cel held as the wreck. Ten drawn cels
    // after the rotation; the settle keeps every other one, so the clip holds eight.
    const ko = KO_PICK.map((i) => t5('ko', h)[i] as Placed);
    const koClip = sided('ko', h, false);
    kos[h] = trimClip(koClip, ko, anchors[h], {
      frameMs: ko.map((_, i) => (i === ko.length - 1 ? 1000 : DRILLER_KO_MS)),
    });
    if (DIAGONALS.includes(h)) clips[koClip] = kos[h];
  }
  // The legacy one-cel KO a fall without a heading asks for: the south-east wreck, as the figures do.
  const wreck = KO_PICK.map((i) => t5('ko', 'southEast')[i] as Placed);
  clips.ko = trimClip('ko', wreck.slice(-1), anchors.southEast, { frameMs: [1000] });
  return {
    name: 'driller',
    key,
    cels: items,
    clips,
    actions,
    data: {
      pages: 1,
      frame: { w: side, h: side },
      anchor: { x: 0.5, y: round6((side - 1) / side) },
      footprint: 2,
      idleCels: HEADINGS.map(() => 1),
      idleMs: 1000,
      walkCels: HEADINGS.map((h) => treads[h].length),
      walkCelMs:
        Math.round((DRILLER_TREAD_PX / treads.east.length / WALK_PX_PER_S) * 1000 * 1000) / 1000,
      walkMsPerTile: Math.round((PIXELS_PER_TILE / WALK_PX_PER_S) * 1000 * 10) / 10,
      cast,
      clipData: true,
      actions: true,
      treadGrounding: HEADINGS.map((h) => treadGrounding[h]),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Output                                                              */
/* ------------------------------------------------------------------ */

const MAX_PAGE = 2048;
const GUTTER = 1;

/** Lossless, every pixel exact (clear pixels keep their zero RGB), the encoder's slowest, smallest search. */
const lossless = (image: Image): Promise<Uint8Array> => encodeWebpLossless(image, 6);

/** Pages no wider than they are tall where it fits, cels tallest first, split at 2048 px. */
function pages(
  items: readonly Item[],
): { placed: ReturnType<typeof shelfPack>['placed']; width: number; height: number }[] {
  for (let width = 256; width <= MAX_PAGE; width += 64) {
    const packed = shelfPack(items, width, GUTTER);
    if (packed.height <= width) return [{ placed: packed.placed, width, height: packed.height }];
  }
  // Too many for one square page: fill 2048 px pages in the same order.
  const order = [...items].sort(
    (a, b) => b.image.height - a.image.height || a.name.localeCompare(b.name),
  );
  const out: { placed: ReturnType<typeof shelfPack>['placed']; width: number; height: number }[] =
    [];
  let rest = order;
  while (rest.length) {
    let n = rest.length;
    while (shelfPack(rest.slice(0, n), MAX_PAGE, GUTTER, false).height > MAX_PAGE)
      n = Math.floor(n * 0.9);
    while (
      n < rest.length &&
      shelfPack(rest.slice(0, n + 1), MAX_PAGE, GUTTER, false).height <= MAX_PAGE
    )
      n++;
    const packed = shelfPack(rest.slice(0, n), MAX_PAGE, GUTTER, false);
    out.push({ placed: packed.placed, width: MAX_PAGE, height: packed.height });
    rest = rest.slice(n);
  }
  return out;
}

const json = (value: unknown): string => `${JSON.stringify(value)}\n`;

export async function packTopdownSheets(): Promise<Map<string, Uint8Array | string>> {
  const files = new Map<string, Uint8Array | string>();
  const sheets = [...ROSTER.map(figureSheet), drillerSheet()];
  const data: Record<string, SheetData> = {};
  for (const sheet of sheets) {
    const laid = pages(sheet.cels);
    for (const [i, page] of laid.entries()) {
      const base = i === 0 ? sheet.name : `${sheet.name}-${i + 1}`;
      const image = composeAtlas(sheet.cels, page.placed, page.width, page.height, GUTTER);
      files.set(`${OUT}/${base}.webp`, await lossless(image));
      const frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
      for (const p of [...page.placed].sort((a, b) => a.name.localeCompare(b.name)))
        frames[p.name] = { frame: { x: p.x, y: p.y, w: p.width, h: p.height } };
      files.set(
        `${OUT}/${base}.json`,
        json({ frames, meta: { image: `${base}.webp`, size: { w: page.width, h: page.height } } }),
      );
    }
    if (sheet.data.clipData) files.set(`${OUT}/${sheet.name}-clips.json`, json(sheet.clips));
    if (sheet.data.actions) files.set(`${OUT}/${sheet.name}-actions.json`, json(sheet.actions));
    data[sheet.name] = { ...sheet.data, pages: laid.length };
  }
  // T3: the Ba Dan objects, trimmed hard-alpha PNGs the scene loads by name (`prototypes/topdown/tools/t3objproc.py`).
  for (const name of OBJECTS) {
    const bytes = readFileSync(join(SOURCE, 'objects_t3', `${name}.png`));
    files.set(`${OBJECTS_OUT}/${name}.png`, new Uint8Array(bytes));
    // A one-image atlas (every cel the image), so the object stands on its cell as a figure does
    // (`topdownObject` in the manifest).
    const w = bytes.readUInt32BE(16),
      h = bytes.readUInt32BE(20);
    files.set(
      `${OBJECTS_OUT}/${name}.json`,
      json({
        frames: Object.fromEntries(
          ['idle/0', 'idle/1', 'cast/0', 'cast/1', 'cast/2'].map((cel) => [
            `world.${name}/${cel}`,
            { frame: { x: 0, y: 0, w, h } },
          ]),
        ),
        meta: { image: `${name}.png`, size: { w, h } },
      }),
    );
  }
  files.set(DATA, await dataModule(data));
  return files;
}

export async function dataModule(data: Record<string, SheetData>): Promise<string> {
  const names = Object.keys(data);
  let compact = JSON.stringify(data);
  for (const sheet of Object.values(data)) {
    const frames = sheet.cast?.frames;
    if (!frames?.length) continue;
    const prefix = frames[0]?.replace(/\/0$/, '');
    if (!prefix || !frames.every((frame, index) => frame === `${prefix}/${index}`)) continue;
    const original = `"frames":${JSON.stringify(frames)}`;
    if (!compact.includes(original)) throw new Error(`Missing cast frames for ${prefix}`);
    compact = compact.replace(
      original,
      `"frames":castFrames(${JSON.stringify(prefix)},${frames.length})`,
    );
  }
  const text = [
    '/**',
    ' * Generated by `scripts/art/topdown/pack-sheets.ts`; do not edit by hand.',
    ' *',
    " * The top-down figure sheets (ADR 0104 T2): each sheet's pages, its locomotion frame and foot anchor",
    ' * (idle, walk and rest share it), the idle and walk cels per heading (`HEADINGS` order), the walk timing',
    " * and the legacy cast. The hits and knockouts are in each sheet's clip file, the per-heading abilities in",
    ' * its actions file, both beside its atlas under `public/art/topdown/`.',
    ' */',
    "import type { ClipDef } from './clips';",
    '',
    'const castFrames = (prefix: string, count: number): string[] =>',
    '  Array.from({ length: count }, (_, index) => `${prefix}/${index}`);',
    '',
    `export type TopdownName = ${names.map((n) => `'${n}'`).join(' | ')};`,
    '',
    'export interface TopdownSheetData {',
    '  readonly pages: number;',
    '  readonly frame: { readonly w: number; readonly h: number };',
    '  readonly anchor: { readonly x: number; readonly y: number };',
    '  readonly footprint: 1 | 2;',
    '  readonly idleCels: readonly number[];',
    '  readonly idleMs: number;',
    '  readonly walkCels: readonly number[];',
    '  readonly walkCelMs: number;',
    '  readonly walkMsPerTile: number;',
    '  readonly cast: ClipDef | null;',
    '  readonly clipData: boolean;',
    '  readonly actions: boolean;',
    '  readonly treadGrounding?: readonly { readonly spanPx: number; readonly centerXFromAnchorPx: number; readonly baselineYFromAnchorPx: number }[];',
    '}',
    '',
    `export const TOPDOWN_SHEETS: Readonly<Record<TopdownName, TopdownSheetData>> = ${compact};`,
    '',
  ].join('\n');
  // Formatted as `format:check` wants it, so the shipped file is the packer's output byte for byte.
  return format(text, { ...(await resolveConfig(DATA)), filepath: DATA });
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const files = await packTopdownSheets();
  let stale = 0;
  if (!check) mkdirSync(OBJECTS_OUT, { recursive: true });
  for (const [path, content] of files) {
    const bytes = typeof content === 'string' ? Buffer.from(content) : Buffer.from(content);
    const same = existsSync(path) && Buffer.compare(readFileSync(path), bytes) === 0;
    if (same) continue;
    stale++;
    if (check) console.error(`stale: ${path}`);
    else writeFileSync(path, bytes);
  }
  const shipped = shippedFiles();
  // Keep the figure packer's ownership strict: only the VFX packer's two
  // explicit outputs may share this directory. Every other foreign file fails.
  const extra = shipped.filter(
    (p) => !files.has(p) && !VFX_OUTPUTS.includes(p as (typeof VFX_OUTPUTS)[number]),
  );
  for (const p of extra) console.error(`not packed: ${p}`);
  const total = [...files]
    .filter(([p]) => p.startsWith(OUT))
    .reduce((sum, [, c]) => sum + (typeof c === 'string' ? Buffer.byteLength(c) : c.length), 0);
  console.log(
    `${files.size} files, ${total} bytes under ${OUT}${check ? `, ${stale} stale` : `, ${stale} written`}`,
  );
  if (check && (stale > 0 || extra.length > 0)) process.exit(1);
}

if (process.argv[1]?.endsWith('pack-sheets.ts')) await main();
