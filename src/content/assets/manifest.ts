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

import type { ClipDef, ClipName, MeleeDirection } from './clips';

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
      /** Pixels a tile is drawn at in the atlas: 128, or 256 for a sharper sheet. */
      readonly pixelsPerTile: number;
      /** Explicit art bounds when weapon reach exceeds the default frame (ADR 0032). */
      readonly frameSize?: { readonly w: number; readonly h: number };
      /** Tiles the unit stands on: 1x1, or 2x1 for the boss. */
      readonly footprint: { readonly w: number; readonly h: number };
      /** The point of the frame that stands on the tile's foot line, as fractions of the frame. */
      readonly anchor: { readonly x: number; readonly y: number };
      /** `mirror`: drawn facing screen-right and flipped for the other side. */
      readonly facing: 'mirror' | 'both';
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
      ...(!key.startsWith('unit.village.') && ['nima', 'kaya', 'sura', 'bo', 'wen'].includes(name)
        ? {
            rest: { frames: frames('rest', 1), fps: 1, loop: true },
            restNorth: { frames: frames('restNorth', 1), fps: 1, loop: true },
            restSouth: { frames: frames('restSouth', 1), fps: 1, loop: true },
          }
        : {}),
    },
  };
};

function villageSheet(name: string, palette: string): SheetEntry {
  const key = `unit.village.${name}`;
  const base = heroSheet(key, palette);
  const frames = (clip: ClipName, count: number) =>
    Array.from({ length: count }, (_, i) => `${key}/${clip}/${i}`);
  return {
    ...base,
    atlas: `art/units/riverside-locomotion-${name}.json`,
    clips: {
      ...base.clips,
      walk: { frames: frames('walk', 4), fps: 8, loop: true },
      wave: { frames: frames('wave', 2), fps: 4, loop: true },
      tea: { frames: frames('tea', 2), fps: 0.25, loop: true },
    },
  };
}

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

export const ASSETS: Readonly<Record<string, AssetEntry>> = {
  'unit.village.sura': villageSheet('sura', 'water'),
  'unit.village.kaya': villageSheet('kaya', 'fire'),
  /* ------------------------------------------------------ Party sprites */
  'unit.fire.kaya': heroSheet('unit.fire.kaya', 'fire'),
  'unit.fire.tenzo': heroSheet('unit.fire.tenzo', 'fire'),
  'unit.water.nilak': heroSheet('unit.water.nilak', 'water'),
  'unit.water.sura': heroSheet('unit.water.sura', 'water'),
  'unit.earth.bo': heroSheet('unit.earth.bo', 'earth'),
  'unit.earth.linmei': heroSheet('unit.earth.linmei', 'earth'),
  'unit.air.nima': heroSheet('unit.air.nima', 'air'),
  'unit.air.jinu': heroSheet('unit.air.jinu', 'air'),
  'unit.non.riko': rikoSheet(),
  'unit.non.wen': heroSheet('unit.non.wen', 'nonbender'),

  /* ----------------------------------------------------- Enemy sprites */
  'unit.enemy.thug': {
    kind: 'sheet',
    atlas: 'art/units/thug.json',
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'enemy',
    clips: {
      idle: { frames: ['unit.enemy.thug/idle/0', 'unit.enemy.thug/idle/1'], fps: 1, loop: true },
      walk: { frames: ['unit.enemy.thug/walk/0', 'unit.enemy.thug/walk/1'], fps: 4, loop: true },
      cast: {
        frames: ['unit.enemy.thug/cast/0', 'unit.enemy.thug/cast/1', 'unit.enemy.thug/cast/2'],
        fps: 8,
        loop: false,
      },
      hit: { frames: ['unit.enemy.thug/hit/0'], fps: 1, loop: false },
      ko: { frames: ['unit.enemy.thug/ko/0'], fps: 1, loop: false },
    },
  },
  'unit.enemy.slinger': quarryEnemySheet('slinger', 'enemy'),
  'unit.enemy.bruiser': quarryEnemySheet('bruiser', 'enemy'),
  'unit.enemy.quarrybender': quarryEnemySheet('quarrybender', 'earth'),
  'unit.enemy.deserter': quarryEnemySheet('deserter', 'fire'),
  'unit.enemy.merc': cuttingSheet('merc', 'enemy'),
  'unit.enemy.crossbow': {
    kind: 'sheet',
    atlas: 'art/units/crossbow.json',
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'enemy',
    clips: {
      idle: {
        frames: ['unit.enemy.crossbow/idle/0', 'unit.enemy.crossbow/idle/1'],
        fps: 1,
        loop: true,
      },
      walk: {
        frames: ['unit.enemy.crossbow/walk/0', 'unit.enemy.crossbow/walk/1'],
        fps: 4,
        loop: true,
      },
      cast: {
        frames: [
          'unit.enemy.crossbow/cast/0',
          'unit.enemy.crossbow/cast/1',
          'unit.enemy.crossbow/cast/2',
        ],
        fps: 8,
        loop: false,
      },
      hit: { frames: ['unit.enemy.crossbow/hit/0'], fps: 1, loop: false },
      ko: { frames: ['unit.enemy.crossbow/ko/0'], fps: 1, loop: false },
    },
  },
  'unit.enemy.sergeant': cuttingSheet('sergeant', 'enemy'),
  'unit.enemy.grumbler': {
    kind: 'sheet',
    atlas: 'art/units/grumbler.json',
    pixelsPerTile: 128,
    footprint: { w: 2, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'enemy',
    clips: {
      idle: {
        frames: ['unit.enemy.grumbler/idle/0', 'unit.enemy.grumbler/idle/1'],
        fps: 1,
        loop: true,
      },
      walk: {
        frames: ['unit.enemy.grumbler/walk/0', 'unit.enemy.grumbler/walk/1'],
        fps: 4,
        loop: true,
      },
      cast: {
        frames: [
          'unit.enemy.grumbler/cast/0',
          'unit.enemy.grumbler/cast/1',
          'unit.enemy.grumbler/cast/2',
        ],
        fps: 8,
        loop: false,
      },
      hit: { frames: ['unit.enemy.grumbler/hit/0'], fps: 1, loop: false },
      ko: { frames: ['unit.enemy.grumbler/ko/0'], fps: 1, loop: false },
    },
  },
  'unit.ally.ruon': cuttingSheet('ruon', 'neutral'),

  /* --------------------------------------------------------------- NPCs */
  'npc.elder': { kind: 'image', url: 'art/npcs/mira.png', palette: 'neutral' },
  'npc.shopkeeper': { kind: 'image', url: 'art/npcs/gao.png', palette: 'earth' },
  'world.turtle_ducks': {
    kind: 'image',
    url: 'art/world/turtle-ducks-nest.webp',
    palette: 'earth',
  },
  'world.runoff_marker': painter('discovery', 'neutral', 'marker'),
  'world.tea_station': { kind: 'image', url: 'art/props/tea-station.png', palette: 'earth' },
  'npc.kid': { kind: 'image', url: 'art/npcs/pella.png', palette: 'air' },
  'npc.dorin': { kind: 'image', url: 'art/npcs/dorin.png', palette: 'earth' },
  'npc.guard': painter('villager', 'earth', 'guard'),
  // ADR 0047 placeholders until A1's art: Hanru, distinct from both of
  // Dorin's sprites (D7), and an adult of Pella's household who is no named person.
  'npc.hanru': painter('villager', 'nonbender', 'guard'),
  'npc.household': painter('villager', 'earth'),
  // Until A1's notice art: a marker stone.
  'world.school_notice': painter('discovery', 'neutral', 'marker'),

  /* --------------------------------------------------------------- Props */
  'prop.barrel': { kind: 'image', url: 'art/props/barrel.png', palette: 'water' },
  'prop.flask': { kind: 'image', url: 'art/props/flask.png', palette: 'earth' },
  'prop.brazier': { kind: 'image', url: 'art/props/brazier.png', palette: 'fire' },
  'prop.hay': { kind: 'image', url: 'art/props/hay.png', palette: 'air' },
  'prop.rubble': { kind: 'image', url: 'art/props/rubble.png', palette: 'earth' },
  'prop.cart': { kind: 'image', url: 'art/props/cart.png', palette: 'air' },

  /* ---------------------------------------------------------- Portraits */
  'portrait.enemy.slinger': {
    kind: 'image',
    url: 'art/portraits/enemy.slinger.png',
    palette: 'enemy',
  },
  'portrait.enemy.bruiser': {
    kind: 'image',
    url: 'art/portraits/enemy.bruiser.png',
    palette: 'enemy',
  },
  'portrait.enemy.quarrybender': {
    kind: 'image',
    url: 'art/portraits/enemy.quarrybender.png',
    palette: 'earth',
  },
  'portrait.enemy.crossbow': {
    kind: 'image',
    url: 'art/portraits/enemy.crossbow.png',
    palette: 'enemy',
  },
  'portrait.enemy.thug': { kind: 'image', url: 'art/portraits/enemy.thug.png', palette: 'enemy' },
  'portrait.enemy.deserter': {
    kind: 'image',
    url: 'art/portraits/enemy.deserter.webp',
    palette: 'fire',
  },
  'portrait.enemy.grumbler': {
    kind: 'image',
    url: 'art/portraits/enemy.grumbler.png',
    palette: 'enemy',
  },
  'portrait.kaya': { kind: 'image', url: 'art/portraits/kaya.png', palette: 'fire' },
  'portrait.tenzo': { kind: 'image', url: 'art/portraits/tenzo.png', palette: 'fire' },
  'portrait.nilak': { kind: 'image', url: 'art/portraits/nilak.png', palette: 'water' },
  'portrait.sura': { kind: 'image', url: 'art/portraits/sura.png', palette: 'water' },
  'portrait.bo': { kind: 'image', url: 'art/portraits/bo.png', palette: 'earth' },
  'portrait.linmei': { kind: 'image', url: 'art/portraits/linmei.png', palette: 'earth' },
  'portrait.nima': { kind: 'image', url: 'art/portraits/nima.png', palette: 'air' },
  'portrait.jinu': { kind: 'image', url: 'art/portraits/jinu.png', palette: 'air' },
  'portrait.riko': { kind: 'image', url: 'art/portraits/riko.png', palette: 'nonbender' },
  'portrait.wen': { kind: 'image', url: 'art/portraits/wen.png', palette: 'nonbender' },

  'portrait.narrator': painter('portrait', 'neutral', 'narrator'),
  'portrait.mira': { kind: 'image', url: 'art/portraits/mira.png', palette: 'earth' },
  'portrait.gao': { kind: 'image', url: 'art/portraits/gao.png', palette: 'earth' },
  'portrait.pella': { kind: 'image', url: 'art/portraits/pella.png', palette: 'air' },
  'portrait.dorin': { kind: 'image', url: 'art/portraits/dorin.png', palette: 'earth' },
  'portrait.ruon': { kind: 'image', url: 'art/portraits/ruon.png', palette: 'neutral' },
  'portrait.jin': { kind: 'image', url: 'art/portraits/jin.png', palette: 'nonbender' },

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
