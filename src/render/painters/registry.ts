/**
 * Painter lookup.
 *
 * The asset manifest in `src/content` names painters as strings; this is where
 * those strings become functions. Keeping the indirection means content never
 * imports render code, and pointing a manifest entry at an image URL instead
 * bypasses this file entirely.
 */

import type { AssetEntry } from '../../content/assets/manifest';
import { resolveAsset } from '../../content/assets/manifest';
import type { Palette } from '../palettes';
import { paletteFor } from '../palettes';
import { paintImpact } from './fx';
import { paintGlyph } from './glyphs';
import { paintPortrait } from './portraits';
import { paintProp } from './props';
import type { PainterOptions, UnitPainter } from './units';
import { UNIT_PAINTERS } from './units';
import type { Box, Ctx } from './shapes';

export interface ResolvedPainter {
  readonly draw: (ctx: Ctx, box: Box, options?: PainterOptions) => void;
  readonly palette: Palette;
  readonly entry: AssetEntry;
}

const FALLBACK: UnitPainter = (ctx, box, palette) => {
  ctx.save();
  ctx.fillStyle = palette.base;
  ctx.fillRect(box.x + box.size * 0.25, box.y + box.size * 0.25, box.size * 0.5, box.size * 0.5);
  ctx.restore();
};

/**
 * Resolves an asset key to something drawable.
 *
 * Image entries are handled by the sprite cache, not here — this returns a
 * painter that draws the placeholder until the image is ready, which is also
 * what gets drawn if the image fails to load.
 */
export function resolvePainter(key: string): ResolvedPainter {
  const entry = resolveAsset(key);

  if (entry.kind === 'image') {
    return {
      entry,
      palette: paletteFor('neutral'),
      draw: (ctx, box, options) => FALLBACK(ctx, box, paletteFor('neutral'), options ?? {}),
    };
  }

  const palette = paletteFor(entry.palette);
  const variant = entry.variant;

  if (entry.painter === 'portrait') {
    return {
      entry,
      palette,
      draw: (ctx, box, options) =>
        paintPortrait(ctx, box, palette, { variant: options?.variant ?? variant }),
    };
  }

  if (entry.painter === 'impact') {
    return {
      entry,
      palette,
      draw: (ctx, box, options) =>
        paintImpact(ctx, box, palette, { variant: options?.variant ?? variant }),
    };
  }

  if (entry.painter === 'glyph') {
    return {
      entry,
      palette,
      draw: (ctx, box, options) =>
        paintGlyph(ctx, box, palette, { variant: options?.variant ?? variant }),
    };
  }

  if (entry.painter === 'prop') {
    return {
      entry,
      palette,
      draw: (ctx, box, options) =>
        paintProp(ctx, box, palette, { ...(options ?? {}), variant: options?.variant ?? variant }),
    };
  }

  const painter = UNIT_PAINTERS[entry.painter] ?? FALLBACK;
  return {
    entry,
    palette,
    draw: (ctx, box, options) =>
      painter(ctx, box, palette, { ...(options ?? {}), variant: options?.variant ?? variant }),
  };
}

/** Palette an asset key resolves to, for tinting HUD chrome to match. */
export function paletteForAsset(key: string): Palette {
  const entry = resolveAsset(key);
  return entry.kind === 'painter' ? paletteFor(entry.palette) : paletteFor('neutral');
}
