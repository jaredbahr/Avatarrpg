import { describe, expect, it } from 'vitest';
import {
  CAST_PER_PIXEL,
  CAST_SHADOW_ALPHA,
  FACE_SHADE,
  PAINTED_FACE_SHADE,
  projectShadowPoint,
  projectRaisedEdgeShadow,
  structureShadowPolygons,
  silhouetteProjection,
  castShadowStrength,
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
