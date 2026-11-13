import { describe, expect, it } from 'vitest';
import { ASSETS } from '../../content/assets/manifest';
import type { ContentIndex, Vec2 } from '../../core/types';
import { smoothPath } from '../../render/geometry/curve';
import type { Projection } from '../../render/projection';
import { Animator, WALK_MS_PER_TILE } from '../animator';
import { partyScale } from './actorScale';
import { walkHeading } from './direction';

const content = { abilities: new Map() } as unknown as ContentIndex;
const KAYA = 'unit.fire.kaya';
/** A four-way sheet: a fixed near-authored clip phase per tile. */
const FOUR_WAY = 'unit.earth.linmei';
function locomotion() {
  const sheet = ASSETS[KAYA];
  if (sheet?.kind !== 'sheet' || !sheet.locomotion) throw new Error('Kaya is eight-way');
  return sheet.locomotion;
}
const gait = () => locomotion().walkMsPerTile;
/** Where Kaya's walk starts, as her sheet declares it. */
const START_MS = locomotion().walkStartMs;

/** Kaya's clip ms per logical tile along `tangent`, as the sheet declares it. */
function kayaRate(tangent: Vec2, _projection: Projection): number {
  // The animator stretches the sheet's clip by the figure's scale (ADR 0095).
  return gait()[walkHeading(tangent)] / partyScale();
}

/** An ambling walker: it plays each heading's fitted rate. */
function walker(projection: Projection, from: Vec2, path: readonly Vec2[]): Animator {
  const a = new Animator(content, { motionReduced: () => false, amble: true });
  a.setProjection(projection);
  a.push(0, [{ type: 'partyWalked', unitId: 'p', from, path }], []);
  return a;
}

interface Sample {
  readonly pos: Vec2;
  readonly clipTime: number;
}

/** The drawn position and walk phase every millisecond of the route. */
function trace(a: Animator, sprite: string): Sample[] {
  const samples: Sample[] = [];
  for (let t = 1; t < a.finishesAt; t++) {
    const pos = a.renderPos(t, 'p');
    const pose = a.unitPose(t, 'p', sprite);
    if (!pos || pose?.clip !== 'walk') continue;
    samples.push({ pos, clipTime: pose.clipTime });
  }
  return samples;
}

const tiles = (from: Vec2, ...steps: [number, number][]): Vec2[] => {
  const out: Vec2[] = [];
  let at = from;
  for (const [dx, dy] of steps) {
    at = { x: at.x + dx, y: at.y + dy };
    out.push(at);
  }
  return out;
};

const FROM = { x: 4, y: 4 };
const E: [number, number] = [1, 0];
const N: [number, number] = [0, -1];

describe('eight-way walk phase across a turn', () => {
  it('plays the first stretch at its rate alone before the turn', () => {
    // Before the corner rounds, phase is the east rate times the distance, as
    // it was: turning is the only thing that changed.
    const a = walker('orthographic', FROM, tiles(FROM, E, E, E, N, N, N));
    for (const sample of trace(a, KAYA)) {
      const x = sample.pos.x - FROM.x;
      if (x > 2) break;
      expect(sample.clipTime).toBeCloseTo(START_MS + x * gait().east, 6);
    }
  });

  it('is exactly the declared rate on a single-segment route', () => {
    for (const [projection, to] of [
      ['orthographic', { x: 5, y: 4 }],
      ['orthographic', { x: 4, y: 3 }],
      ['orthographic', { x: 5, y: 3 }],
      ['orthographic', { x: 3, y: 3 }],
    ] as const) {
      const a = walker(projection, FROM, [to]);
      const tangent = { x: to.x - FROM.x, y: to.y - FROM.y };
      const length = Math.hypot(tangent.x, tangent.y);
      const rate = kayaRate({ x: tangent.x / length, y: tangent.y / length }, projection);
      for (const t of [50, 150, 300, a.finishesAt - 1]) {
        const legacy = a.unitPose(t, 'p', FOUR_WAY)?.clipTime ?? -1;
        expect(
          (a.unitPose(t, 'p', KAYA)?.clipTime ?? 0) - START_MS,
          `${projection} ${t}`,
        ).toBeCloseTo((legacy / WALK_MS_PER_TILE) * rate, 6);
      }
    }
  });

  it('has no walk phase to give on a zero-length route', () => {
    const a = walker('orthographic', FROM, []);
    for (let t = 0; t <= a.finishesAt + 1; t += 10) {
      const pose = a.unitPose(t, 'p', KAYA);
      expect(pose === undefined || pose.clipTime === 0, `${t}`).toBe(true);
    }
    const still = walker('orthographic', FROM, [FROM]);
    for (let t = 0; t <= still.finishesAt + 1; t += 10) {
      const pose = still.unitPose(t, 'p', KAYA);
      expect(pose === undefined || pose.clipTime === 0, `${t}`).toBe(true);
    }
  });

  it('leaves four-way art at its fixed cadence through the same turn', () => {
    for (const projection of ['orthographic'] as const) {
      const path = tiles(FROM, E, E, E, N, N, N);
      const a = walker(projection, FROM, path);
      for (const sprite of [FOUR_WAY, 'unit.water.nilak', undefined]) {
        let travelled = 0;
        let previous: Vec2 | undefined;
        for (let t = 1; t < a.finishesAt; t++) {
          const pos = a.renderPos(t, 'p');
          const pose = a.unitPose(t, 'p', sprite);
          if (!pos || !pose) continue;
          if (previous) travelled += Math.hypot(pos.x - previous.x, pos.y - previous.y);
          previous = pos;
          expect(pose.clipTime).toBeCloseTo(
            travelled * WALK_MS_PER_TILE + (a.unitPose(1, 'p', sprite)?.clipTime ?? 0),
            0,
          );
        }
        const end = a.unitPose(a.finishesAt - 0.01, 'p', sprite)?.clipTime ?? -1;
        expect(end).toBeCloseTo(smoothPath(FROM, path).length * WALK_MS_PER_TILE, 0);
      }
    }
  });
});
