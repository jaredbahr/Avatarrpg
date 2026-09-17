/**
 * Colour.
 *
 * Kept in one place and mirrored against the CSS custom properties in
 * `styles/base.css`, so a unit drawn on the canvas and its card in the HUD are
 * the same red. The canvas cannot read CSS variables cheaply per frame, hence
 * the duplication — if you change one, change both.
 */

import type { ElementId, StatusId, SurfaceId, TerrainId } from '../core/types';

export interface Palette {
  readonly base: string;
  readonly light: string;
  readonly dark: string;
  readonly accent: string;
  readonly ink: string;
}

const palette = (
  base: string,
  light: string,
  dark: string,
  accent: string,
  ink = '#1b1410',
): Palette => ({
  base,
  light,
  dark,
  accent,
  ink,
});

export const ELEMENT_PALETTES: Record<ElementId, Palette> = {
  fire: palette('#d1462f', '#f0785c', '#8c2416', '#ffb27a'),
  water: palette('#3e8fb0', '#7ec8e3', '#22566e', '#cdeefb'),
  earth: palette('#6f9e4c', '#a8c686', '#456330', '#e0e8b0'),
  air: palette('#e8dcc0', '#fdf6e3', '#9a8e72', '#fffdf5'),
  nonbender: palette('#9b7bb8', '#c3a8d8', '#5f4677', '#e9dcf5'),
};

export const NEUTRAL_PALETTE: Palette = palette('#8d7d69', '#bfae97', '#4a3a2c', '#f4e9d8');
export const ENEMY_PALETTE: Palette = palette('#8a4b3c', '#b8705c', '#4d241b', '#e5a48c');

export function paletteFor(key: string): Palette {
  switch (key) {
    case 'fire':
    case 'water':
    case 'earth':
    case 'air':
    case 'nonbender':
      return ELEMENT_PALETTES[key];
    case 'enemy':
      return ENEMY_PALETTE;
    default:
      return NEUTRAL_PALETTE;
  }
}

/* ------------------------------------------------------------------ */
/* Terrain                                                             */
/* ------------------------------------------------------------------ */

export interface TerrainStyle {
  readonly fill: string;
  readonly edge: string;
  /** Flecks, grain, cobbles — drawn deterministically from the tile position. */
  readonly detail: string;
}

export const TERRAIN_STYLES: Record<TerrainId, TerrainStyle> = {
  grass: { fill: '#41552f', edge: '#35471f', detail: '#55693c' },
  dirt: { fill: '#4d3f2f', edge: '#3d3124', detail: '#5d4d3a' },
  road: { fill: '#5b5044', edge: '#4a4036', detail: '#6b6053' },
  stone: { fill: '#565452', edge: '#434140', detail: '#666461' },
  sand: { fill: '#8a7548', edge: '#75623c', detail: '#9c8657' },
  wood: { fill: '#6b4f33', edge: '#573f28', detail: '#7d5e3d' },
  water_deep: { fill: '#1f4a5e', edge: '#173b4c', detail: '#2a5e77' },
  wall: { fill: '#3a352f', edge: '#26221e', detail: '#4a443c' },
  pit: { fill: '#14100c', edge: '#0b0906', detail: '#1d1813' },
};

/* ------------------------------------------------------------------ */
/* Surfaces                                                            */
/* ------------------------------------------------------------------ */

export interface SurfaceStyle {
  readonly fill: string;
  /** Alpha for the wash over the terrain, 0-1. */
  readonly alpha: number;
  readonly edge: string;
  /** Pattern used when the colourblind "hatch" setting is on. */
  readonly hatch: 'none' | 'diagonal' | 'cross' | 'dots' | 'wave' | 'vertical';
  readonly label: string;
}

export const SURFACE_STYLES: Record<SurfaceId, SurfaceStyle> = {
  water: { fill: '#3e8fb0', alpha: 0.55, edge: '#7ec8e3', hatch: 'wave', label: 'Water' },
  ice: { fill: '#bfe8f5', alpha: 0.6, edge: '#ffffff', hatch: 'diagonal', label: 'Ice' },
  fire: { fill: '#e0521f', alpha: 0.7, edge: '#ffb648', hatch: 'vertical', label: 'Fire' },
  mud: { fill: '#5a4326', alpha: 0.7, edge: '#7c5d33', hatch: 'dots', label: 'Mud' },
  steam: { fill: '#d9d9d9', alpha: 0.72, edge: '#ffffff', hatch: 'cross', label: 'Steam' },
  oil: { fill: '#14120f', alpha: 0.72, edge: '#3d3a2f', hatch: 'diagonal', label: 'Oil' },
  rubble: { fill: '#6e6a63', alpha: 0.65, edge: '#8d887f', hatch: 'dots', label: 'Rubble' },
};

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

export const OVERLAY = {
  move: 'rgba(126, 200, 227, 0.30)',
  moveEdge: 'rgba(200, 240, 255, 0.85)',
  target: 'rgba(226, 88, 74, 0.32)',
  targetEdge: 'rgba(255, 150, 130, 0.9)',
  area: 'rgba(240, 198, 116, 0.34)',
  areaEdge: 'rgba(255, 224, 160, 0.95)',
  active: 'rgba(240, 198, 116, 0.95)',
  hostile: 'rgba(226, 88, 74, 0.9)',
  friendly: 'rgba(126, 200, 227, 0.9)',
  path: 'rgba(255, 255, 255, 0.8)',
  pathUnder: 'rgba(18, 13, 10, 0.55)',
  hover: 'rgba(255, 255, 255, 0.18)',
  /** The wide faint stroke under a contour's crisp edge, in tiles and alpha. */
  softWidth: 0.3,
  softAlpha: 0.28,
  edgeWidth: 0.05,
} as const;

/** Ring drawn under a unit, so faction is readable without reading names. */
export const FACTION_RING: Record<'party' | 'enemy' | 'ally', string> = {
  party: OVERLAY.friendly,
  ally: 'rgba(160, 220, 170, 0.9)',
  enemy: OVERLAY.hostile,
};

/** Short badges drawn under a unit so statuses are visible without a tooltip. */
export const STATUS_BADGE: Record<StatusId, { letter: string; color: string }> = {
  burning: { letter: 'B', color: '#e0521f' },
  wet: { letter: 'W', color: '#3e8fb0' },
  chilled: { letter: 'C', color: '#9fd8ea' },
  frozen: { letter: 'F', color: '#cdeefb' },
  shocked: { letter: 'S', color: '#f0c674' },
  stunned: { letter: '!', color: '#f0c674' },
  slowed: { letter: '↓', color: '#bfae97' },
  blinded: { letter: '●', color: '#8d7d69' },
  rooted: { letter: 'R', color: '#7c5d33' },
  chiBlocked: { letter: 'X', color: '#c3a8d8' },
  guarded: { letter: '■', color: '#6fbf73' },
  inspired: { letter: '★', color: '#f0c674' },
};

export const HP_COLORS = {
  high: '#6fbf73',
  mid: '#e0b23c',
  low: '#e2584a',
  back: 'rgba(0,0,0,0.55)',
} as const;

export function hpColor(fraction: number): string {
  if (fraction > 0.6) return HP_COLORS.high;
  if (fraction > 0.3) return HP_COLORS.mid;
  return HP_COLORS.low;
}
