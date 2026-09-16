import { describe, expect, it } from 'vitest';
import type { ParticleEmitterDef, StrokeEmitterDef } from '../../content/fx';
import { PARTICLE_STRIDE, headAt, particleSpan, sampleParticles, sampleStrokes } from './simulate';

const burst: ParticleEmitterDef = {
  kind: 'particles',
  shape: 'burst',
  cell: 'glow',
  count: 24,
  duration: 300,
  life: [200, 400],
  delay: [0, 100],
  speed: [1, 3],
  spread: Math.PI,
  gravity: 2,
  drag: 3,
  size: [0.1, 0.2],
  grow: 1.5,
  spin: 2,
  color: 'light',
  fade: 'out',
  blend: 'add',
  layer: 'over',
};

const bolt: StrokeEmitterDef = {
  kind: 'strokes',
  shape: 'bolt',
  duration: 260,
  count: 3,
  width: 0.1,
  reach: 0,
  color: 'white',
  ink: true,
  blend: 'add',
  layer: 'over',
};

const from = { x: 2.5, y: 3.5 };
const to = { x: 6.5, y: 3.5 };

function sample(def: ParticleEmitterDef, elapsed: number, seed = 7): Float32Array {
  const out = new Float32Array(def.count * PARTICLE_STRIDE);
  const n = sampleParticles(def, elapsed, seed, from, to, out);
  return out.slice(0, n * PARTICLE_STRIDE);
}

describe('sampleParticles', () => {
  it('is deterministic for a seed and different across seeds', () => {
    expect(sample(burst, 150, 7)).toEqual(sample(burst, 150, 7));
    expect(sample(burst, 150, 7)).not.toEqual(sample(burst, 150, 8));
  });

  it('never writes more than the count, and nothing after the span', () => {
    expect(sample(burst, 150).length / PARTICLE_STRIDE).toBeLessThanOrEqual(burst.count);
    expect(sample(burst, -1).length).toBe(0);
    expect(sample(burst, particleSpan(burst) + 1).length).toBe(0);
    expect(particleSpan(burst)).toBe(700);
  });

  it('keeps every particle near the point, with alpha in range', () => {
    const out = sample(burst, 250);
    expect(out.length).toBeGreaterThan(0);
    for (let i = 0; i < out.length; i += PARTICLE_STRIDE) {
      expect(Math.abs((out[i] ?? 0) - from.x)).toBeLessThan(3);
      expect(Math.abs((out[i + 1] ?? 0) - from.y)).toBeLessThan(3);
      expect(out[i + 2] ?? 0).toBeGreaterThan(0);
      expect(out[i + 4] ?? -1).toBeGreaterThanOrEqual(0);
      expect(out[i + 4] ?? 2).toBeLessThanOrEqual(1);
    }
  });

  it('fades a particle out over its life', () => {
    const single: ParticleEmitterDef = { ...burst, count: 1, delay: [0, 0], life: [400, 400] };
    const early = sample(single, 40);
    const late = sample(single, 360);
    expect(early[4] ?? 0).toBeGreaterThan(late[4] ?? 1);
  });

  it('points a projectile along its flight', () => {
    const streak: ParticleEmitterDef = {
      ...burst,
      shape: 'projectile',
      count: 1,
      delay: [0, 0],
      life: [300, 300],
      duration: 300,
      speed: [0, 0],
      spin: 0,
    };
    // `to` is due right of `from`, so the heading is 0.
    expect(sample(streak, 150)[3]).toBeCloseTo(0, 6);
  });

  it('rides a projectile from the caster to the target', () => {
    const stone: ParticleEmitterDef = {
      ...burst,
      shape: 'projectile',
      count: 1,
      delay: [0, 0],
      life: [300, 300],
      duration: 300,
      speed: [0, 0],
    };
    const start = sample(stone, 0);
    const mid = sample(stone, 150);
    const end = sample(stone, 300);
    expect(start[0]).toBeCloseTo(from.x, 6);
    expect(mid[0]).toBeCloseTo((from.x + to.x) / 2, 6);
    expect(end[0]).toBeCloseTo(to.x, 6);
  });

  it('lobs the head by the arc at the midpoint only', () => {
    expect(headAt(from, to, 0, 1).y).toBeCloseTo(from.y, 6);
    expect(headAt(from, to, 0.5, 1).y).toBeCloseTo(from.y - 1, 6);
    expect(headAt(from, to, 1, 1).y).toBeCloseTo(to.y, 6);
  });

  it('drifts across the rectangle between the two points', () => {
    const leaves: ParticleEmitterDef = {
      ...burst,
      shape: 'drift',
      count: 30,
      duration: 4000,
      life: [3000, 4000],
      delay: [0, 4000],
      speed: [0.2, 0.4],
      spread: 0.8,
      gravity: 0,
      drag: 0,
    };
    const box = { from: { x: 0, y: 0 }, to: { x: 20, y: 12 } };
    const out = new Float32Array(leaves.count * PARTICLE_STRIDE);
    const n = sampleParticles(leaves, 2000, 3, box.from, box.to, out);
    expect(n).toBeGreaterThan(5);
    let spreadX = 0;
    for (let i = 0; i < n; i++) {
      const x = out[i * PARTICLE_STRIDE] ?? 0;
      const y = out[i * PARTICLE_STRIDE + 1] ?? 0;
      expect(x).toBeGreaterThan(-2);
      expect(x).toBeLessThan(22);
      expect(y).toBeGreaterThan(-2);
      expect(y).toBeLessThan(14);
      spreadX = Math.max(spreadX, Math.abs(x - 10));
    }
    // Not bunched at a point: the leaves are scattered over the board.
    expect(spreadX).toBeGreaterThan(4);
  });

  it('respects the output buffer', () => {
    const out = new Float32Array(PARTICLE_STRIDE * 3);
    const n = sampleParticles(burst, 150, 1, from, to, out);
    expect(n).toBeLessThanOrEqual(3);
  });
});

describe('sampleStrokes', () => {
  it('draws a bolt from the caster to the target while it lives, and nothing after', () => {
    const strokes = sampleStrokes(bolt, 100, 3, from, to);
    expect(strokes.length).toBe(bolt.count);
    const main = strokes[0];
    expect(main?.points[0]).toBeCloseTo(from.x, 6);
    expect(main?.points[1]).toBeCloseTo(from.y, 6);
    expect(main?.points[main.points.length - 2]).toBeCloseTo(to.x, 6);
    expect(main?.points[main.points.length - 1]).toBeCloseTo(to.y, 6);
    expect(sampleStrokes(bolt, bolt.duration + 1, 3, from, to)).toEqual([]);
  });

  it('is deterministic for a seed', () => {
    expect(sampleStrokes(bolt, 100, 3, from, to)).toEqual(sampleStrokes(bolt, 100, 3, from, to));
  });

  it('reaches the target with a whip at its midpoint', () => {
    const whip: StrokeEmitterDef = { ...bolt, shape: 'whip', count: 1, duration: 400, ink: true };
    const mid = sampleStrokes(whip, 200, 1, from, to)[0];
    expect(mid?.points[mid.points.length - 2]).toBeCloseTo(to.x, 6);
    const early = sampleStrokes(whip, 20, 1, from, to)[0];
    expect(early?.points[early.points.length - 2] ?? 99).toBeLessThan(to.x);
  });

  it('centres a crack, a slab and an arc on the point it is born at, not the aim', () => {
    for (const shape of ['crack', 'slab', 'arc'] as const) {
      const def: StrokeEmitterDef = { ...bolt, shape, count: 3, reach: 0.6, width: 0.3 };
      const shapes = sampleStrokes(def, 100, 1, from, to);
      expect(shapes.length).toBeGreaterThan(0);
      for (const stroke of shapes) {
        for (let i = 0; i < stroke.points.length; i += 2) {
          expect(Math.abs((stroke.points[i] ?? 0) - from.x), shape).toBeLessThan(2);
        }
      }
    }
  });

  it('strikes down out of the sky onto the point', () => {
    const def: StrokeEmitterDef = { ...bolt, shape: 'strike', count: 2 };
    const [main, branch] = sampleStrokes(def, 50, 4, from, to);
    expect(main?.points[main.points.length - 2]).toBeCloseTo(from.x, 6);
    expect(main?.points[main.points.length - 1]).toBeCloseTo(from.y, 6);
    expect(main?.points[1] ?? 0).toBeLessThan(from.y - 1);
    expect(branch).toBeDefined();
  });

  it('raises slabs as filled shapes', () => {
    const slab: StrokeEmitterDef = { ...bolt, shape: 'slab', count: 2, reach: 0.5, width: 0.3 };
    const shapes = sampleStrokes(slab, 200, 1, from, to);
    expect(shapes).toHaveLength(2);
    for (const shape of shapes) {
      expect(shape.fill).toBe(true);
      expect(shape.closed).toBe(true);
      expect(shape.points).toHaveLength(8);
    }
  });
});
