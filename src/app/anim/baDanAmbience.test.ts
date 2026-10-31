import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import decode, { init } from '@jsquash/webp/decode.js';
import { describe, expect, it } from 'vitest';
import { FX_AMBIENCE } from '../../content/fx';
import { BA_DAN_VILLAGE } from '../../content/maps/village';
import { BA_DAN_AMBIENCE_SOURCES, BA_DAN_SCENE } from '../../content/scenes/baDan';
import { BA_DAN_PAINTING, BA_DAN_UPRIGHTS } from '../../content/scenes/baDan.art';
import { buildGrid } from '../../core/rules/grid';
import { DAY_PHASES, type DayPhase, type Vec2 } from '../../core/types';
import { PARTICLE_STRIDE, sampleParticles, sampleStrokes } from '../../render/fx/simulate';
import type { EmitterInstance } from '../../render/view';
import { ambientEmitters, waterCells } from './ambience';

const recipe = FX_AMBIENCE.village;
if (!recipe) throw new Error('Missing village recipe');
const grid = buildGrid(BA_DAN_VILLAGE);
const water = waterCells(grid);
const details = { sources: BA_DAN_AMBIENCE_SOURCES, phase: 'evening' as const };
const frame = (time: number, still = false, phase: DayPhase = 'evening') =>
  ambientEmitters(recipe, grid, time, BA_DAN_SCENE.chimneys, still, water, BA_DAN_SCENE.canopies, {
    ...details,
    phase,
  });

function particle(instance: EmitterInstance): Float32Array {
  if (instance.def.kind !== 'particles') throw new Error('Expected a particle');
  const out = new Float32Array(PARTICLE_STRIDE);
  expect(
    sampleParticles(instance.def, instance.elapsed, instance.seed, instance.from, instance.to, out),
  ).toBe(1);
  return out;
}

const projected = (at: Vec2) => ({ x: 1024 + (at.x - at.y) * 64, y: (at.x + at.y) * 32 });

describe('Ba Dan additional ambience', () => {
  it('registers its sources on the tracked vessel lid and amber lantern glass', async () => {
    const require = createRequire(import.meta.url);
    const wasm = readFileSync(require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm'));
    await init(await WebAssembly.compile(wasm));
    const points = [
      { id: 'south-market-display', at: BA_DAN_AMBIENCE_SOURCES.steam[0], u: 39, v: 21 },
      ...['d5', 'd6', 'd7'].map((id, index) => ({
        id,
        at: BA_DAN_AMBIENCE_SOURCES.lanterns[index],
        u: 20,
        v: 30,
      })),
    ];
    const pages = await Promise.all(
      [0, 1].map(async (page) => {
        const bytes = readFileSync(`public/art/maps/ba-dan-scene/uprights-${page}.webp`);
        return decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      }),
    );
    for (const { id, at, u, v } of points) {
      const piece = BA_DAN_UPRIGHTS[id];
      if (!piece || !at) throw new Error(`Missing source ${id}`);
      expect(projected(at)).toEqual({
        x: BA_DAN_PAINTING.origin.x + piece[3] + u,
        y: BA_DAN_PAINTING.origin.y + piece[4] + v,
      });
      const page = pages[piece[0]];
      if (!page) throw new Error('Missing upright page');
      const index = ((piece[2] + v) * page.width + piece[1] + u) * 4;
      expect(page.data[index + 3]).toBe(255);
      if (id !== 'south-market-display') {
        // The light sits inside the bright amber glass, clear of its dark metal frame.
        expect(page.data[index]).toBeGreaterThan(190);
        expect(page.data[index + 1]).toBeGreaterThan(140);
        expect(page.data[index + 2]).toBeLessThan(100);
      }
    }
  }, 30_000);

  it('only opts authored scenes into the additional effects', () => {
    const ordinary = ambientEmitters(recipe, grid, 2300, [], false, water, [], {
      sources: undefined,
      phase: 'night',
    });
    expect(ordinary.some((e) => e.def === recipe.waterLeaf || e.def === recipe.flow)).toBe(false);
    const added = frame(2300);
    for (const def of [recipe.flow, recipe.waterLeaf, recipe.steam, recipe.lantern])
      expect(added.some((e) => e.def === def)).toBe(true);
    expect(frame(2300)).toEqual(added);
  });

  it('uses only the world clock phase to light lanterns', () => {
    for (const phase of DAY_PHASES) {
      const lamps = frame(2300, false, phase).filter((e) => e.def === recipe.lantern);
      expect(lamps).toHaveLength(phase === 'evening' || phase === 'night' ? 3 : 0);
      for (const lamp of lamps) {
        const sample = particle(lamp);
        expect(sample[2]).toBe(2 / 64);
        expect(sample[4]).toBeGreaterThan(0);
        expect(sample[4]).toBeLessThanOrEqual(0.35);
        expect(lamp.palette).toBe('fire');
        expect(lamp.def.blend).toBe('normal');
      }
    }
  });

  it('freezes steam and lanterns and omits moving water under reduce motion', () => {
    const early = frame(100, true);
    expect(frame(987654, true)).toEqual(early);
    expect(early.some((e) => e.def === recipe.waterLeaf || e.def === recipe.flow)).toBe(false);
    for (const e of early) expect(e.still).toBe(true);
    expect(early.filter((e) => e.def === recipe.steam)).toHaveLength(2);
    expect(early.filter((e) => e.def === recipe.lantern)).toHaveLength(3);
  });

  it('keeps sampled stamp centres and fixed sprite sizes on world pixels throughout their motion', () => {
    for (let time = 0; time < 28000; time += 113)
      for (const e of frame(time)) {
        if (e.def !== recipe.waterLeaf && e.def !== recipe.steam && e.def !== recipe.lantern)
          continue;
        const sample = particle(e);
        const centre = projected({ x: sample[0] ?? 0, y: sample[1] ?? 0 });
        expect(centre.x).toBe(Math.round(centre.x));
        expect(centre.y).toBe(Math.round(centre.y));
        const size = (sample[2] ?? 0) * 64;
        expect([2, 4, 6]).toContain(size);
        expect(e.def.kind === 'particles' && e.def.upright).toBe(true);
      }
  });

  it('keeps the complete floating-leaf footprint and flowing glints inside water, away from the bridge', () => {
    for (let time = 0; time < 120000; time += 197)
      for (const e of frame(time)) {
        if (e.def === recipe.waterLeaf) {
          const sample = particle(e);
          const x = sample[0] ?? 0;
          const y = sample[1] ?? 0;
          const cell = water.find((c) => c.x === Math.floor(x) && c.y === Math.floor(y));
          expect(cell).toBeDefined();
          // Four screen-aligned pixels: invert the oblique projection for each corner.
          const halfExtent = 2 / 128 + 2 / 64;
          expect(x - Math.floor(x)).toBeGreaterThan(halfExtent + 0.02);
          expect(Math.ceil(x) - x).toBeGreaterThan(halfExtent + 0.02);
          expect(y - Math.floor(y)).toBeGreaterThan(halfExtent + 0.02);
          expect(Math.ceil(y) - y).toBeGreaterThan(halfExtent + 0.02);
        } else if (e.def === recipe.flow && e.def.kind === 'strokes') {
          const cell = water.find(
            (c) => c.x === Math.floor(e.from.x) && c.y === Math.floor(e.from.y),
          );
          if (!cell) throw new Error('Flow outside water');
          for (const shape of sampleStrokes(e.def, e.elapsed, e.seed, e.from, e.to))
            for (let i = 0; i < shape.points.length; i += 2) {
              const x = shape.points[i] ?? 0;
              const y = shape.points[i + 1] ?? 0;
              expect(x).toBeGreaterThan(cell.x + 0.02 + shape.width / 2);
              expect(x).toBeLessThan(cell.x + 0.98 - shape.width / 2);
              expect(y).toBeGreaterThan(cell.y + 0.02 + shape.width / 2);
              expect(y).toBeLessThan(cell.y + 0.98 - shape.width / 2);
            }
        }
      }
  });

  it('fits the complete village particle population below the existing Canvas cap', () => {
    const out = new Float32Array(400 * PARTICLE_STRIDE);
    let peak = 0;
    for (let time = 0; time < 120000; time += 100) {
      let count = 0;
      for (const e of frame(time))
        if (e.def.kind === 'particles')
          count += sampleParticles(e.def, e.elapsed, e.seed, e.from, e.to, out);
      peak = Math.max(peak, count);
    }
    expect(peak).toBeGreaterThan(40);
    expect(peak).toBeLessThanOrEqual(96);
  });
});
