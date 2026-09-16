/**
 * Who the placeholder figures are.
 *
 * One spec per manifest variant: the ten heroes by character, the enemy
 * families by role, the villagers by job. A hero's spec is read off their
 * reference figure (docs/art/prompts/sheets), so the placeholder already has
 * the silhouette the generated sheet will have and a table learns the cast
 * before the real art lands. Anything unknown falls back to a generic figure
 * in the palette, so a new key is never drawn as nothing.
 */

import type { Palette } from '../palettes';
import type { BuildName, FigureSpec, Tones } from './figure';
import { shade } from './figure';

const DARK_HAIR = '#2b1d15';
const BLOND = '#d8b661';
const WHITE_HAIR = '#e8e2d4';
const GREY_HAIR = '#9a958d';
const CHARCOAL: Tones = { base: '#33302e', dark: '#1f1d1b' };
const CREAM: Tones = { base: '#e6dcc4', dark: '#b8ad95' };
const NAVY: Tones = { base: '#2b3d66', dark: '#1b2744' };
const SAFFRON: Tones = { base: '#d9a23a', dark: '#a67a26' };
const RUST_CAPE = '#c2512a';
const DARK_RED = '#8c2a2a';
const LEATHER = '#7a5a3a';
const BOOT = '#3a2a22';
const BROWN_BOOT = '#5a3f2a';

type Make = (palette: Palette) => FigureSpec;

function generic(build: BuildName, palette: Palette, over: Partial<FigureSpec> = {}): FigureSpec {
  return {
    build,
    skin: '#c98a5a',
    hair: DARK_HAIR,
    hairStyle: 'crop',
    garment: { base: palette.base, dark: palette.dark },
    hem: 0.12,
    trousers: { base: palette.dark, dark: shade(palette.dark) },
    shoes: BOOT,
    sash: { color: palette.accent, tails: false },
    collar: 'dark',
    item: 'none',
    headwear: 'none',
    hint: true,
    ...over,
  };
}

/** The heroes, keyed by character id; each read off their reference figure. */
export const HEROES: Readonly<Record<string, Make>> = {
  kaya: (p) =>
    generic('lean', p, {
      skin: '#c98a5a',
      hairStyle: 'ponytail',
      garment: { base: '#a83324', dark: '#6e1f16' },
      hem: 0.1,
      trousers: CHARCOAL,
      sash: { color: p.base, tails: true },
    }),
  tenzo: (p) =>
    generic('broad', p, {
      skin: '#c9a27a',
      hairStyle: 'sweptBack',
      garment: { base: '#b53a2a', dark: '#7a2419' },
      hem: 0.08,
      trousers: CHARCOAL,
      apron: '#3a3532',
      sash: { color: p.base, tails: false },
    }),
  nilak: (p) =>
    generic('robed', p, {
      skin: '#a8703f',
      hairStyle: 'topknot',
      garment: NAVY,
      hem: 0.2,
      trousers: NAVY,
      shoes: BROWN_BOOT,
      sash: { color: p.light, tails: true },
      collar: 'fur',
    }),
  sura: (p) =>
    generic('lean', p, {
      skin: '#8a5a34',
      hairStyle: 'braid',
      garment: { base: '#3f7f87', dark: '#27545a' },
      hem: 0.16,
      trousers: NAVY,
      shoes: '#6b5a48',
      sash: { color: LEATHER, tails: false },
      collar: 'fur',
      waterskin: true,
    }),
  bo: (p) =>
    generic('broad', p, {
      skin: '#c48a5c',
      garment: { base: '#5f8a3f', dark: '#3f5c2a' },
      hem: 0.12,
      sleeves: '#c9a23a',
      trousers: CREAM,
      shoes: BROWN_BOOT,
      sash: { color: '#6b4a2e', tails: true },
    }),
  linmei: (p) =>
    generic('lean', p, {
      skin: '#c9905f',
      hairStyle: 'bobKnot',
      garment: { base: '#3f6b3a', dark: '#2a4826' },
      hem: 0.04,
      undershirt: '#cfd3c0',
      trousers: { base: '#6f7a4a', dark: '#4a5230' },
      sash: { color: LEATHER, tails: true },
      collar: 'none',
    }),
  nima: (p) =>
    generic('lean', p, {
      skin: '#c48a5c',
      hairStyle: 'shaved',
      garment: SAFFRON,
      hem: 0.12,
      cape: RUST_CAPE,
      trousers: CREAM,
      shoes: BROWN_BOOT,
      sash: { color: DARK_RED, tails: true },
      collar: 'none',
    }),
  jinu: (p) =>
    generic('robed', p, {
      skin: '#7b4f31',
      hairStyle: 'buns',
      garment: SAFFRON,
      hem: 0.14,
      cape: RUST_CAPE,
      trousers: CREAM,
      shoes: BROWN_BOOT,
      sash: { color: DARK_RED, tails: true },
      collar: 'none',
    }),
  riko: (p) =>
    generic('lean', p, {
      skin: '#c9905f',
      hairStyle: 'bob',
      garment: { base: '#6b2a3a', dark: '#471c27' },
      hem: 0.1,
      trousers: { base: '#26232a', dark: '#141317' },
      shoes: '#2a2226',
      sash: { color: '#c9382a', tails: true },
      kneeGuards: '#8a8a8a',
      hint: false,
    }),
  wen: (p) =>
    generic('broad', p, {
      skin: '#e8bd93',
      hair: BLOND,
      garment: { base: '#3d5a8a', dark: '#27395a' },
      hem: 0.04,
      undershirt: '#eee6d2',
      trousers: { base: '#2b2a2a', dark: '#171616' },
      shoes: BROWN_BOOT,
      sash: { color: '#6b4a2e', tails: false },
      collar: 'none',
      item: 'gauntlet',
      headwear: 'goggles',
    }),
};

/** Bandits: ragged and asymmetric, a family silhouette a table reads without a legend. */
export const BANDITS: Readonly<Record<string, Make>> = {
  club: (p) =>
    generic('lean', p, {
      skin: '#b07a52',
      hem: 0.08,
      sleeves: '#b07a52',
      trousers: { base: '#5a4a3a', dark: '#3b3026' },
      shoes: '#4a3a2c',
      sash: { color: LEATHER, tails: false },
      collar: 'none',
      item: 'club',
      headwear: 'rag',
      hint: false,
    }),
  sling: (p) =>
    generic('robed', p, {
      skin: '#b07a52',
      garment: { base: '#6b4a3c', dark: '#472f26' },
      hem: 0.22,
      trousers: { base: '#5a4a3a', dark: '#3b3026' },
      shoes: '#4a3a2c',
      sash: null,
      collar: 'none',
      item: 'sling',
      headwear: 'hood',
      hint: false,
    }),
  broad: (p) =>
    generic('broad', p, {
      skin: '#b07a52',
      hairStyle: 'bald',
      hem: 0.08,
      sleeves: '#b07a52',
      trousers: { base: '#5a4a3a', dark: '#3b3026' },
      shoes: '#4a3a2c',
      sash: { color: LEATHER, tails: false },
      collar: 'none',
      item: 'club',
      headwear: 'rag',
      hint: false,
    }),
  // A bandit who bends: the element's palette, a sash, the same rag.
  bender: (p) =>
    generic('lean', p, {
      skin: '#b07a52',
      hairStyle: 'sweptBack',
      hem: 0.1,
      trousers: { base: '#5a4a3a', dark: '#3b3026' },
      shoes: '#4a3a2c',
      collar: 'none',
      headwear: 'rag',
    }),
};

/** Mercenaries: armoured and square, with the sergeant's crest for rank. */
export const MERCENARIES: Readonly<Record<string, Make>> = {
  blade: (p) =>
    generic('broad', p, {
      hem: 0.16,
      trousers: CHARCOAL,
      sash: null,
      collar: 'none',
      item: 'blade',
      headwear: 'helm',
      pauldrons: true,
      hint: false,
    }),
  crossbow: (p) =>
    generic('lean', p, {
      hem: 0.16,
      trousers: CHARCOAL,
      sash: null,
      collar: 'none',
      item: 'crossbow',
      headwear: 'helm',
      pauldrons: true,
      hint: false,
    }),
  sergeant: (p) =>
    generic('broad', p, {
      hem: 0.18,
      trousers: CHARCOAL,
      sash: { color: p.accent, tails: false },
      collar: 'none',
      item: 'blade',
      headwear: 'crest',
      pauldrons: true,
      hint: false,
    }),
};

/** The village: a job each, no element. */
export const VILLAGERS: Readonly<Record<string, Make>> = {
  elder: (p) =>
    generic('robed', p, {
      skin: '#b8865c',
      hair: WHITE_HAIR,
      hairStyle: 'bun',
      hem: 0.26,
      sash: null,
      item: 'staff',
      stoop: 0.12,
      hint: false,
    }),
  shopkeeper: (p) =>
    generic('broad', p, {
      hair: GREY_HAIR,
      hem: 0.14,
      apron: '#e6dcc4',
      headwear: 'cap',
      hint: false,
    }),
  kid: (p) =>
    generic('kid', p, {
      hairStyle: 'pigtails',
      hem: 0.14,
      sash: { color: '#6f9e4c', tails: false },
      hint: false,
    }),
  guard: (p) =>
    generic('lean', p, {
      hem: 0.2,
      item: 'spear',
      headwear: 'helm',
      hint: false,
    }),
};

const TABLES: Readonly<Record<string, Readonly<Record<string, Make>>>> = {
  bender: HEROES,
  bandit: BANDITS,
  mercenary: MERCENARIES,
  villager: VILLAGERS,
};

/**
 * The figure for a painter name and manifest variant. An unknown variant
 * keeps the old build names meaning what they did (`lean`, `broad`, `robed`)
 * and draws the generic figure in the palette.
 */
export function figureFor(
  painter: string,
  variant: string | undefined,
  palette: Palette,
): FigureSpec {
  const make = variant === undefined ? undefined : TABLES[painter]?.[variant];
  if (make) return make(palette);
  const build: BuildName = variant === 'broad' ? 'broad' : variant === 'robed' ? 'robed' : 'lean';
  return generic(build, palette, painter === 'bender' ? {} : { hint: false });
}
