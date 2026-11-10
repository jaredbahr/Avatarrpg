/**
 * The runtime props are seated (#459; ADR 0104's 2026-11-07 amendment): every top-down prop drawing,
 * standing where the runtime stands it with the shadow the runtime lays under it, passes the same
 * seating rule as the baked boards (`seatingTable`, through `seatingCheck`), on grass and on cobble
 * (the Wang set's pure tiles). The rule also fails what it must: a 3 px hover and a 1 px gap.
 */
import { describe, expect, it } from 'vitest';
import { readPng } from '../lib/image';
import type { RgbaImage } from '../../../src/render/shadow/hardShadowMask';
import {
  objectShadowMask,
  PAVED_SHADOW_SCALE,
  shadowLayer,
} from '../../../src/render/topdown/objectShadow';
import {
  TOPDOWN_OBJECTS,
  TOPDOWN_PROPS as PROPS_ONLY,
  topdownPropBox,
} from '../../../src/render/topdown/props';

/** Every runtime drawing: the props and the raised wall and rubble (#577). */
const TOPDOWN_PROPS = { ...PROPS_ONLY, ...TOPDOWN_OBJECTS };
import { packProps, PROP_SOURCES } from './pack-props';
import { seatingCheck } from './ground-checks';

const rgba = (path: string): RgbaImage => {
  const img = readPng(path);
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
};

/** A 3x3-cell patch (120 px) tiled from one pure 32 px Wang tile. */
function patch(tile: string): RgbaImage {
  const t = rgba(`prototypes/topdown/assets/tiles/gc32/${tile}.png`);
  const W = 120,
    H = 120,
    data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const s = ((y % t.height) * t.width + (x % t.width)) * 4,
        d = (y * W + x) * 4;
      for (let c = 0; c < 4; c++) data[d + c] = t.data[s + c] ?? 0;
    }
  return { width: W, height: H, data };
}

const GROUNDS = { grass: patch('c0000'), cobble: patch('c1111') };
const SCALES = { grass: 1, cobble: PAVED_SHADOW_SCALE };
const sprite = (name: string): RgbaImage => rgba(`public/art/topdown/props/${name}.png`);

describe('the shipped prop drawings', () => {
  it('are what pack-props packs, one per mapped prop, with hard alpha', () => {
    const files = packProps();
    expect([...files.keys()].sort()).toEqual(
      Object.values(TOPDOWN_PROPS)
        .map((s) => `public/art/topdown/props/${s.name}.png`)
        .sort(),
    );
    for (const s of Object.values(TOPDOWN_PROPS)) {
      expect(PROP_SOURCES[s.name], s.name).toBeDefined();
      const img = sprite(s.name);
      expect([img.width, img.height], s.name).toEqual([s.w, s.h]);
      for (let i = 3; i < img.data.length; i += 4) expect([0, 255]).toContain(img.data[i]);
    }
  });
});

describe('every runtime prop is seated', () => {
  for (const [id, s] of Object.entries(TOPDOWN_PROPS))
    for (const ground of ['grass', 'cobble'] as const)
      it(`${id} on ${ground}`, () => {
        const img = sprite(s.name);
        const box = topdownPropBox({ x: 1, y: 1 }, s);
        const row = seatingCheck(
          img,
          objectShadowMask(img),
          { x: box.x, y: box.y },
          GROUNDS[ground],
          SCALES[ground],
        );
        expect(row.foot, 'foot columns measured').toBeGreaterThan(0);
        expect(row.gap, '(a) ground between foot and shadow').toEqual([]);
        expect(row.weak, '(b) contact under 25 % darker').toEqual([]);
        expect(row.loose, '(c) cast cut off from the contact').toBe(0);
        expect(row.hover, '(d) hover').toBeLessThanOrEqual(1);
      });

  it('the runtime layer lays exactly the mask the check measured', () => {
    const img = sprite('rain_barrel');
    const mask = objectShadowMask(img);
    const layer = shadowLayer([{ x: 10, y: 20, mask }]);
    expect(layer).not.toBeNull();
    if (!layer) return;
    expect([layer.x, layer.y]).toEqual([10 - mask.pad, 20]);
    for (let i = 0; i < mask.alpha.length; i++)
      expect(layer.image.data[i * 4 + 3]).toBe(mask.alpha[i]);
  });
});

describe('the seating rule fails a badly seated object', () => {
  const img = sprite('rain_barrel');
  const at = { x: 40, y: 40 };

  it('a 3 px hover', () => {
    // The same barrel with three clear rows under it: its shadow drawn for the canvas base.
    const H = img.height + 3,
      data = new Uint8ClampedArray(img.width * H * 4);
    data.set(img.data);
    const hovering = { width: img.width, height: H, data };
    const row = seatingCheck(hovering, objectShadowMask(img), at, GROUNDS.grass);
    expect(row.hover).toBe(3);
  });

  it('a 1 px gap between the foot and its shadow', () => {
    const row = seatingCheck(img, objectShadowMask(img), at, GROUNDS.grass, 1, { x: 0, y: 1 });
    expect(row.gap.length).toBeGreaterThan(0);
  });
});
