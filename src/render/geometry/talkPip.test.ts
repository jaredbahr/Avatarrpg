import { describe, expect, it } from 'vitest';
import { TALK_PIP_GAP, talkPipPosition, visiblePixelBounds } from './talkPip';
import { TILE } from '../camera';
import { TALK_PIP_RADIUS, talkPipMark } from '../pixelOverlayGeometry';
import { placePixelMark, rasterizePixelMark, snapWorldPoints } from '../pixelMarks';

describe('NPC talk pip placement', () => {
  it('clears visible art with the unchanged four-world-pixel raster after anchor snapping', () => {
    const bounds = { left: -0.25, top: -0.85, right: 0.35, bottom: 0 };
    const foot = { x: 100.3, y: 200.4 };
    const scale = TILE * 1.25 * 0.97;
    const lean = -0.07;
    const gap = TALK_PIP_GAP;
    const pip = talkPipPosition(foot, bounds, scale, lean, TALK_PIP_RADIUS, gap, -1);
    const anchor = snapWorldPoints([pip])[0];
    if (!anchor) throw new Error('Missing snapped talk anchor');
    const mark = talkPipMark(anchor, 1);
    expect(mark.spec.operations).toEqual([
      { kind: 'circle', color: 'gold', centre: { x: 0, y: 0 }, radius: 4, fill: true },
    ]);
    const raster = rasterizePixelMark(mark.spec);
    const placement = placePixelMark(raster, anchor);
    const artTop = Math.min(
      ...[bounds.left, bounds.right].flatMap((x) =>
        [bounds.top, bounds.bottom].map(
          (y) => foot.y + scale * (-x * Math.sin(lean) + y * Math.cos(lean)),
        ),
      ),
    );
    let solid = 0;
    for (let y = 0; y < raster.height; y++)
      for (let x = 0; x < raster.width; x++) {
        if (!raster.data[(y * raster.width + x) * 4 + 3]) continue;
        solid++;
        expect(placement.y + y + 1).toBeLessThan(artTop);
      }
    expect(solid).toBeGreaterThan(0);
    // Canvas performs the same placement in screen space before returning to board pixels.
    for (const zoom of [1, 2, 3]) {
      const screen = talkPipPosition(
        { x: foot.x * zoom, y: foot.y * zoom },
        bounds,
        scale * zoom,
        lean,
        TALK_PIP_RADIUS * zoom,
        gap * zoom,
        -1,
      );
      expect(screen.x / zoom).toBeCloseTo(pip.x, 10);
      expect(screen.y / zoom).toBeCloseTo(pip.y, 10);
    }
  });

  it('keeps the cue horizontally stable as a small lean changes direction', () => {
    const bounds = { left: -0.3, top: -1, right: 0.3, bottom: 0 };
    const left = talkPipPosition({ x: 100, y: 100 }, bounds, 100, -0.00001, 7, 4);
    const right = talkPipPosition({ x: 100, y: 100 }, bounds, 100, 0.00001, 7, 4);
    expect(Math.abs(left.x - right.x)).toBeLessThan(0.01);
    expect(left.y + 7 + 4).toBeLessThanOrEqual(0);
    expect(right.y + 7 + 4).toBeLessThanOrEqual(0);
  });

  it('ignores transparent padding and keeps differing silhouettes above their own tops', () => {
    const pixels = new Uint8ClampedArray(10 * 12 * 4);
    pixels[(3 * 10 + 4) * 4 + 3] = 255;
    pixels[(8 * 10 + 6) * 4 + 3] = 255;
    expect(visiblePixelBounds(pixels, 10, 12)).toEqual({ left: 4, top: 3, right: 7, bottom: 9 });
    const short = talkPipPosition(
      { x: 0, y: 0 },
      { left: -0.2, top: -0.7, right: 0.2, bottom: 0 },
      1,
      0,
      0.07,
      0.04,
    );
    const tall = talkPipPosition(
      { x: 0, y: 0 },
      { left: -0.2, top: -1.4, right: 0.2, bottom: 0 },
      1,
      0,
      0.07,
      0.04,
    );
    expect(short.y).toBeCloseTo(-0.81);
    expect(tall.y).toBeCloseTo(-1.51);
  });

  it('uses the full frame for empty art and excludes alpha 8 while including alpha 9', () => {
    const pixels = new Uint8ClampedArray(4 * 3 * 4);
    pixels[3] = 8;
    pixels[(2 * 4 + 3) * 4 + 3] = 9;

    expect(visiblePixelBounds(new Uint8ClampedArray(4 * 3 * 4), 4, 3)).toEqual({
      left: 0,
      top: 0,
      right: 4,
      bottom: 3,
    });
    expect(visiblePixelBounds(pixels, 4, 3)).toEqual({ left: 3, top: 2, right: 4, bottom: 3 });
  });

  it('keeps marker clearance conservative when bounds fall back to a full frame', () => {
    const fullFrame = visiblePixelBounds(new Uint8ClampedArray(8 * 12 * 4), 8, 12);
    // Source pixels become foot-relative bounds before marker placement, as in
    // both renderers. Here the foot is at the bottom centre of the empty frame.
    const bounds = {
      left: fullFrame.left - 4,
      top: fullFrame.top - 12,
      right: fullFrame.right - 4,
      bottom: fullFrame.bottom - 12,
    };
    const position = talkPipPosition({ x: 10, y: 20 }, bounds, 1, 0, 1, 0.5);

    expect(position.y + 1 + 0.5).toBeLessThanOrEqual(20 + bounds.top);
    expect(position.y).toBe(6.5);
  });

  it('includes actor scale, pose scale, offsets in the foot, lean, radius and gap', () => {
    const base = talkPipPosition(
      { x: 3, y: 8 },
      { left: -0.3, top: -1, right: 0.3, bottom: 0 },
      1,
      0,
      0.07,
      0.04,
    );
    const enlarged = talkPipPosition(
      { x: 3, y: 7.5 },
      { left: -0.3, top: -1, right: 0.3, bottom: 0 },
      1.5,
      0,
      0.07,
      0.04,
    );
    const offset = talkPipPosition(
      { x: 5, y: 6 },
      { left: -0.3, top: -1, right: 0.3, bottom: 0 },
      1,
      0,
      0.07,
      0.04,
    );
    const leaning = talkPipPosition(
      { x: 3, y: 8 },
      { left: -0.3, top: -1, right: 0.3, bottom: 0 },
      1,
      0.25,
      0.07,
      0.04,
    );
    expect(base.x).toBe(3);
    expect(base.y).toBeCloseTo(6.89, 8);
    expect(enlarged.x).toBe(3);
    expect(enlarged.y).toBeCloseTo(5.89, 8);
    expect(offset.x).toBe(5);
    expect(offset.y).toBeCloseTo(4.89, 8);
    const c = Math.cos(0.25);
    const s = Math.sin(0.25);
    const highest = Math.min(...[-0.3, 0.3].flatMap((x) => [-1, 0].map((y) => 8 + x * s + y * c)));
    expect(leaning.y).toBeCloseTo(highest - 0.11, 8);
    expect(leaning.y + 0.07 + 0.04).toBeCloseTo(highest, 8);
  });

  it('mirrors asymmetric art before applying lean, matching the renderer transform', () => {
    const bounds = { left: -0.1, top: -1.2, right: 0.5, bottom: -0.2 };
    const scale = 1.3;
    const lean = 0.3;
    const radius = 0.08;
    const gap = 0.05;
    const position = talkPipPosition({ x: 2, y: 4 }, bounds, scale, lean, radius, gap, -1);
    const c = Math.cos(lean);
    const s = Math.sin(lean);
    const highest = Math.min(
      ...[bounds.left, bounds.right].flatMap((x) =>
        [bounds.top, bounds.bottom].map((y) => 4 + scale * (-x * s + y * c)),
      ),
    );
    expect(position.y).toBeCloseTo(highest - radius - gap, 8);
    expect(position.y + radius + gap).toBeCloseTo(highest, 8);
  });
});
