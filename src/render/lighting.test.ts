import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BA_DAN_ACTOR_GROUNDING, BA_DAN_SCENE } from '../content/scenes/baDan';
import { FOOT_LINE } from './sheets/bake';
import { FOREST_ROAD_SCENE } from '../content/scenes/forestRoad';
import { QUARRY_GATE_SCENE } from '../content/scenes/quarryGate';
import {
  CAST_PER_PIXEL,
  CAST_SHADOW_ALPHA,
  CONTACT_BAND,
  DEFAULT_ACTOR_GROUNDING,
  FACE_SHADE,
  PAINTED_FACE_SHADE,
  projectShadowPoint,
  projectRaisedEdgeShadow,
  structureShadowPolygons,
  silhouetteProjection,
  actorGrounding,
  castShadowStrength,
  contactBandRows,
  groundTreatment,
  shadowCeiling,
  spriteBandArt,
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
  it("leaves a scene that sets nothing at today's single cast alpha and no contact layer", () => {
    expect(actorGrounding(undefined)).toEqual({ cast: CAST_SHADOW_ALPHA, contact: 0 });
    expect(actorGrounding({})).toBe(DEFAULT_ACTOR_GROUNDING);
    expect(actorGrounding(FOREST_ROAD_SCENE)).toBe(DEFAULT_ACTOR_GROUNDING);
    expect(actorGrounding(QUARRY_GATE_SCENE)).toBe(DEFAULT_ACTOR_GROUNDING);
    expect(shadowCeiling(DEFAULT_ACTOR_GROUNDING)).toBe(CAST_SHADOW_ALPHA);
  });

  it('gives Ba Dan a stronger cast and a contact layer, tinted at the strongest of them', () => {
    const grounding = actorGrounding(BA_DAN_SCENE);
    expect(grounding).toEqual(BA_DAN_ACTOR_GROUNDING);
    expect(grounding.cast).toBeGreaterThan(CAST_SHADOW_ALPHA);
    expect(grounding.contact).toBeGreaterThan(grounding.cast);
    expect(shadowCeiling(grounding)).toBe(grounding.contact);
    // Every caster writes its alpha as a fraction of the ceiling, never above it.
    for (const alpha of [CAST_SHADOW_ALPHA, grounding.cast, grounding.contact])
      expect(alpha / shadowCeiling(grounding)).toBeLessThanOrEqual(1);
  });

  it('fills only the keys a scene sets', () => {
    expect(actorGrounding({ actorGrounding: { contact: 0.6 } })).toEqual({
      cast: CAST_SHADOW_ALPHA,
      contact: 0.6,
    });
  });

  it('takes the sole band from the rows ending on the foot line', () => {
    // A 192 px cel at 128 px a tile with the foot line at 0.85 of its height.
    const band = contactBandRows(192, 0.85, 128);
    expect(band.height).toBe(Math.round(CONTACT_BAND.height * 128));
    expect(band.top + band.height).toBeCloseTo(0.85 * 192, 0);
    // Never past the cel, and never empty.
    expect(contactBandRows(10, 1, 128)).toEqual({ top: 0, height: 10 });
    expect(contactBandRows(192, 0, 128).height).toBe(1);
  });

  it('cuts a sprite band from the rows ending on the foot line', () => {
    const art = spriteBandArt({ width: 128, height: 128 });
    expect(art.anchor.y).toBe(FOOT_LINE);
    const band = contactBandRows(art.frame.h, art.anchor.y, art.pixelsPerTile);
    expect(band.height).toBe(Math.round(CONTACT_BAND.height * 128));
    expect(band.top + band.height).toBeCloseTo(FOOT_LINE * 128, 0);
    // A 2-tile-tall sprite measures its tile by half its height.
    expect(spriteBandArt({ width: 128, height: 256 }, 2).pixelsPerTile).toBe(128);
  });

  it('gives a figure a band or a pool in a contact scene, and the old pool in a default one', () => {
    const contact = { cast: 0.5, contact: 0.8 };
    // Every figure that casts has art to cut a band from, so it loses its pool...
    expect(groundTreatment(contact, { castStrength: 1, defaultPool: true })).toEqual({
      band: true,
      pool: false,
    });
    // ...a resident that never had a pool just gains the band...
    expect(groundTreatment(contact, { castStrength: 1, defaultPool: false })).toEqual({
      band: true,
      pool: false,
    });
    // ...and one that casts nothing keeps what it had.
    expect(groundTreatment(contact, { castStrength: 0, defaultPool: true })).toEqual({
      band: false,
      pool: true,
    });
    for (const defaultPool of [true, false])
      expect(groundTreatment(DEFAULT_ACTOR_GROUNDING, { castStrength: 1, defaultPool })).toEqual({
        band: false,
        pool: defaultPool,
      });
  });

  it('is read the same way by both backends', () => {
    const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const source of [read('./backends/pixi.ts'), read('./backends/canvas2d.ts')]) {
      expect(source).toContain('actorGrounding(view.scene)');
      expect(source).toContain('shadowCeiling(this.grounding)');
      expect(source).toContain('contactBandRows(');
      expect(source).toContain('CONTACT_BAND.drop');
      expect(source).toContain('CONTACT_BAND.spreadX');
      expect(source).toContain('CONTACT_BAND.spreadY');
    }
  });
});
