/**
 * The art swap point.
 *
 * Nothing in the game references a drawing directly — units, portraits, NPCs
 * and ability effects all carry an asset *key*, and this file decides what that
 * key resolves to.
 *
 * Keys can resolve to a code-drawn painter: a named vector routine in
 * `src/render/painters/` tinted from a nation palette. To drop in commissioned
 * or generated art later, change the entry:
 *
 *   'unit.fire.kaya': { kind: 'painter', painter: 'bender', palette: 'fire' }
 *   'unit.fire.kaya': { kind: 'image', url: 'art/kaya.png', palette: 'fire' }
 *
 * ...and nothing else in the codebase changes. That is the whole contract.
 *
 * Portraits are the first real art (docs/art-bible.md): a 512x512 bust on
 * parchment dropped into `public/art/portraits/<name>.png` and pointed at here:
 *
 *   'portrait.kaya': { kind: 'image', url: 'art/portraits/kaya.png', palette: 'fire' }
 *
 * Keep the `palette` on an image entry. It is how the dialogue backdrop knows
 * which element to tint for the speaker, and how HUD chrome matches the art.
 *
 * A unit's animated art is a `sheet` (ADR 0003): a TexturePacker-style atlas
 * of key poses, one clip per event kind, drawn facing screen-right and
 * mirrored for the other side. Until a key has a sheet, the sheet runtime
 * bakes the painter's poses into one of the same shape, so both backends and
 * the clip logic run the same path whether the art is real or not.
 */

import type {
  ClipDef,
  ClipName,
  Heading,
  HeadingClipBase,
  LocomotionDef,
  MeleeDirection,
} from './clips';
import { HEADINGS, headingClip } from './clips';
import { BANDITS_G1_TRIMS } from './banditsG1';
import { PARTY_G1_TRIMS } from './partyG1';
import { residentGrid } from './residentGrid';

export type AssetEntry =
  | {
      readonly kind: 'painter';
      /** Name of a routine registered in `src/render/painters/registry.ts`. */
      readonly painter: string;
      /** Palette key: fire | water | earth | air | nonbender | enemy | neutral. */
      readonly palette: string;
      /** Distinguishes the two characters of an element, or an enemy silhouette. */
      readonly variant?: string;
    }
  | {
      readonly kind: 'image';
      /** Relative to the site root (the `public/` folder), or an absolute URL. */
      readonly url: string;
      /** Palette key, so HUD chrome and the dialogue mood still know the element. */
      readonly palette?: string;
    }
  | {
      readonly kind: 'sheet';
      /** The atlas JSON, relative to the site root; its `meta.image` names the PNG beside it. */
      readonly atlas: string;
      /**
       * Further atlas pages, each a JSON and image like `atlas`, for a sheet
       * whose cels do not fit one 2048 px texture (ADR 0052). A frame name
       * lives on exactly one page; the sheet draws once every page is in.
       */
      readonly atlasPages?: readonly string[];
      /**
       * The character's bend set (ADR 0055): a `BendSetDef` JSON, relative to
       * the site root, whose frames live on `bendPages`. Loaded lazily, after
       * the pages above and apart from them: a bend that fails never blanks
       * the sheet.
       */
      readonly bend?: string;
      /** The atlas pages `bend` draws from, each a JSON and image like `atlas`. */
      readonly bendPages?: readonly string[];
      /**
       * Further clips, as a JSON of `ClipDef`s by clip name relative to the
       * site root, whose cels live on the pages above (the G knockouts, ADR
       * 0059). Fetched with the pages, so it costs the bundle nothing: the
       * sheet draws once it is in, and those clips are asked of the store.
       */
      readonly clipData?: string;
      /** Pixels a tile is drawn at in the atlas: 128, or 256 for a sharper sheet. */
      readonly pixelsPerTile: number;
      /** Explicit art bounds when weapon reach exceeds the default frame (ADR 0032). */
      readonly frameSize?: { readonly w: number; readonly h: number };
      /** Tiles the unit stands on: 1x1, or 2x2 for the square boss. */
      readonly footprint: { readonly w: number; readonly h: number };
      /** The point of the frame that stands on the tile's foot line, as fractions of the frame. */
      readonly anchor: { readonly x: number; readonly y: number };
      /** UI-only headroom cap, in tiles, for sheets whose transient FX rise above the body. */
      readonly uiHeadroomCap?: number;
      /** `mirror`: drawn facing screen-right and flipped for the other side. */
      readonly facing: 'mirror' | 'both';
      /** Eight-way locomotion, when the sheet authors it; absent is the four-way contract. */
      readonly locomotion?: LocomotionDef;
      readonly clips: Partial<Record<ClipName, ClipDef>>;
      /** Optional screen-up/down contact frames for a melee clip. */
      readonly meleeDirections?: Partial<Record<MeleeDirection, readonly [string, string]>>;
      /** Palette key, for the HUD chrome and for the placeholder drawn while the atlas loads. */
      readonly palette: string;
    };

export type SheetEntry = Extract<AssetEntry, { kind: 'sheet' }>;

const painter = (painterName: string, palette: string, variant?: string): AssetEntry =>
  variant
    ? { kind: 'painter', painter: painterName, palette, variant }
    : { kind: 'painter', painter: painterName, palette };

const image = (url: string, palette?: string): AssetEntry =>
  palette ? { kind: 'image', url, palette } : { kind: 'image', url };

/** Original combat poses plus idle and walking cels in every direction. */
const heroSheet = (key: string, palette: string): SheetEntry => {
  const name = key.slice(key.lastIndexOf('.') + 1);
  const frames = (clip: ClipName, count: number): string[] =>
    Array.from({ length: count }, (_, index) => `${key}/${clip}/${index}`);
  return {
    kind: 'sheet',
    atlas: `art/units/walking-${name}.json`,
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette,
    clips: {
      idle: { frames: frames('idle', 2), fps: 1, loop: true },
      walk: { frames: frames('walk', 4), fps: 4, loop: true },
      cast: { frames: frames('cast', 3), fps: 8, loop: false },
      ko: { frames: frames('ko', 1), fps: 1, loop: false },
      idleNorth: { frames: frames('idleNorth', 1), fps: 1, loop: true },
      idleSouth: { frames: frames('idleSouth', 1), fps: 1, loop: true },
      walkNorth: { frames: frames('walkNorth', 4), fps: 4, loop: true },
      walkSouth: { frames: frames('walkSouth', 4), fps: 4, loop: true },
      ...(['nima', 'wen'].includes(name)
        ? {
            rest: { frames: frames('rest', 1), fps: 1, loop: true },
            restNorth: { frames: frames('restNorth', 1), fps: 1, loop: true },
            restSouth: { frames: frames('restSouth', 1), fps: 1, loop: true },
          }
        : {}),
    },
  };
};

function rikoSheet(): SheetEntry {
  const key = 'unit.non.riko';
  const base = heroSheet(key, 'nonbender');
  return {
    ...base,
    clips: {
      ...base.clips,
      // The legacy side-facing melee still uses the cast pixels, but the
      // metadata aliases keep the clip contract self-describing. Directional
      // contact variants select their own authored cells below.
      melee: { frames: [`${key}/melee/0`, `${key}/melee/1`], fps: 8, loop: false },
    },
    meleeDirections: {
      screenUp: [`${key}/cast/0`, `${key}/meleeNorth/0`],
      screenDown: [`${key}/cast/0`, `${key}/meleeSouth/0`],
    },
  };
}

/** One complete authored G walk loop covers this many logical ground tiles. */
export const G_STRIDE_TILES = 1.825;

/** The jog (ADR 0095): one loop of ten cels at 60 ms a cel. Its cels ship; no move plays them for now. */
const JOG_CELS = 10;
const JOG_CEL_MS = 60;

/**
 * Tiles one walk loop covers as drawn, by name and heading (`HEADINGS` order),
 * at one art px a world px: `walk_stride.py`'s fit, so the walk's clip time a
 * tile holds its planted foot (the animator stretches it by the figure scale).
 * Every native-G1 figure walks (ADR 0095's amendment, owner, 2026-10-28:
 * "Walk, a bit slower") until the ~74 px redraw draws a natural-stride jog.
 */
export const G1_WALK: Readonly<Record<string, readonly number[]>> = {
  kaya: [0.45, 0.51, 0.46, 0.47, 0.43, 0.48, 0.33, 0.46],
  sura: [0.46, 0.51, 0.41, 0.48, 0.43, 0.44, 0.34, 0.43],
  bo: [0.46, 0.55, 0.46, 0.51, 0.43, 0.47, 0.37, 0.48],
  thug: [0.48, 0.58, 0.51, 0.56, 0.47, 0.53, 0.37, 0.49],
  slinger: [0.49, 0.57, 0.46, 0.58, 0.48, 0.5, 0.41, 0.51],
  bruiser: [0.52, 0.66, 0.55, 0.55, 0.5, 0.56, 0.49, 0.57],
  household: [0.44, 0.52, 0.46, 0.54, 0.43, 0.46, 0.38, 0.46],
  watch: [0.55, 0.51, 0.46, 0.59, 0.46, 0.51, 0.38, 0.47],
  mira: [0.53, 0.65, 0.53, 0.62, 0.53, 0.56, 0.44, 0.56],
  gao: [0.49, 0.58, 0.46, 0.57, 0.5, 0.51, 0.43, 0.54],
  pella: [0.37, 0.46, 0.41, 0.44, 0.37, 0.41, 0.28, 0.4],
  dorin: [0.52, 0.62, 0.56, 0.6, 0.49, 0.52, 0.43, 0.55],
};
/**
 * Names that walk everywhere at the amble (the owner, 2026-10-28: "Mira always
 * walks"): `residentMotion.ts` slows every move they make, not only errands.
 */
const G1_AMBLES = new Set(['mira']);

/**
 * A G1 sheet's eight-way idle, rest, walk and (unplayed) jog, and the
 * locomotion that walks every move at its authored 114 ms a cel, timed to the
 * ground its drawn feet cover (`G1_WALK`), from the quarter-cycle passing pose.
 */
function g1Locomotion(
  clips: Partial<Record<ClipName, ClipDef>>,
  frames: (clip: ClipName, count: number) => string[],
  name: string,
  walkCels: number,
): LocomotionDef {
  const fit = G1_WALK[name];
  const msPerTile = {} as Record<Heading, number>;
  HEADINGS.forEach((heading, i) => {
    const add = (base: HeadingClipBase, count: number, fps: number) => {
      const clip = headingClip(base, heading);
      clips[clip] = { frames: frames(clip, count), fps, loop: true };
    };
    // Without a fit (the quarry bender's 128 px G sheet) the walk keeps ADR 0067's shared stride.
    msPerTile[heading] = (walkCels * 114) / (fit?.[i] ?? G_STRIDE_TILES);
    add('idle', 4, 4);
    add('rest', 1, 1);
    if (fit) add('jog', JOG_CELS, 1000 / JOG_CEL_MS);
    add('walk', walkCels, 1000 / 114);
  });
  return {
    headings: 8,
    ...(G1_AMBLES.has(name) && { amble: true as const }),
    ...(fit && { walkCelMs: 114 }),
    walkMsPerTile: msPerTile,
    walkStartMs: (walkCels / 4) * 114,
    walkCycleMs: walkCels * 114,
    authoredBob: true,
  };
}

/**
 * The party's G sheets, on the world's native G1 grid (ADR 0089): 64 px a
 * tile, a 64x96 cel, eight-way idle, walk, rest and fighting stance, the
 * mirrored cast and KO (trimmed cels, `partyG1.ts`), and Kaya's and Sura's
 * riverside wave and tea, all on the same pages and grid.
 */
function gSheet(key: string, name: 'kaya' | 'sura' | 'bo', palette: string): SheetEntry {
  const frames = (clip: ClipName, count: number) =>
    Array.from({ length: count }, (_, i) => `${key}/${clip}/${i}`);
  // The approved guard loop plays eight cels at 150 ms each (ADR 0052).
  const stance = (clip: ClipName): ClipDef => ({
    frames: frames(clip, 8),
    fps: 1000 / 150,
    loop: true,
  });
  const trims = PARTY_G1_TRIMS[name];
  const clips: Partial<Record<ClipName, ClipDef>> = {
    cast: { frames: frames('cast', 3), fps: 8, loop: false, ...trims.cast },
    ko: { frames: frames('ko', 1), fps: 1, loop: false, ...trims.ko },
  };
  const locomotion = g1Locomotion(clips, frames, name, 12);
  for (const heading of HEADINGS)
    clips[headingClip('stance', heading)] = stance(headingClip('stance', heading));
  // The riverside draws Kaya and Sura from this sheet too (ADR 0054): their
  // wave and seated tea, reduced onto the same grid, ride on page 1.
  if (name === 'kaya' || name === 'sura') {
    clips.wave = { frames: frames('wave', 2), fps: 4, loop: true };
    clips.tea = { frames: frames('tea', 2), fps: 0.25, loop: true };
  }
  return {
    kind: 'sheet',
    atlas: `art/units/${name}-g.json`,
    // Page 2 holds the fighting stance; locomotion and actions fill page 1;
    // page 3 the knockouts and page 4 the hits, whose clips arrive with them
    // (ADR 0059, ADR 0063).
    atlasPages: [
      `art/units/${name}-g-2.json`,
      `art/units/${name}-g-3.json`,
      `art/units/${name}-g-4.json`,
    ],
    clipData: `art/units/${name}-g-clips.json`,
    // The bend loads on its own, only when something asks for it (ADR 0055).
    bend: `art/units/${name}-bend.json`,
    bendPages: [`art/units/${name}-g-bend.json`],
    pixelsPerTile: 64,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'both',
    locomotion,
    palette,
    clips,
  };
}

type EnemyGName = 'thug' | 'slinger' | 'bruiser' | 'quarrybender';

/**
 * A PixelLab enemy on a G sheet (ADR 0059, ADR 0062): eight-way idle, walk
 * and rest at the party's scale and walk rate, and the mirrored legacy cast,
 * hit and KO, as the party's legacy actions are. The thug, the slinger and the
 * bruiser also draw their own G hits (eight headings) and knockouts (the four
 * diagonals) from two further pages and a clip file (ADR 0059, ADR 0063), as
 * the party does.
 *
 * The forest bandits (thug, slinger, bruiser) are on the world's native G1
 * grid (ADR 0091): 64 px a tile, a 64x96 cel, the thug's 80 and the
 * bruiser's 96 px wide for the club's swing; their one-cel hit and KO are trimmed cels (`banditsG1.ts`). The
 * quarry bender is still the 128 px G sheet.
 */
function enemyGSheet(name: EnemyGName, palette: string): SheetEntry {
  const key = `unit.enemy.${name}`;
  const frames = (clip: ClipName, count: number) =>
    Array.from({ length: count }, (_, i) => `${key}/${clip}/${i}`);
  const g1 = name === 'quarrybender' ? undefined : BANDITS_G1_TRIMS[name];
  const clips: Partial<Record<ClipName, ClipDef>> = {
    cast: { frames: frames('cast', 3), fps: 8, loop: false },
    hit: { frames: frames('hit', 1), fps: 1, loop: false, ...g1?.hit },
    ko: { frames: frames('ko', 1), fps: 1, loop: false, ...g1?.ko },
  };
  const locomotion = g1Locomotion(clips, frames, name, 8);
  return {
    kind: 'sheet',
    atlas: `art/units/${name}-g.json`,
    // Page 2 holds the knockouts and page 3 the hits, whose clips arrive with them.
    ...(name === 'thug' || name === 'slinger' || name === 'bruiser'
      ? {
          atlasPages: [`art/units/${name}-g-2.json`, `art/units/${name}-g-3.json`],
          clipData: `art/units/${name}-g-clips.json`,
        }
      : {}),
    pixelsPerTile: g1 ? 64 : 128,
    // The club's swing needs a wider cel than a tile (ADR 0032): 80 px for the thug, 96 for the bruiser.
    ...(name === 'thug' ? { frameSize: { w: 80, h: 96 } } : {}),
    ...(name === 'bruiser' ? { frameSize: { w: 96, h: 96 } } : {}),
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'both',
    locomotion,
    palette,
    clips,
  };
}

type ResidentGName = 'household' | 'watch' | 'mira' | 'gao' | 'pella' | 'dorin';

/**
 * A Ba Dan resident on a G sheet (issue #284, ADR 0091,
 * `scripts/art/residents-g1.ts`): PixelLab art redrawn on the world's native
 * G1 grid by the party's recipe (ADR 0089), eight-way idle, walk and rest at
 * the party's scale and walk rate, with no combat clips. The walk is eight
 * cels like the enemies', so it shares their stride timing.
 */
function residentGSheet(name: ResidentGName, key: string, palette: string): SheetEntry {
  const frames = (clip: ClipName, count: number) =>
    Array.from({ length: count }, (_, i) => `${key}/${clip}/${i}`);
  const clips: Partial<Record<ClipName, ClipDef>> = {};
  const locomotion = g1Locomotion(clips, frames, name, 8);
  // The grid the packer used (`residentGrid.ts`): 64 px a tile, a 64x96 cel,
  // which is the default cel for that grid, so no frame size is declared.
  const grid = residentGrid();
  return {
    kind: 'sheet',
    atlas: `art/units/${name}-g.json`,
    pixelsPerTile: grid.pixelsPerTile,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'both',
    locomotion,
    palette,
    clips,
  };
}

/** Compact illustrated enemy clips preserve the procedural clip rates. */
function quarryEnemySheet(name: string, palette: string): SheetEntry {
  const key = `unit.enemy.${name}`;
  const frames = (clip: ClipName, count: number) =>
    Array.from({ length: count }, (_, i) => `${key}/${clip}/${i}`);
  return {
    kind: 'sheet',
    atlas: `art/units/${name}.json`,
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette,
    clips: {
      idle: { frames: frames('idle', 2), fps: 1, loop: true },
      walk: { frames: frames('walk', 2), fps: 4, loop: true },
      cast: { frames: frames('cast', 3), fps: 8, loop: false },
      hit: { frames: frames('hit', 1), fps: 1, loop: false },
      ko: { frames: frames('ko', 1), fps: 1, loop: false },
    },
  };
}

/** Blade wind-up and contact reuse the authored cast cels at the existing rate. */
function cuttingSheet(name: string, palette: string): SheetEntry {
  const key = name === 'ruon' ? 'unit.ally.ruon' : `unit.enemy.${name}`;
  const base = quarryEnemySheet(name, palette);
  const frames = (clip: ClipName, count: number) =>
    Array.from({ length: count }, (_, i) => `${key}/${clip}/${i}`);
  return {
    ...base,
    frameSize:
      name === 'ruon'
        ? { w: 139, h: 192 }
        : name === 'merc'
          ? { w: 169, h: 199 }
          : { w: 147, h: 203 },
    clips: {
      idle: { frames: frames('idle', 2), fps: 1, loop: true },
      walk: { frames: frames('walk', 2), fps: 4, loop: true },
      cast: { frames: frames('cast', 3), fps: 8, loop: false },
      melee: { frames: frames('melee', 2), fps: 8, loop: false },
      hit: { frames: frames('hit', 1), fps: 1, loop: false },
      ko: { frames: frames('ko', 1), fps: 1, loop: false },
    },
  };
}

export const ASSETS: Readonly<Record<string, AssetEntry>> = {
  /* ------------------------------------------------------ Party sprites */
  'unit.fire.kaya': gSheet('unit.fire.kaya', 'kaya', 'fire'),
  'unit.fire.tenzo': heroSheet('unit.fire.tenzo', 'fire'),
  'unit.water.nilak': heroSheet('unit.water.nilak', 'water'),
  'unit.water.sura': gSheet('unit.water.sura', 'sura', 'water'),
  'unit.earth.bo': gSheet('unit.earth.bo', 'bo', 'earth'),
  'unit.earth.linmei': heroSheet('unit.earth.linmei', 'earth'),
  'unit.air.nima': heroSheet('unit.air.nima', 'air'),
  'unit.air.jinu': heroSheet('unit.air.jinu', 'air'),
  'unit.non.riko': rikoSheet(),
  'unit.non.wen': heroSheet('unit.non.wen', 'nonbender'),

  /* ----------------------------------------------------- Enemy sprites */
  'unit.enemy.thug': enemyGSheet('thug', 'enemy'),
  'unit.enemy.slinger': enemyGSheet('slinger', 'enemy'),
  'unit.enemy.bruiser': enemyGSheet('bruiser', 'enemy'),
  'unit.enemy.quarrybender': enemyGSheet('quarrybender', 'earth'),
  'unit.enemy.deserter': quarryEnemySheet('deserter', 'fire'),
  'unit.enemy.merc': cuttingSheet('merc', 'enemy'),
  'unit.enemy.crossbow': quarryEnemySheet('crossbow', 'enemy'),
  'unit.enemy.sergeant': cuttingSheet('sergeant', 'enemy'),
  'unit.enemy.driller': {
    kind: 'sheet',
    atlas: 'art/units/driller.json',
    pixelsPerTile: 80,
    frameSize: { w: 176, h: 176 },
    footprint: { w: 2, h: 2 },
    anchor: { x: 0.5, y: 0.8295454545454546 },
    // Steam and debris reach above the rig; UI stays anchored to the 2x2 body envelope.
    uiHeadroomCap: 0.85,
    facing: 'mirror',
    palette: 'enemy',
    clips: {
      idle: {
        frames: Array.from({ length: 6 }, (_, i) => `unit.enemy.driller/idle/${i}`),
        fps: 4,
        loop: true,
        frameMs: [260, 260, 280, 260, 260, 280],
      },
      walk: {
        frames: Array.from({ length: 6 }, (_, i) => `unit.enemy.driller/walk/${i}`),
        fps: 8,
        loop: true,
      },
      cast: {
        frames: Array.from({ length: 8 }, (_, i) => `unit.enemy.driller/cast/${i}`),
        fps: 9,
        loop: false,
        frameMs: [140, 140, 160, 120, 100, 120, 180, 240],
      },
      hit: {
        frames: Array.from({ length: 4 }, (_, i) => `unit.enemy.driller/hit/${i}`),
        fps: 10,
        loop: false,
        frameMs: [100, 120, 140, 180],
      },
      ko: {
        frames: Array.from({ length: 8 }, (_, i) => `unit.enemy.driller/ko/${i}`),
        fps: 8,
        loop: false,
        frameMs: [120, 120, 140, 160, 180, 220, 260, 360],
      },
    },
  },
  'unit.ally.ruon': cuttingSheet('ruon', 'neutral'),

  /* --------------------------------------------------------------- NPCs */
  // The residents' G sheets (issue #284). Dema and the shrine figure share Mira's,
  // and Sen Gao's, as they shared the old images (owner decision pending).
  'npc.elder': residentGSheet('mira', 'npc.elder', 'neutral'),
  'npc.shopkeeper': residentGSheet('gao', 'npc.shopkeeper', 'earth'),
  'world.turtle_ducks': image('art/world/turtle-ducks-nest.webp', 'earth'),
  'world.runoff_marker': image('art/world/runoff-marker.png', 'neutral'),
  'world.tea_station': image('art/props/tea-station.png', 'earth'),
  'npc.kid': residentGSheet('pella', 'npc.kid', 'air'),
  'npc.dorin': residentGSheet('dorin', 'npc.dorin', 'earth'),
  'npc.guard': residentGSheet('watch', 'npc.guard', 'earth'),
  // ADR 0047's placeholder until A1's art: Hanru, distinct from both of Dorin's
  // sprites (D7). His look is an owner decision, so he keeps the painted figure.
  'npc.hanru': painter('villager', 'nonbender', 'guard'),
  // An adult of Pella's household who is no named person; the returnees share it.
  'npc.household': residentGSheet('household', 'npc.household', 'earth'),
  // Until A1's notice art: a marker stone.
  'world.school_notice': painter('discovery', 'neutral', 'marker'),
  'world.route_sign': image('art/world/route-sign.png', 'neutral'),

  /* --------------------------------------------------------------- Props */
  'prop.barrel': image('art/props/barrel.png', 'water'),
  'prop.flask': image('art/props/flask.png', 'earth'),
  'prop.brazier': image('art/props/brazier.png', 'fire'),
  'prop.hay': image('art/props/hay.png', 'air'),
  'prop.rubble': image('art/props/rubble.png', 'earth'),
  'prop.cart': image('art/props/cart.png', 'air'),

  /* ---------------------------------------------------------- Portraits */
  'portrait.enemy.slinger': image('art/portraits/enemy.slinger.png', 'enemy'),
  'portrait.enemy.bruiser': image('art/portraits/enemy.bruiser.png', 'enemy'),
  'portrait.enemy.quarrybender': image('art/portraits/enemy.quarrybender.png', 'earth'),
  'portrait.enemy.crossbow': image('art/portraits/enemy.crossbow.png', 'enemy'),
  'portrait.enemy.thug': image('art/portraits/enemy.thug.png', 'enemy'),
  'portrait.enemy.deserter': image('art/portraits/enemy.deserter.webp', 'fire'),
  'portrait.enemy.driller': image('art/portraits/enemy.grumbler.png', 'enemy'),
  'portrait.kaya': image('art/portraits/kaya.png', 'fire'),
  'portrait.tenzo': image('art/portraits/tenzo.png', 'fire'),
  'portrait.nilak': image('art/portraits/nilak.png', 'water'),
  'portrait.sura': image('art/portraits/sura.png', 'water'),
  'portrait.bo': image('art/portraits/bo.png', 'earth'),
  'portrait.linmei': image('art/portraits/linmei.png', 'earth'),
  'portrait.nima': image('art/portraits/nima.png', 'air'),
  'portrait.jinu': image('art/portraits/jinu.png', 'air'),
  'portrait.riko': image('art/portraits/riko.png', 'nonbender'),
  'portrait.wen': image('art/portraits/wen.png', 'nonbender'),

  'portrait.narrator': painter('portrait', 'neutral', 'narrator'),
  'portrait.mira': image('art/portraits/mira.png', 'earth'),
  'portrait.gao': image('art/portraits/gao.png', 'earth'),
  'portrait.pella': image('art/portraits/pella.png', 'air'),
  'portrait.dorin': image('art/portraits/dorin.png', 'earth'),
  'portrait.ruon': image('art/portraits/ruon.png', 'neutral'),
  'portrait.jin': image('art/portraits/jin.png', 'nonbender'),

  /* ------------------------------------------------------------ Probe */
  /*
   * A real atlas of flat-colour frames, committed so the sheet path is
   * exercised in CI before any generated art exists. Never assigned to a
   * unit by content; the e2e suite points a unit at it and reads the pixels.
   */
  'unit.test.probe': {
    kind: 'sheet',
    atlas: 'art/test/probe.json',
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'neutral',
    clips: {
      idle: { frames: ['unit.test.probe/idle/0', 'unit.test.probe/idle/1'], fps: 1, loop: true },
      cast: {
        frames: ['unit.test.probe/cast/0', 'unit.test.probe/cast/1', 'unit.test.probe/cast/2'],
        fps: 8,
        loop: false,
      },
    },
  },
};

/** The eight-way locomotion a key's sheet declares, or undefined for four-way art. */
export function sheetLocomotion(key: string | undefined): LocomotionDef | undefined {
  if (!key) return undefined;
  const asset = resolveAsset(key);
  return asset.kind === 'sheet' ? asset.locomotion : undefined;
}

/**
 * Ability effects are keyed `fx.<element>.<name>`. Rather than list forty
 * near-identical entries, unlisted fx keys fall back to the generic impact
 * painter tinted by the element in the key — so adding an ability needs no
 * manifest edit, while overriding one still can.
 */
export function resolveAsset(key: string): AssetEntry {
  const explicit = ASSETS[key];
  if (explicit) return explicit;

  if (key.startsWith('fx.')) {
    const parts = key.split('.');
    const element = parts[1] ?? 'neutral';
    const name = parts[2] ?? 'impact';
    const palette = element === 'non' || element === 'enemy' ? 'nonbender' : element;
    return { kind: 'painter', painter: 'impact', palette, variant: name };
  }

  if (key.startsWith('portrait.')) {
    return { kind: 'painter', painter: 'portrait', palette: 'neutral', variant: 'unknown' };
  }

  // Without this a new prop would fall through to the generic 'bender' painter
  // and draw a barrel as a person.
  if (key.startsWith('prop.')) {
    const variant = key.split('.')[1] ?? 'crate';
    return { kind: 'painter', painter: 'prop', palette: 'neutral', variant };
  }

  return { kind: 'painter', painter: 'bender', palette: 'neutral' };
}
