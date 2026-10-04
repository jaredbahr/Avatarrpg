import { describe, expect, it } from 'vitest';
import {
  actorSilhouetteGeometry,
  fallbackBarTop,
  floaterBarGap,
  floaterFontPx,
  floaterOwner,
  floaterStartY,
  floaterVisibleY,
} from './actorSilhouette';
import { paintFloatingNumber } from '../painters/fx';
import type { Ctx } from '../painters/shapes';

const SIZE = 96;
const TEXT_SCALE = 1.4;

/** A canvas context that records where the number's fill is drawn. */
function recorder() {
  const fills: { text: string; x: number; y: number }[] = [];
  const ctx = {
    save() {},
    restore() {},
    strokeText() {},
    fillText(text: string, x: number, y: number) {
      fills.push({ text, x, y });
    },
  } as unknown as Ctx;
  return { ctx, fills };
}

describe('floating number start', () => {
  const cases = [
    // [label, heightTiles, frameHeadroom, width]
    ['a 1x1 sheet unit', 1, 0.62, SIZE],
    ['a 2x2 machine', 2, 1.1, SIZE * 2],
    ['a painter-fallback 1x1 unit (no sheet loaded)', 1, null, SIZE],
    ['a painter-fallback 2x2 unit (no sheet loaded)', 2, null, SIZE * 2],
  ] as const;

  it.each(cases)('sits a fixed small gap above the bar top for %s', (_l, tiles, headroom, w) => {
    const box = { x: 40, y: 200, size: SIZE, width: w };
    const bar = actorSilhouetteGeometry(box, tiles, headroom, 1).bar;
    const start = floaterStartY(bar.y, SIZE, TEXT_SCALE);
    // The glyphs end exactly one gap above the bar's top edge...
    expect(start + floaterFontPx(SIZE, TEXT_SCALE) / 2 + floaterBarGap(SIZE)).toBeCloseTo(bar.y, 9);
    // ...and that gap is small: under a tenth of a tile, never touching the bar.
    expect(floaterBarGap(SIZE)).toBeGreaterThan(0);
    expect(floaterBarGap(SIZE)).toBeLessThan(SIZE * 0.1);
  });

  it('follows the measured silhouette, so a taller figure puts the number higher', () => {
    const box = { x: 0, y: 200, size: SIZE };
    const short = actorSilhouetteGeometry(box, 1, 0.2, 1).bar.y;
    const tall = actorSilhouetteGeometry(box, 1, 0.9, 1).bar.y;
    expect(floaterStartY(tall, SIZE, 1)).toBeLessThan(floaterStartY(short, SIZE, 1));
  });

  it('keeps the gap when the pop grows the glyphs', () => {
    const bar = actorSilhouetteGeometry({ x: 0, y: 200, size: SIZE }, 1, 0.5, 1).bar;
    for (const scale of [0.6 * 1.4, 1.4, 1.3 * 1.4, 1.5 * 1.4]) {
      const bottom = floaterStartY(bar.y, SIZE, scale) + floaterFontPx(SIZE, scale) / 2;
      expect(bar.y - bottom).toBeCloseTo(floaterBarGap(SIZE), 9);
    }
  });

  it('uses the painter-fallback bar for a just-defeated target that left the view', () => {
    const tile = { x: 40, y: 200, size: SIZE };
    const top = fallbackBarTop(tile);
    expect(top).toBe(actorSilhouetteGeometry(tile, 1, null, 1).bar.y);
    const start = floaterStartY(top, SIZE, TEXT_SCALE);
    expect(top - (start + floaterFontPx(SIZE, TEXT_SCALE) / 2)).toBeCloseTo(floaterBarGap(SIZE), 9);
  });

  it('is drawn at that y at progress 0 and rises from it (Canvas painter)', () => {
    const bar = actorSilhouetteGeometry({ x: 40, y: 200, size: SIZE }, 1, 0.62, 1).bar;
    const start = floaterStartY(bar.y, SIZE, TEXT_SCALE);
    const first = recorder();
    paintFloatingNumber(
      first.ctx,
      { x: 40, y: 500, size: SIZE },
      '7',
      '#fff',
      0,
      TEXT_SCALE,
      start,
    );
    // The painter ignores the tile box's y: only the bar-derived start counts.
    expect(first.fills[0]?.y).toBe(start);
    const later = recorder();
    paintFloatingNumber(
      later.ctx,
      { x: 40, y: 500, size: SIZE },
      '7',
      '#fff',
      0.5,
      TEXT_SCALE,
      start,
    );
    expect(later.fills[0]?.y).toBeCloseTo(start - 0.5 * SIZE * 0.35, 9);
  });
});

describe('floater on a top-edge target', () => {
  it('rests just inside the canvas top instead of being clipped away', () => {
    const font = floaterFontPx(SIZE, TEXT_SCALE);
    expect(floaterVisibleY(-40, 0, font)).toBe(font / 2 + 2);
    // Fully on the board, the start is left exactly where the bar put it.
    expect(floaterVisibleY(300, 0, font)).toBe(300);
    // Pixi's top edge is the camera offset in world units.
    expect(floaterVisibleY(10, 25, font)).toBe(25 + font / 2 + 2);
  });
});

describe('floater owner', () => {
  const units = [
    { id: 'a', pos: { x: 2, y: 3 }, size: 1 as const },
    { id: 'boss', pos: { x: 5, y: 5 }, size: 2 as const },
  ];

  it('matches a 1x1 unit on its tile and a 2x2 unit on its inset centre', () => {
    expect(floaterOwner(units, { x: 2, y: 3 }, true)?.id).toBe('a');
    expect(floaterOwner(units, { x: 5.5, y: 5.5 }, true)?.id).toBe('boss');
    expect(floaterOwner(units, { x: 5, y: 5 }, false)?.id).toBe('boss');
  });

  it('finds nothing for a target no longer in the view', () => {
    expect(floaterOwner(units, { x: 9, y: 9 }, true)).toBeUndefined();
  });
});
