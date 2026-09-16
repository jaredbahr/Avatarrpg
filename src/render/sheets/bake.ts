/**
 * Placeholder sheets, baked from the painters.
 *
 * Until a unit has generated art, its painter is asked for every pose the
 * clip table names and the results are laid out into an atlas of exactly
 * the shape a real sheet has (ADR 0003). Both backends and the clip runtime
 * therefore run one code path from the first day; real sheets replace baked
 * ones key by key with no other change.
 *
 * A painter that does not know poses yet draws the same figure into every
 * frame, which is today's look; `PainterOptions.pose` is how a painter that
 * does know them (the cel-shaded figures) tells them apart.
 */

import type { ClipDef, ClipName } from '../../content/assets/clips';
import type { ResolvedPainter } from '../painters/registry';
import type { AtlasFrame } from './atlasJson';
import { layoutSheet } from './layout';

/** A frame is one and a half tiles tall: the head overlaps the tile above. */
export const FRAME_HEIGHT_TILES = 1.5;
/** Where the feet stand, as a fraction of the tile's height from its top. */
export const FOOT_LINE = 0.85;
/** The painters put their ground shadow here, as a fraction of their square box. */
const PAINTER_FOOT = 0.86;

/** Poses a baked sheet carries: the full clip table, so every fallback is exercised. */
export const BAKED_CLIPS: Readonly<
  Record<ClipName, { count: number; fps: number; loop: boolean }>
> = {
  idle: { count: 2, fps: 1, loop: true },
  walk: { count: 2, fps: 4, loop: true },
  cast: { count: 3, fps: 8, loop: false },
  melee: { count: 2, fps: 8, loop: false },
  hit: { count: 1, fps: 1, loop: false },
  ko: { count: 1, fps: 1, loop: false },
};

export interface BakedSheet {
  readonly canvas: HTMLCanvasElement;
  readonly frames: ReadonlyMap<string, AtlasFrame>;
  readonly clips: Partial<Record<ClipName, ClipDef>>;
  readonly pixelsPerTile: number;
  readonly footprint: { readonly w: number; readonly h: number };
  readonly anchor: { readonly x: number; readonly y: number };
  /** Bytes of canvas the sheet holds, for the store's budget. */
  readonly bytes: number;
}

/**
 * The square box a painter draws in, placed inside a frame so its feet land
 * on the foot line: `0.85` of the frame's height is where the anchor sits,
 * and the painter's own foot is `0.86` of its box.
 */
export function painterBox(
  frame: AtlasFrame,
  pixelsPerTile: number,
): { x: number; y: number; size: number } {
  return {
    x: frame.x,
    y: frame.y + FOOT_LINE * frame.h - PAINTER_FOOT * pixelsPerTile,
    size: pixelsPerTile,
  };
}

/**
 * Bakes every pose of `painter` for `key` at `pixelsPerTile` device pixels a
 * tile. `widthTiles` is 2 for the boss. Returns null where there is no
 * document to draw into (the tests).
 */
export function bakeSheet(
  key: string,
  painter: ResolvedPainter,
  pixelsPerTile: number,
  widthTiles: 1 | 2,
): BakedSheet | null {
  if (typeof document === 'undefined') return null;
  const frameWidth = Math.round(pixelsPerTile * widthTiles);
  const frameHeight = Math.round(pixelsPerTile * FRAME_HEIGHT_TILES);
  const counts: Partial<Record<ClipName, number>> = {};
  for (const [clip, def] of Object.entries(BAKED_CLIPS) as [ClipName, { count: number }][]) {
    counts[clip] = def.count;
  }
  const layout = layoutSheet(key, counts, frameWidth, frameHeight, 4096, 4096);

  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const variant = painter.entry.kind === 'painter' ? painter.entry.variant : undefined;
  const clips: Partial<Record<ClipName, ClipDef>> = {};
  for (const [clip, names] of Object.entries(layout.clips) as [ClipName, string[]][]) {
    const timing = BAKED_CLIPS[clip];
    clips[clip] = { frames: names, fps: timing.fps, loop: timing.loop };
    names.forEach((name, index) => {
      const frame = layout.frames.get(name);
      if (!frame) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(frame.x, frame.y, frame.w, frame.h);
      ctx.clip();
      painter.draw(ctx, painterBox(frame, pixelsPerTile), {
        ...(variant !== undefined ? { variant } : {}),
        facing: 1,
        pose: { clip, index },
      });
      ctx.restore();
    });
  }

  return {
    canvas,
    frames: layout.frames,
    clips,
    pixelsPerTile,
    footprint: { w: widthTiles, h: 1 },
    anchor: { x: 0.5, y: FOOT_LINE },
    bytes: layout.width * layout.height * 4,
  };
}
