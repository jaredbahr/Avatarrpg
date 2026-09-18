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
import { paintDiscovery } from './discoveries';
import { paintImpact } from './fx';
import { paintPortrait } from './portraits';
import { paintProp } from './props';
import type { PainterOptions, UnitPainter } from './units';
import { UNIT_PAINTERS } from './units';
import type { Box, Ctx } from './shapes';

export interface ResolvedPainter {
  readonly draw: (ctx: Ctx, box: Box, options?: PainterOptions) => void;
  readonly palette: Palette;
  readonly entry: AssetEntry;
  /** Character or silhouette used when a sheet has not loaded. */
  readonly variant?: string;
}

const FALLBACK: UnitPainter = (ctx, box, palette) => {
  ctx.save();
  ctx.fillStyle = palette.base;
  ctx.fillRect(box.x + box.size * 0.25, box.y + box.size * 0.25, box.size * 0.5, box.size * 0.5);
  ctx.restore();
};

/** The stand-in while a bitmap loads: a disc in the entry's own colours, not a grey square. */
const LOADING: UnitPainter = (ctx, box, palette) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(box.x + box.size / 2, box.y + box.size / 2, box.size * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = palette.dark;
  ctx.fill();
  ctx.lineWidth = Math.max(1, box.size * 0.03);
  ctx.strokeStyle = palette.base;
  ctx.stroke();
  ctx.restore();
};

/**
 * Resolves an asset key to something drawable.
 *
 * Image entries are handled by the sprite cache, not here — this returns a
 * painter that draws the placeholder until the image is ready, which is also
 * what gets drawn if the image fails to load. The placeholder takes the
 * entry's palette so the chrome around it is already the right colour.
 */
export function resolvePainter(key: string): ResolvedPainter {
  const entry = resolveAsset(key);

  if (entry.kind === 'image') {
    const palette = paletteFor(entry.palette ?? 'neutral');
    return {
      entry,
      palette,
      draw: (ctx, box, options) => {
        if (key.startsWith('portrait.')) {
          paintPortrait(ctx, box, palette, { variant: key.slice('portrait.'.length) });
        } else if (key.startsWith('prop.')) {
          paintProp(ctx, box, palette, { ...(options ?? {}), variant: key.slice('prop.'.length) });
        } else if (key.startsWith('npc.')) {
          const variant = key === 'npc.dorin' ? 'guard' : key.slice('npc.'.length);
          (UNIT_PAINTERS.villager ?? FALLBACK)(ctx, box, palette, { ...(options ?? {}), variant });
        } else {
          LOADING(ctx, box, palette, options ?? {});
        }
      },
    };
  }

  if (entry.kind === 'sheet') {
    // Keep the character's existing painted figure while the atlas loads or
    // after a failed fetch. Unit keys end in the cast variant by convention.
    const palette = paletteFor(entry.palette);
    const variant = key.slice(key.lastIndexOf('.') + 1);
    const bender =
      (key === 'unit.enemy.crossbow' ? UNIT_PAINTERS.mercenary : UNIT_PAINTERS.bender) ?? FALLBACK;
    return {
      entry,
      palette,
      variant,
      draw: (ctx, box, options) =>
        bender(ctx, box, palette, { ...(options ?? {}), variant: options?.variant ?? variant }),
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

  if (entry.painter === 'discovery') {
    return {
      entry,
      palette,
      draw: (ctx, box, options) =>
        paintDiscovery(ctx, box, palette, { ...(options ?? {}), variant }),
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
    ...(variant !== undefined ? { variant } : {}),
    draw: (ctx, box, options) =>
      painter(ctx, box, palette, { ...(options ?? {}), variant: options?.variant ?? variant }),
  };
}

/** Palette an asset key resolves to, for tinting HUD chrome to match. */
export function paletteForAsset(key: string): Palette {
  return paletteFor(resolveAsset(key).palette ?? 'neutral');
}
