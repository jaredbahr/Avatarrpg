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

import type { ClipDef, ClipName, Heading, LocomotionDef, MeleeDirection } from './clips';
import { HEADINGS, headingClip } from './clips';
import { TOPDOWN_SHEETS, type TopdownName } from './topdownSheets';

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
       * Further clips, as a JSON of `ClipDef`s by clip name relative to the
       * site root, whose cels live on the pages above (the G knockouts, ADR
       * 0059). Fetched with the pages, so it costs the bundle nothing: the
       * sheet draws once it is in, and those clips are asked of the store.
       */
      readonly clipData?: string;
      /**
       * The per-heading ability poses of a top-down sheet (ADR 0104), as a JSON of clips by pose name
       * and then heading, relative to the site root, whose cels live on the pages above. Combat plays
       * them by `actionMap`, each heading as drawn; while they load, the legacy `cast` stands in.
       */
      readonly actions?: string;
      /**
       * Which pose of `actions` plays: `cast` for an ability `abilities` does not list (ability id to
       * pose), and `idle`, when set, as the idle loop in each heading (the Driller's rumble).
       */
      readonly actionMap?: TopdownActionMap;
      /** Pixels a tile is drawn at in the atlas: 128, or 256 for a sharper sheet; 40 on the top-down board. */
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

export interface TopdownActionMap {
  readonly cast: string;
  readonly idle?: string;
  readonly abilities?: Readonly<Record<string, string>>;
}

const HEAL = ['healing_stream', 'healing_hands', 'purifying_mist', 'life_tide'];
const GUST = ['gust', 'cyclone', 'tornado', 'deafening_shout', 'air_shield', 'air_scooter'];

/**
 * The pose each top-down sheet plays for an ability (ADR 0104), by pose: the first entry is the pose any
 * ability not listed plays, and each other pose lists its abilities. `idle` loops in place of the idle.
 */
const TOPDOWN_ACTIONS: Partial<
  Record<TopdownName, { cast: string; idle?: string; by?: Record<string, readonly string[]> }>
> = {
  kaya: {
    cast: 'jab',
    by: {
      whip: ['flame_arc'],
      blast: ['fire_blast', 'dragon_breath', 'lightning_storm'],
      stomp: ['fire_step', 'fire_wall', 'heat_shield'],
    },
  },
  tenzo: {
    cast: 'attack',
    by: { blast: ['fire_blast', 'flame_arc', 'dragon_breath', 'lightning_storm', 'fire_wall'] },
  },
  nilak: { cast: 'attack', by: { heal: HEAL } },
  sura: {
    cast: 'attack',
    by: {
      ice: ['ice_path', 'ice_spikes', 'ice_shield', 'tidal_wave', 'octopus_form'],
      heal: HEAL,
    },
  },
  bo: {
    cast: 'attack',
    by: {
      wall: ['earth_wall', 'shockwave', 'raise_rubble', 'mudslide', 'fissure'],
      stance: ['stone_stance', 'metal_armor', 'seismic_sense'],
    },
  },
  linmei: {
    cast: 'attack',
    by: { throw: ['rock_throw', 'boulder', 'metal_cable', 'metalbending'] },
  },
  nima: { cast: 'attack', by: { gust: GUST } },
  jinu: { cast: 'attack', by: { gust: GUST } },
  riko: { cast: 'attack', by: { block: ['chi_block', 'pressure_points'] } },
  wen: { cast: 'attack', by: { spark: ['gauntlet_spark', 'electrified_glove', 'shock_mine'] } },
  deserter: { cast: 'attack', by: { throw: ['oil_flask', 'torch_toss'] } },
  driller: { cast: 'slam', idle: 'rumble' },
};

/** A sheet's `actionMap`, from `TOPDOWN_ACTIONS` (its own `attack` for a sheet not listed there). */
function topdownActionMap(name: TopdownName): TopdownActionMap {
  const { by = {}, ...rest } = TOPDOWN_ACTIONS[name] ?? { cast: 'attack' };
  const abilities: Record<string, string> = {};
  for (const [pose, ids] of Object.entries(by)) for (const id of ids) abilities[id] = pose;
  return { ...rest, abilities };
}

/**
 * A top-down figure (ADR 0104 T2), packed from the prototype's approved PixelLab takes by
 * `scripts/art/topdown/pack-sheets.ts`: 48 px characters at one art px a world px on the 40 px
 * top-down tile, PixelLab's eight drawn headings (never mirrored) and eight-way locomotion. Idle, walk
 * and rest share the sheet's frame and foot anchor; the idle plays the prototype's calm cels there and
 * back. The hits (eight headings) and knockouts (the four diagonals the clip vocabulary asks for) arrive
 * with the clip file; every heading of every ability, and all eight knockouts, are in the actions file,
 * which combat plays per heading and ability by `actionMap`. The legacy mirrored `cast` (the main
 * ability's east heading) stands in while it loads. A figure the prototype never walked (Mira, Hanru)
 * holds its idle's first cel as its walk; the Driller walks on its tread loop (T5).
 */
export function topdownSheet(name: TopdownName, key: string, palette: string): SheetEntry {
  const t = TOPDOWN_SHEETS[name];
  const clips: Partial<Record<ClipName, ClipDef>> = {};
  const msPerTile = {} as Record<Heading, number>;
  const cel = (clip: ClipName, index: number) => `${key}/${clip}/${index}`;
  HEADINGS.forEach((heading, i) => {
    const idle = headingClip('idle', heading);
    const n = t.idleCels[i] ?? 1;
    // There and back over the calm cels (0 1 2 1), as the prototype plays them; one cel is held.
    const order = n >= 3 ? [0, 1, 2, 1] : n === 2 ? [0, 1] : [0, 0];
    clips[idle] = {
      frames: order.map((j) => cel(idle, j)),
      fps: 1000 / t.idleMs,
      loop: true,
      frameMs: order.map(() => t.idleMs),
    };
    const rest = headingClip('rest', heading);
    clips[rest] = { frames: [cel(rest, 0)], fps: 1, loop: true };
    const walk = headingClip('walk', heading);
    const w = t.walkCels[i] ?? 0;
    clips[walk] =
      w > 0
        ? {
            frames: Array.from({ length: w }, (_, j) => cel(walk, j)),
            fps: 1000 / t.walkCelMs,
            loop: true,
          }
        : {
            frames: [0, 0, 0, 0].map((j) => cel(walk, j)),
            fps: 4,
            loop: true,
            frameMs: [250, 250, 250, 250],
          };
    msPerTile[heading] = t.walkMsPerTile;
  });
  if (t.cast) clips.cast = t.cast;
  // The riverside's seated tea and wave (Kaya and Sura), mirrored by facing like the cast.
  if (t.tea) clips.tea = t.tea;
  if (t.wave) clips.wave = t.wave;
  const eastWalk = t.walkCels[0] ?? 0;
  return {
    kind: 'sheet',
    atlas: `art/topdown/${name}.json`,
    ...(t.pages > 1 && {
      atlasPages: Array.from(
        { length: t.pages - 1 },
        (_, i) => `art/topdown/${name}-${i + 2}.json`,
      ),
    }),
    ...(t.clipData && { clipData: `art/topdown/${name}-clips.json` }),
    ...(t.actions && {
      actions: `art/topdown/${name}-actions.json`,
      actionMap: topdownActionMap(name),
    }),
    pixelsPerTile: 40,
    frameSize: t.frame,
    footprint: { w: t.footprint, h: t.footprint },
    anchor: t.anchor,
    facing: 'both',
    locomotion: {
      headings: 8,
      walkMsPerTile: msPerTile,
      walkStartMs: 0,
      walkCycleMs: eastWalk > 0 ? eastWalk * t.walkCelMs : 1000,
      authoredBob: true,
    },
    palette,
    clips,
  };
}

/** The asset keys `?style=topdown` draws from the top-down sheets, with each one's sheet and palette. */
export const TOPDOWN_KEYS: Readonly<Record<string, readonly [TopdownName, string]>> = {
  'unit.fire.kaya': ['kaya', 'fire'],
  'unit.water.sura': ['sura', 'water'],
  'unit.earth.bo': ['bo', 'earth'],
  // T8: the heroes the tutorial does not cast.
  'unit.fire.tenzo': ['tenzo', 'fire'],
  'unit.water.nilak': ['nilak', 'water'],
  'unit.earth.linmei': ['linmei', 'earth'],
  'unit.air.nima': ['nima', 'air'],
  'unit.air.jinu': ['jinu', 'air'],
  'unit.non.riko': ['riko', 'nonbender'],
  'unit.non.wen': ['wen', 'nonbender'],
  'unit.enemy.thug': ['thug', 'enemy'],
  'unit.enemy.slinger': ['slinger', 'enemy'],
  'unit.enemy.bruiser': ['bruiser', 'enemy'],
  'unit.enemy.driller': ['driller', 'enemy'],
  // T5: the quarry cast (the gate, the Cutting and the floor) and Captain Ruon.
  'unit.enemy.deserter': ['deserter', 'fire'],
  'unit.enemy.quarrybender': ['quarrybender', 'earth'],
  'unit.enemy.merc': ['merc', 'enemy'],
  'unit.enemy.crossbow': ['crossbow', 'enemy'],
  'unit.enemy.sergeant': ['sergeant', 'enemy'],
  'unit.ally.ruon': ['ruon', 'neutral'],
  'npc.elder': ['mira', 'neutral'],
  'npc.shopkeeper': ['gao', 'earth'],
  'npc.kid': ['pella', 'air'],
  'npc.dorin': ['dorin', 'earth'],
  'npc.household': ['household', 'earth'],
  'npc.hanru': ['hanru', 'nonbender'],
  'npc.guard': ['guard', 'earth'],
  // T10: Dema, the road keeper, and Sen, the tea keeper, in their own clothes.
  'npc.dema': ['dema', 'earth'],
  'npc.sen': ['sen', 'earth'],
};

/**
 * T3's standing objects that are talked to (`world.route_sign`, `world.school_notice`): one cel each,
 * 40 px a tile like the figures, standing on its cell's centre by its lowest row.
 */
export const TOPDOWN_OBJECTS: Readonly<Record<string, { readonly w: number; readonly h: number }>> =
  {
    'world.route_sign': { w: 40, h: 54 },
    'world.school_notice': { w: 45, h: 47 },
  };

function topdownObject(key: string, size: { readonly w: number; readonly h: number }): SheetEntry {
  const name = key.slice(key.indexOf('.') + 1);
  return {
    kind: 'sheet',
    atlas: `art/topdown/objects/${name}.json`,
    pixelsPerTile: 40,
    frameSize: size,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 1 },
    facing: 'mirror',
    palette: 'neutral',
    // A sheet carries an idle and a cast (`REQUIRED_CLIPS`); every cel of an object's atlas is its one image.
    clips: {
      idle: { frames: [0, 1].map((i) => `${key}/idle/${i}`), fps: 1, loop: true },
      cast: { frames: [0, 1, 2].map((i) => `${key}/cast/${i}`), fps: 3, loop: false },
    },
  };
}

let topDownStyle: Readonly<Record<string, AssetEntry>> | undefined;

/**
 * The top-down PixelLab figures (ADR 0104), laid over `ASSETS`: the game's only look since T7, so
 * `main.ts` turns it on at boot. The keys whose G1 sheets T7 retired hold the same top-down sheet in
 * `ASSETS` itself.
 */
export function useTopDownStyle(): void {
  topDownStyle = Object.fromEntries([
    ...Object.entries(TOPDOWN_KEYS).map(([key, [name, palette]]) => [
      key,
      topdownSheet(name, key, palette),
    ]),
    ...Object.entries(TOPDOWN_OBJECTS).map(([key, size]) => [key, topdownObject(key, size)]),
  ]);
}

/** Whether the top-down figures are on (`useTopDownStyle`). */
export function topDownStyleActive(): boolean {
  return topDownStyle !== undefined;
}

export const ASSETS: Readonly<Record<string, AssetEntry>> = {
  /* ------------------------------------------------------ Party sprites */
  'unit.fire.kaya': topdownSheet('kaya', 'unit.fire.kaya', 'fire'),
  'unit.fire.tenzo': heroSheet('unit.fire.tenzo', 'fire'),
  'unit.water.nilak': heroSheet('unit.water.nilak', 'water'),
  'unit.water.sura': topdownSheet('sura', 'unit.water.sura', 'water'),
  'unit.earth.bo': topdownSheet('bo', 'unit.earth.bo', 'earth'),
  'unit.earth.linmei': heroSheet('unit.earth.linmei', 'earth'),
  'unit.air.nima': heroSheet('unit.air.nima', 'air'),
  'unit.air.jinu': heroSheet('unit.air.jinu', 'air'),
  'unit.non.riko': rikoSheet(),
  'unit.non.wen': heroSheet('unit.non.wen', 'nonbender'),

  /* ----------------------------------------------------- Enemy sprites */
  'unit.enemy.thug': topdownSheet('thug', 'unit.enemy.thug', 'enemy'),
  'unit.enemy.slinger': topdownSheet('slinger', 'unit.enemy.slinger', 'enemy'),
  'unit.enemy.bruiser': topdownSheet('bruiser', 'unit.enemy.bruiser', 'enemy'),
  'unit.enemy.quarrybender': topdownSheet('quarrybender', 'unit.enemy.quarrybender', 'earth'),
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
  // The residents (issue #284), drawn top-down since T7 retired their G sheets. The shrine figure shares Mira's.
  'npc.elder': topdownSheet('mira', 'npc.elder', 'neutral'),
  'npc.shopkeeper': topdownSheet('gao', 'npc.shopkeeper', 'earth'),
  // Dema and Sen have their own top-down sheets (T10), laid over these by `useTopDownStyle`.
  'npc.dema': painter('villager', 'earth', 'elder'),
  'npc.sen': painter('villager', 'earth', 'shopkeeper'),
  'world.turtle_ducks': image('art/world/turtle-ducks-nest.webp', 'earth'),
  'world.runoff_marker': image('art/world/runoff-marker.png', 'neutral'),
  'world.tea_station': image('art/props/tea-station.png', 'earth'),
  'npc.kid': topdownSheet('pella', 'npc.kid', 'air'),
  'npc.dorin': topdownSheet('dorin', 'npc.dorin', 'earth'),
  'npc.guard': topdownSheet('guard', 'npc.guard', 'earth'),
  // ADR 0047's placeholder until A1's art: Hanru, distinct from both of Dorin's
  // sprites (D7). His look is an owner decision, so he keeps the painted figure.
  'npc.hanru': painter('villager', 'nonbender', 'guard'),
  // An adult of Pella's household who is no named person; the returnees share it.
  'npc.household': topdownSheet('household', 'npc.household', 'earth'),
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
  'portrait.enemy.deserter': image('art/portraits/enemy.deserter.png', 'fire'),
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

  'portrait.narrator': image('art/portraits/narrator.png', 'neutral'),
  'portrait.mira': image('art/portraits/mira.png', 'earth'),
  'portrait.gao': image('art/portraits/gao.png', 'earth'),
  'portrait.hanru': image('art/portraits/hanru.png', 'nonbender'),
  'portrait.pella': image('art/portraits/pella.png', 'air'),
  'portrait.dorin': image('art/portraits/dorin.png', 'earth'),
  'portrait.ruon': image('art/portraits/ruon.png', 'neutral'),
  'portrait.jin': image('art/portraits/jin.png', 'nonbender'),
  'portrait.dema': image('art/portraits/dema.png', 'neutral'),
  'portrait.sen': image('art/portraits/sen.png', 'neutral'),

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
  const explicit = topDownStyle?.[key] ?? ASSETS[key];
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
