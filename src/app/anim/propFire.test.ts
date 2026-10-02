import { describe, expect, it } from 'vitest';
import { OBLIQUE_UP, ORTHOGRAPHIC_UP } from '../../content/fx';
import { burningPropEmitters } from './propFire';
import type { RenderProp } from '../../render/view';
import { particleSpan, sampleParticles } from '../../render/fx/simulate';

const prop = (burning?: number): RenderProp => ({
  id: 'hay-1',
  pos: { x: 12, y: 5 },
  sprite: 'prop.hay',
  name: 'Hay Bale',
  hp: 5,
  maxHp: 5,
  ...(burning === undefined ? {} : { burning }),
});

describe('burning prop presentation', () => {
  it('loops a flame over the middle of the prop only while fuel is burning', () => {
    expect(burningPropEmitters([prop()], 700)).toHaveLength(0);
    const emitters = burningPropEmitters([prop(2)], 700);
    expect(emitters.length).toBeGreaterThan(0);
    for (const emitter of emitters) {
      expect(emitter.palette).toBe('fire');
      // Part-way up the bale: on a flat map that is straight up its own tile.
      expect((emitter.from.x + emitter.to.x) / 2).toBeCloseTo(12.5);
      expect((emitter.from.y + emitter.to.y) / 2).toBeCloseTo(5.28);
      expect(Math.abs(emitter.to.x - emitter.from.x)).toBeLessThan(0.5);
    }
  });

  it('stands up and rises up the screen in both projections, never flat on the ground', () => {
    for (const [projection, up] of [
      ['oblique', OBLIQUE_UP],
      ['orthographic', ORTHOGRAPHIC_UP],
    ] as const) {
      for (const emitter of burningPropEmitters([prop(2)], 700, projection)) {
        const def = emitter.def;
        expect(def.kind).toBe('particles');
        if (def.kind !== 'particles') continue;
        expect(def.shape).toBe('drift');
        expect(def.upright).toBe(true);
        expect(def.spread).toBe(up);
      }
    }
  });

  it('keeps live particles across a whole loop so the flame never goes out', () => {
    const period = Math.max(
      ...burningPropEmitters([prop(1)], 0).flatMap((emitter) =>
        emitter.def.kind === 'particles' ? [particleSpan(emitter.def)] : [],
      ),
    );
    for (let now = 0; now <= period; now += 20) {
      const emitters = burningPropEmitters([prop(1)], now);
      expect(emitters.length % 2).toBe(0);
      let live = 0;
      for (const emitter of emitters) {
        if (emitter.def.kind !== 'particles') continue;
        const out = new Float32Array(emitter.def.count * 5);
        live += sampleParticles(
          emitter.def,
          emitter.elapsed,
          emitter.seed,
          emitter.from,
          emitter.to,
          out,
          0,
          emitter.arc,
        );
      }
      expect(live, `live particles at ${now}ms`).toBeGreaterThan(0);
    }
  });

  it('holds one fixed frame when asked to stay still', () => {
    const a = burningPropEmitters([prop(2)], 100, 'oblique', true);
    const b = burningPropEmitters([prop(2)], 9000, 'oblique', true);
    expect(a).toEqual(b);
    expect(a.every((emitter) => emitter.still === true)).toBe(true);
    expect(a).toHaveLength(burningPropEmitters([prop(2)], 100, 'oblique').length / 2);
  });

  it('keeps a prop flame stable when another prop disappears', () => {
    const other = { ...prop(2), id: 'hay-0', pos: { x: 2, y: 3 } };
    const withOther = burningPropEmitters([other, prop(2)], 700).filter(
      (emitter) => emitter.from.x > 10,
    );
    expect(burningPropEmitters([prop(2)], 700)).toEqual(withOther);
  });
});
