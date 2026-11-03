/**
 * Every prop meets the ground with no gap (ADR 0093): under each column's
 * lowest opaque pixel, the next pixel down is shadow — the prop's own cast
 * (`groundedCast`, which starts at its base) or its contact line — for every
 * prop the game ships, on the key of every scene that can hold it.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { PROPS } from '../content/props';
import { ASSETS } from '../content/assets/manifest';
import { FOOT_LINE } from './sheets/bake';
import {
  CAST_PER_PIXEL,
  CONTACT_LINE,
  footprintSpan,
  groundProfile,
  groundedCast,
  projectShadowPoint,
} from './lighting';
import { FOREST_ROAD_SCENE } from '../content/scenes/forestRoad';

const art = (rows: string[]) => ({
  alpha: (x: number, y: number) => (rows[y]?.[x] === '#' ? 255 : 0),
  width: Math.max(...rows.map((r) => r.length)),
  height: rows.length,
});

describe('a prop stands on the hull of its bottom edge', () => {
  it("puts a box's base edges on the ground (a V is its own hull)", () => {
    const box = art(['#######', '#######', '#######', '.#####.', '..###..', '...#...']);
    expect([...groundProfile(box.alpha, box.width, box.height)]).toEqual([2, 3, 4, 5, 4, 3, 2]);
  });

  it("stands a tripod's bowl above the line between its feet", () => {
    const tripod = art(['#####', '#####', '#...#', '#...#']);
    expect([...groundProfile(tripod.alpha, tripod.width, tripod.height)]).toEqual([3, 3, 3, 3, 3]);
  });

  it("does not stand a signpost on its arm's tip when it knows the footprint", () => {
    // A post at column 4 with an arm out to column 0 near the top; the footprint's ground is rows 5 to 7.
    const sign = art(['#####', '#####', '....#', '....#', '....#', '....#', '....#']);
    const feet = () => ({ top: 5, bottom: 7 });
    const free = groundProfile(sign.alpha, sign.width, sign.height);
    const footed = groundProfile(sign.alpha, sign.width, sign.height, 128, feet);
    // Without the footprint the arm's tip is a hull vertex and stands on its own bottom.
    expect(free[0]).toBe(1);
    // With it the arm stands over the ground the post stands on.
    expect([...footed]).toEqual([6, 6, 6, 6, 6]);
  });

  it('spans a footprint diamond column by column', () => {
    // One cell, ground corners (0,0) (2,1) (0,2) (-2,1) in art px around x = 2: a 4 x 2 diamond.
    const span = footprintSpan([{ x: 0, y: 0 }], (p) => ({
      x: 2 + (p.x - p.y) * 2,
      y: (p.x + p.y) * 1,
    }));
    expect(span(1)).toEqual({ top: 0.25, bottom: 1.75 });
    expect(span(10)).toBeNull();
  });

  it('casts down-right from the base, the base row its own cast', () => {
    const post = art(['.#.', '.#.', '.#.', '.#.', '.#.']);
    const cast = groundedCast(post.alpha, post.width, post.height, { x: 0.5, y: 0.25 });
    const at = (x: number, y: number) => cast.mask[y * cast.width + x];
    expect(at(1, 4)).toBe(1); // the foot
    expect(at(3, 5)).toBe(1); // the top, 4 px up: 2 right and 1 down
    expect(at(0, 4)).toBe(0); // nothing toward the light
  });
});

describe('every shipped prop meets the ground with no gap', () => {
  const sprites = new Set(PROPS.map((p) => p.sprite));
  const files = readdirSync(new URL('../../public/art/props/', import.meta.url)).filter((f) =>
    f.endsWith('.png'),
  );
  const shipped = [...sprites].map((sprite) => {
    const entry = ASSETS[sprite as keyof typeof ASSETS] as
      { kind: string; url?: string } | undefined;
    return { sprite, file: entry?.kind === 'image' ? entry.url?.split('/').pop() : undefined };
  });

  it('draws every prop from an image under public/art/props', () => {
    for (const { sprite, file } of shipped) {
      expect(file, sprite).toBeDefined();
      expect(files, sprite).toContain(file);
    }
  });

  for (const { sprite, file } of shipped) {
    if (!file) continue;
    for (const key of [CAST_PER_PIXEL, { x: 0.35, y: 0.16 }])
      it(`${sprite} on key ${key.x},${key.y}`, () => {
        const png = PNG.sync.read(
          readFileSync(new URL(`../../public/art/props/${file}`, import.meta.url)),
        );
        const alpha = (x: number, y: number) => png.data[(y * png.width + x) * 4 + 3] ?? 0;
        const cast = groundedCast(alpha, png.width, png.height, key);
        // One tile is 64 world px; the contact line is CONTACT_LINE world px under the silhouette.
        const contactRows = Math.round((CONTACT_LINE * png.width) / 64);
        const base = groundProfile(alpha, png.width, png.height);
        let columns = 0;
        for (let x = 0; x < png.width; x += 1) {
          let lowest = -1;
          for (let y = png.height - 1; y >= 0; y -= 1)
            if (alpha(x, y) >= 128) {
              lowest = y;
              break;
            }
          if (lowest < 0) continue;
          columns += 1;
          const shadowed = (y: number) =>
            cast.mask[y * cast.width + x] === 1 || (y > lowest && y <= lowest + contactRows);
          // The pixel under the art is shadow: no strip of ground shows between them.
          expect(shadowed(lowest + 1), `${sprite} column ${x}`).toBe(true);
          // And the base the cast starts from is the art's own bottom or below it, never above.
          expect(base[x]).toBeGreaterThanOrEqual(lowest);
        }
        expect(columns).toBeGreaterThan(0);
      });

    // At the sizes the sprite cache draws a prop (N = 1 to 3 at 1 and 2 dpr), the cast is solid.
    for (const size of [64, 128, 192, 256])
      it(`${sprite} casts a solid shadow at ${size} px`, () => {
        const png = PNG.sync.read(
          readFileSync(new URL(`../../public/art/props/${file}`, import.meta.url)),
        );
        const s = png.width / size;
        const alpha = (x: number, y: number) =>
          png.data[(Math.floor(y * s) * png.width + Math.floor(x * s)) * 4 + 3] ?? 0;
        const cast = groundedCast(alpha, size, size, CAST_PER_PIXEL);
        const on = (x: number, y: number) => cast.mask[y * cast.width + x] === 1;
        let holes = 0;
        for (let y = 1; y < cast.height - 1; y += 1)
          for (let x = 1; x < cast.width - 1; x += 1)
            if (!on(x, y) && on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1))
              holes += 1;
        expect(holes).toBe(0);
      });
  }
});

describe("why props do not use the figures' foot projection", () => {
  it("the foot projection leaves ground showing under the hay bale's base edges", () => {
    const png = PNG.sync.read(
      readFileSync(new URL('../../public/art/props/hay.png', import.meta.url)),
    );
    const alpha = (x: number, y: number) => png.data[(y * png.width + x) * 4 + 3] ?? 0;
    const foot = { x: png.width / 2, y: FOOT_LINE * png.height };
    const cast = new Set<string>();
    for (let y = 0; y < png.height; y += 1)
      for (let x = 0; x < png.width; x += 1)
        if (alpha(x, y) >= 128) {
          const p = projectShadowPoint({ x, y }, foot);
          cast.add(`${Math.round(p.x)},${Math.round(p.y)}`);
        }
    // Under the bale's left base corner, two contact lines down, the old cast is nowhere.
    let gaps = 0;
    for (let x = 0; x < png.width; x += 1) {
      let lowest = -1;
      for (let y = png.height - 1; y >= 0; y -= 1)
        if (alpha(x, y) >= 128) {
          lowest = y;
          break;
        }
      if (lowest >= 0 && !cast.has(`${x},${lowest + 1}`) && lowest < foot.y - 8) gaps += 1;
    }
    expect(gaps).toBeGreaterThan(png.width / 8);
  });
});

describe('solid forest scenery stands on its own base', () => {
  const pieces = FOREST_ROAD_SCENE.scenery;
  it('casts the cottage and every roadside prop but the lantern from its base', () => {
    const based = pieces.filter((p) => p.castFrom === 'base').map((p) => p.id);
    expect(based).toContain('forest-keeper-lodge');
    for (const id of [
      'signpost',
      'fence-a',
      'fence-b',
      'fence-c',
      'woodpile',
      'milestone',
      'quarry-blocks',
    ])
      expect(based).toContain(`forest-roadside-${id}`);
    // A hanging lamp and a canopy are not on the ground: they keep the foot projection.
    expect(based).not.toContain('forest-roadside-lantern');
    expect(based.filter((id) => /pine|alder|tree/.test(id))).toEqual([]);
  });
});
