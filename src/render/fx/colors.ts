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
    case 'smoke':
      return SMOKE;
    case 'stone':
      return STONE;
  }
}

/** `#rrggbb` to the number Pixi tints with. */
export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', '').slice(0, 6), 16);
}
