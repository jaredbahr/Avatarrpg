/**
 * Colour roles to colours.
 *
 * A recipe names roles (`base`, `light`, `accent`...) and the palette key the
 * roles resolve through, so the renderer looks the hex up here at draw time
 * and the palette stays in the three places it already lives.
 */

import type { FxColor } from '../../content/fx';
import type { Palette } from '../palettes';
import { paletteFor } from '../palettes';

const SMOKE = '#7a736a';
const STONE = '#a39c91';
const WHITE = '#ffffff';
const SHALLOWS = '#a8d7df';
const MOSS = '#8e9d45';
const STRAW = '#c1a650';

export function roleColor(role: FxColor, paletteKey: string): string {
  const palette: Palette = paletteFor(paletteKey);
  switch (role) {
    case 'base':
      return palette.base;
    case 'light':
      return palette.light;
    case 'dark':
      return palette.dark;
    case 'accent':
      return palette.accent;
    case 'ink':
      return palette.ink;
    case 'white':
      return WHITE;
    case 'shallows':
      return SHALLOWS;
    case 'moss':
      return MOSS;
    case 'straw':
      return STRAW;
    case 'smoke':
      return SMOKE;
    case 'stone':
      return STONE;
  }
}

/**
 * Palettes of light: fire, water and air glow or catch the light, so their
 * particles and strokes carry no dark ink (ADR 0086). Earth and everything
 * else keep it.
 */
export function inkedPalette(paletteKey: string): boolean {
  return paletteKey !== 'fire' && paletteKey !== 'water' && paletteKey !== 'air';
}

/** `#rrggbb` to the number Pixi tints with. */
export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', '').slice(0, 6), 16);
}
