import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BA_DAN_ACTOR_GROUNDING, BA_DAN_SCENE } from '../content/scenes/baDan';
import { FOREST_ROAD_SCENE } from '../content/scenes/forestRoad';
import { QUARRY_GATE_SCENE } from '../content/scenes/quarryGate';
import {
  CAST_PER_PIXEL,
  CAST_SHADOW_ALPHA,
  DEFAULT_CONTACT_ALPHA,
  DEFAULT_ACTOR_GROUNDING,
  DEFAULT_SHADOW_INK,
  FIGURE_CAST,
  FIGURE_CONTACT,
  FIGURE_SHADOW,
  figureCastReach,
  figureShadow,
  FACE_SHADE,
  PAINTED_FACE_SHADE,
  projectShadowPoint,
  projectRaisedEdgeShadow,
  structureShadowPolygons,
  silhouetteProjection,
  actorGrounding,
  castShadowStrength,
  contactBand,
  shadowCeiling,
  unionShadowCoverage,
} from './lighting';

describe('silhouette cast-shadow projection', () => {
  it('sweeps a raised top edge down-right by its screen height', () => {
    expect(
      projectRaisedEdgeShadow(
        [
          { x: 10, y: 20 },
          { x: 30, y: 20 },
        ],
        100,
      ),
    ).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 20 },
      { x: 72, y: 47 },
      { x: 52, y: 47 },
    ]);
  });
  it('casts one exposed tier boundary only onto its lower neighbour', () => {
    const cells = [
      { blocked: false, elevation: 1 },
      { blocked: false, elevation: 1 },
      { blocked: false, elevation: 0 },
      { blocked: false, elevation: 0 },
    ];
    const polygons = structureShadowPolygons(
      2,
      2,
      (x, y) => cells[y * 2 + x],
      ({ x, y }) => ({ x: (x - y) * 64, y: (x + y) * 32 }),
    );
    expect(polygons).toHaveLength(2);
    expect(polygons.map(({ source, receiver }) => ({ source, receiver }))).toEqual([
      { source: { x: 0, y: 0 }, receiver: { x: 0, y: 1 } },
      { source: { x: 1, y: 0 }, receiver: { x: 1, y: 1 } },
    ]);
  });

  it('never reads past the grid edge as the next row', () => {
    // The east edge of (1, 0) faces x = 2, which is outside a 2-wide grid; a
    // flat tiles[y * width + x] lookup would hand back the next row's cell.
    const cells = [
      { blocked: false, elevation: 1 },
      { blocked: false, elevation: 1 },
      { blocked: false, elevation: 1 },
      { blocked: false, elevation: 1 },
    ];
    expect(
      structureShadowPolygons(
        2,
        2,
        (x, y) => cells[y * 2 + x],
        ({ x, y }) => ({ x: (x - y) * 64, y: (x + y) * 32 }),
      ),
    ).toEqual([]);
  });

  it('lifts a cast with a raised receiver and stops it at a taller one', () => {
    const project = ({ x, y }: { x: number; y: number }) => ({ x: (x - y) * 64, y: (x + y) * 32 });
    const column = (levels: number[]) =>
      structureShadowPolygons(
        1,
        levels.length,
        (_x, y) => ({ blocked: false, elevation: levels[y] ?? 0 }),
        project,
        new Set(),
        100,
      );
    const [ground] = column([2, 0]);
    const [shelf] = column([2, 1]);
    // Tier lift is a quarter tile: the shelf's cast sits 25px higher and is 25px shorter.
    expect(Math.min(...(shelf?.points ?? []).map((p) => p.y))).toBeGreaterThan(
      Math.min(...(ground?.points ?? []).map((p) => p.y)) - 26,
    );
    expect(column([1, 2])).toEqual([]);
  });

  it('leaves authored blocked footprints to their bitmap silhouettes', () => {
    expect(
      structureShadowPolygons(
        1,
        2,
        (_x, y) => ({ blocked: y === 0, elevation: 0 }),
        ({ x, y }) => ({ x: (x - y) * 64, y: (x + y) * 32 }),
        new Set(['0,0']),
      ),
    ).toEqual([]);
  });
  it.each(['orthographic', 'oblique'])('%s falls down-right and stays foot-anchored', () => {
    const foot = { x: 30, y: 80 };
    expect(projectShadowPoint(foot, foot)).toEqual(foot);
    const top = projectShadowPoint({ x: 30, y: 20 }, foot);
    expect(top.x).toBeGreaterThan(foot.x);
    expect(top.y).toBeGreaterThan(foot.y);
  });

  it('scales cast length with silhouette height', () => {
    const foot = { x: 0, y: 100 };
    const short = projectShadowPoint({ x: 0, y: 75 }, foot);
    const tall = projectShadowPoint({ x: 0, y: 50 }, foot);
    expect(tall.x).toBeCloseTo(short.x * 2);
    expect(tall.y - foot.y).toBeCloseTo((short.y - foot.y) * 2);
  });

  it('exposes the matching affine transform', () => {
    const foot = { x: 18, y: 70 };
    const p = { x: 6, y: 10 };
    const m = silhouetteProjection(foot.x, foot.y);
    expect({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }).toEqual(
      projectShadowPoint(p, foot),
    );
    expect(CAST_PER_PIXEL.x).toBeGreaterThan(CAST_PER_PIXEL.y);
  });

  it('unions overlapping masks instead of double-darkening', () => {
    expect(unionShadowCoverage(1, 1)).toBe(1);
    expect(unionShadowCoverage(0.7, 0.4)).toBe(0.7);
  });

  it('honours full, reduced and opted-out cast policies', () => {
    expect(castShadowStrength()).toBe(1);
    expect(castShadowStrength('reduced')).toBeGreaterThan(0);
    expect(castShadowStrength('reduced')).toBeLessThan(1);
    expect(castShadowStrength(false)).toBe(0);
  });
});

describe('form shading against the reference', () => {
  /** Ink luminance over a mid-light stone, for the straight-alpha mix below. */
  const INK = 21;
  const lit = (face: number, shade: number) => face * (1 - shade) + INK * shade;

  it('turns the east face away from the key and only grazes the south one', () => {
    expect(FACE_SHADE.east).toBeGreaterThan(FACE_SHADE.south);
    expect(PAINTED_FACE_SHADE.south).toBeGreaterThan(0);
  });

  it('lands the painted cubes within 10% of the reference (0.75 and 0.53 of the top)', () => {
    // Measured on the wall-end/interior/corner art: top ~202, south ~183, east ~125.
    const top = 202;
    const south = lit(183, PAINTED_FACE_SHADE.south + PAINTED_FACE_SHADE.foot / 2) / top;
    const east = lit(125, PAINTED_FACE_SHADE.east + PAINTED_FACE_SHADE.foot / 2) / top;
    expect(Math.abs(south / 0.75 - 1)).toBeLessThan(0.1);
    expect(Math.abs(east / 0.53 - 1)).toBeLessThan(0.1);
  });

  it('casts ground to ~0.65 of the lit ground beside it', () => {
    const ground = 150;
    expect(Math.abs(lit(ground, CAST_SHADOW_ALPHA) / ground / 0.65 - 1)).toBeLessThan(0.1);
  });
});

describe('scene actor grounding', () => {
  it('gives a scene that sets nothing the shared cast, key and a contact layer (ADR 0093)', () => {
    expect(actorGrounding(undefined)).toEqual({
      cast: CAST_SHADOW_ALPHA,
      contact: DEFAULT_CONTACT_ALPHA,
      castKey: CAST_PER_PIXEL,
      ink: DEFAULT_SHADOW_INK,
    });
    expect(actorGrounding({})).toBe(DEFAULT_ACTOR_GROUNDING);
    expect(actorGrounding(FOREST_ROAD_SCENE)).toBe(DEFAULT_ACTOR_GROUNDING);
    expect(actorGrounding(QUARRY_GATE_SCENE)).toBe(DEFAULT_ACTOR_GROUNDING);
    expect(DEFAULT_CONTACT_ALPHA).toBeGreaterThan(CAST_SHADOW_ALPHA);
    expect(shadowCeiling(DEFAULT_ACTOR_GROUNDING)).toBe(DEFAULT_CONTACT_ALPHA);
  });

  it("gives Ba Dan its painting's shadow ink and a contact layer, tinted at the strongest of them", () => {
    const grounding = actorGrounding(BA_DAN_SCENE);
    expect(grounding).toEqual(BA_DAN_ACTOR_GROUNDING);
    expect(grounding.ink).not.toEqual(DEFAULT_SHADOW_INK);
    expect(grounding.contact).toBeGreaterThan(grounding.cast);
    expect(shadowCeiling(grounding)).toBe(grounding.contact);
    // Every caster writes its alpha as a fraction of the ceiling, never above it.
    for (const alpha of [CAST_SHADOW_ALPHA, grounding.cast, grounding.contact])
      expect(alpha / shadowCeiling(grounding)).toBeLessThanOrEqual(1);
  });

  it('fills only the keys a scene sets', () => {
    expect(actorGrounding({ actorGrounding: { contact: 0.7 } })).toEqual({
      cast: CAST_SHADOW_ALPHA,
      contact: 0.7,
      castKey: CAST_PER_PIXEL,
      ink: DEFAULT_SHADOW_INK,
    });
  });

  it('gives every figure that casts a band, and one that casts nothing no shadow', () => {
    expect(contactBand({ contact: 0.8 }, 1)).toBe(true);
    expect(contactBand({ contact: 0.8 }, 0)).toBe(false);
    // A scene that sets nothing grounds its figures the same way (ADR 0093).
    expect(contactBand(DEFAULT_ACTOR_GROUNDING, 1)).toBe(true);
  });

  it('is read the same way by both backends', () => {
    const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const source of [read('./backends/pixi.ts'), read('./backends/canvas2d.ts')]) {
      expect(source).toContain('actorGrounding(view.scene)');
      expect(source).toContain('figureShadowArt(TILE * scale, this.grounding.castKey, widthTiles)');
      expect(source).toContain('this.grounding.ink');
    }
    // WebGL writes each caster as a fraction of the tint's ceiling; Canvas writes absolute levels (`castInto`).
    expect(read('./backends/pixi.ts')).toContain('shadowCeiling(this.grounding)');
  });
});

describe("a figure's ground shadow (ADR 0093, figure amendment)", () => {
  const key = BA_DAN_ACTOR_GROUNDING.castKey;
  const at = (shadow: ReturnType<typeof figureShadow>, x: number, y: number) =>
    shadow.mask[(shadow.footY + y) * shadow.width + shadow.footX + x] ?? 0;
  const cells = (shadow: ReturnType<typeof figureShadow>) =>
    [...shadow.mask].flatMap((level, i) =>
      level
        ? [
            {
              x: (i % shadow.width) - shadow.footX,
              y: Math.floor(i / shadow.width) - shadow.footY,
              level,
            },
          ]
        : [],
    );

  it('is whole world pixels at three levels: none, the cast and the contact', () => {
    const shadow = figureShadow(64, key);
    expect(new Set(shadow.mask)).toEqual(new Set([0, FIGURE_CAST, FIGURE_CONTACT]));
  });

  it('sits the contact core under the feet, inside the pool', () => {
    const shadow = figureShadow(64, key);
    expect(at(shadow, 0, 0)).toBe(FIGURE_CONTACT);
    for (const c of cells(shadow).filter((c) => c.level === FIGURE_CONTACT)) {
      expect(Math.abs(c.x + 0.5)).toBeLessThanOrEqual(FIGURE_SHADOW.core.rx * 64 + 1);
      expect(Math.abs(c.y + 0.5)).toBeLessThanOrEqual(FIGURE_SHADOW.core.ry * 64 + 1);
    }
  });

  for (const [name, castKey] of [
    ['Ba Dan', key],
    ['the shared key', CAST_PER_PIXEL],
  ] as const)
    it(`keeps the cast short and down-right along ${name}`, () => {
      const shadow = figureShadow(64, castKey);
      const pool = { rx: FIGURE_SHADOW.pool.rx * 64, ry: FIGURE_SHADOW.pool.ry * 64 };
      const reach = figureCastReach(64, castKey);
      // About a quarter of the figure's height, or less.
      expect(Math.hypot(reach.x, reach.y)).toBeLessThanOrEqual(
        FIGURE_SHADOW.maxReach * FIGURE_SHADOW.height * 64 + 1e-9,
      );
      expect(reach.x / reach.y).toBeCloseTo(castKey.x / castKey.y, 6);
      for (const c of cells(shadow)) {
        // Nothing up or left of the pool: the light is upper-left.
        expect(c.x + 0.5).toBeGreaterThanOrEqual(-pool.rx - 1e-9);
        expect(c.y + 0.5).toBeGreaterThanOrEqual(-pool.ry - 1e-9);
        expect(c.x + 0.5).toBeLessThanOrEqual(reach.x + pool.rx + 1e-9);
        expect(c.y + 0.5).toBeLessThanOrEqual(reach.y + pool.ry + 1e-9);
      }
      // The far end of the cast is shadow.
      expect(at(shadow, Math.floor(reach.x), Math.floor(reach.y))).toBe(FIGURE_CAST);
    });

  it('is one connected pool with no holes: a calm shape, not a silhouette', () => {
    const shadow = figureShadow(64, key);
    // Each row is one run, so the edge steps a pixel at a time and no gap shows between legs.
    for (let y = 0; y < shadow.height; y += 1) {
      const row = [...shadow.mask.slice(y * shadow.width, (y + 1) * shadow.width)].map(
        (v) => v > 0,
      );
      const starts = row.filter((on, x) => on && !row[x - 1]).length;
      expect(starts).toBeLessThanOrEqual(1);
    }
  });

  it('grows with the figure and with a two-tile body', () => {
    const one = cells(figureShadow(64, key)).length;
    expect(cells(figureShadow(80, key)).length).toBeGreaterThan(one);
    expect(cells(figureShadow(64, key, 2)).length).toBeGreaterThan(one * 1.5);
  });
});
