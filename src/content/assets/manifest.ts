/**
 * The art swap point.
 *
 * Nothing in the game references a drawing directly — units, portraits, NPCs
 * and ability effects all carry an asset *key*, and this file decides what that
 * key resolves to.
 *
 * Today every key resolves to a code-drawn painter: a named vector routine in
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

import type { ClipDef, ClipName } from './clips';

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
      /** Tiles the unit stands on: 1x1, or 2x1 for the boss. */
      readonly footprint: { readonly w: number; readonly h: number };
      /** The point of the frame that stands on the tile's foot line, as fractions of the frame. */
      readonly anchor: { readonly x: number; readonly y: number };
      /** `mirror`: drawn facing screen-right and flipped for the other side. */
      readonly facing: 'mirror' | 'both';
      readonly clips: Partial<Record<ClipName, ClipDef>>;
      /** Palette key, for the HUD chrome and for the placeholder drawn while the atlas loads. */
      readonly palette: string;
    };

export type SheetEntry = Extract<AssetEntry, { kind: 'sheet' }>;

const painter = (painterName: string, palette: string, variant?: string): AssetEntry =>
  variant
    ? { kind: 'painter', painter: painterName, palette, variant }
    : { kind: 'painter', painter: painterName, palette };

export const ASSETS: Readonly<Record<string, AssetEntry>> = {
  /* ------------------------------------------------------ Party sprites */
  // The variant names the character: `src/render/painters/cast.ts` has a figure for each.
  'unit.fire.kaya': {
    kind: 'sheet',
    atlas: 'art/units/kaya.json',
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'fire',
    clips: {
      idle: { frames: ['unit.fire.kaya/idle/0', 'unit.fire.kaya/idle/1'], fps: 1, loop: true },
      cast: {
        frames: ['unit.fire.kaya/cast/0', 'unit.fire.kaya/cast/1', 'unit.fire.kaya/cast/2'],
        fps: 8,
        loop: false,
      },
      ko: { frames: ['unit.fire.kaya/ko/0'], fps: 1, loop: false },
    },
  },
  'unit.fire.tenzo': {
    kind: 'sheet',
    atlas: 'art/units/tenzo.json',
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'fire',
    clips: {
      idle: { frames: ['unit.fire.tenzo/idle/0', 'unit.fire.tenzo/idle/1'], fps: 1, loop: true },
      cast: {
        frames: ['unit.fire.tenzo/cast/0', 'unit.fire.tenzo/cast/1', 'unit.fire.tenzo/cast/2'],
        fps: 8,
        loop: false,
      },
      ko: { frames: ['unit.fire.tenzo/ko/0'], fps: 1, loop: false },
    },
  },
  'unit.water.nilak': {
    kind: 'sheet',
    atlas: 'art/units/nilak.json',
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'water',
    clips: {
      idle: { frames: ['unit.water.nilak/idle/0', 'unit.water.nilak/idle/1'], fps: 1, loop: true },
      cast: {
        frames: ['unit.water.nilak/cast/0', 'unit.water.nilak/cast/1', 'unit.water.nilak/cast/2'],
        fps: 8,
        loop: false,
      },
      ko: { frames: ['unit.water.nilak/ko/0'], fps: 1, loop: false },
    },
  },
  'unit.water.sura': {
    kind: 'sheet',
    atlas: 'art/units/sura.json',
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'water',
    clips: {
      idle: { frames: ['unit.water.sura/idle/0', 'unit.water.sura/idle/1'], fps: 1, loop: true },
      cast: {
        frames: ['unit.water.sura/cast/0', 'unit.water.sura/cast/1', 'unit.water.sura/cast/2'],
        fps: 8,
        loop: false,
      },
      ko: { frames: ['unit.water.sura/ko/0'], fps: 1, loop: false },
    },
  },
  'unit.earth.bo': {
    kind: 'sheet',
    atlas: 'art/units/bo.json',
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'earth',
    clips: {
      idle: { frames: ['unit.earth.bo/idle/0', 'unit.earth.bo/idle/1'], fps: 1, loop: true },
      cast: {
        frames: ['unit.earth.bo/cast/0', 'unit.earth.bo/cast/1', 'unit.earth.bo/cast/2'],
        fps: 8,
        loop: false,
      },
      ko: { frames: ['unit.earth.bo/ko/0'], fps: 1, loop: false },
    },
  },
  'unit.earth.linmei': {
    kind: 'sheet',
    atlas: 'art/units/linmei.json',
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'earth',
    clips: {
      idle: {
        frames: ['unit.earth.linmei/idle/0', 'unit.earth.linmei/idle/1'],
        fps: 1,
        loop: true,
      },
      cast: {
        frames: [
          'unit.earth.linmei/cast/0',
          'unit.earth.linmei/cast/1',
          'unit.earth.linmei/cast/2',
        ],
        fps: 8,
        loop: false,
      },
      ko: { frames: ['unit.earth.linmei/ko/0'], fps: 1, loop: false },
    },
  },
  'unit.air.nima': {
    kind: 'sheet',
    atlas: 'art/units/nima.json',
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'air',
    clips: {
      idle: { frames: ['unit.air.nima/idle/0', 'unit.air.nima/idle/1'], fps: 1, loop: true },
      cast: {
        frames: ['unit.air.nima/cast/0', 'unit.air.nima/cast/1', 'unit.air.nima/cast/2'],
        fps: 8,
        loop: false,
      },
      ko: { frames: ['unit.air.nima/ko/0'], fps: 1, loop: false },
    },
  },
  'unit.air.jinu': {
    kind: 'sheet',
    atlas: 'art/units/jinu.json',
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'air',
    clips: {
      idle: { frames: ['unit.air.jinu/idle/0', 'unit.air.jinu/idle/1'], fps: 1, loop: true },
      cast: {
        frames: ['unit.air.jinu/cast/0', 'unit.air.jinu/cast/1', 'unit.air.jinu/cast/2'],
        fps: 8,
        loop: false,
      },
      ko: { frames: ['unit.air.jinu/ko/0'], fps: 1, loop: false },
    },
  },
  'unit.non.riko': {
    kind: 'sheet',
    atlas: 'art/units/riko.json',
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'nonbender',
    clips: {
      idle: { frames: ['unit.non.riko/idle/0', 'unit.non.riko/idle/1'], fps: 1, loop: true },
      cast: {
        frames: ['unit.non.riko/cast/0', 'unit.non.riko/cast/1', 'unit.non.riko/cast/2'],
        fps: 8,
        loop: false,
      },
      ko: { frames: ['unit.non.riko/ko/0'], fps: 1, loop: false },
    },
  },
  'unit.non.wen': {
    kind: 'sheet',
    atlas: 'art/units/wen.json',
    pixelsPerTile: 128,
    footprint: { w: 1, h: 1 },
    anchor: { x: 0.5, y: 0.85 },
    facing: 'mirror',
    palette: 'nonbender',
    clips: {
      idle: { frames: ['unit.non.wen/idle/0', 'unit.non.wen/idle/1'], fps: 1, loop: true },
      cast: {
        frames: ['unit.non.wen/cast/0', 'unit.non.wen/cast/1', 'unit.non.wen/cast/2'],
        fps: 8,
        loop: false,
      },
      ko: { frames: ['unit.non.wen/ko/0'], fps: 1, loop: false },
    },
  },

  /* ----------------------------------------------------- Enemy sprites */
  'unit.enemy.thug': painter('bandit', 'enemy', 'club'),
  'unit.enemy.slinger': painter('bandit', 'enemy', 'sling'),
  'unit.enemy.bruiser': painter('bandit', 'enemy', 'broad'),
  'unit.enemy.quarrybender': painter('bandit', 'earth', 'bender'),
  'unit.enemy.deserter': painter('bandit', 'fire', 'bender'),
  'unit.enemy.merc': painter('mercenary', 'enemy', 'blade'),
  'unit.enemy.crossbow': painter('mercenary', 'enemy', 'crossbow'),
  'unit.enemy.sergeant': painter('mercenary', 'enemy', 'sergeant'),
  'unit.enemy.grumbler': painter('driller', 'enemy'),
  'unit.ally.ruon': painter('mercenary', 'neutral', 'sergeant'),

  /* --------------------------------------------------------------- NPCs */
  'npc.elder': painter('villager', 'neutral', 'elder'),
  'npc.shopkeeper': painter('villager', 'earth', 'shopkeeper'),
  'npc.kid': painter('villager', 'air', 'kid'),
  'npc.guard': painter('villager', 'earth', 'guard'),

  /* --------------------------------------------------------------- Props */
  'prop.barrel': painter('prop', 'water', 'barrel'),
  'prop.flask': painter('prop', 'earth', 'flask'),
  'prop.brazier': painter('prop', 'fire', 'brazier'),
  'prop.hay': painter('prop', 'air', 'hay'),
  'prop.rubble': painter('prop', 'earth', 'rubble'),
  'prop.cart': painter('prop', 'air', 'cart'),

  /* ---------------------------------------------------------- Portraits */
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
  'portrait.mira': painter('portrait', 'earth', 'mira'),
  'portrait.gao': painter('portrait', 'earth', 'gao'),
  'portrait.pella': painter('portrait', 'air', 'pella'),
  'portrait.dorin': painter('portrait', 'earth', 'dorin'),
  'portrait.ruon': painter('portrait', 'neutral', 'ruon'),
  'portrait.jin': painter('portrait', 'nonbender', 'jin'),

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
