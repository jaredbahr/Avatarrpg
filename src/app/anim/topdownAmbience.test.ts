import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { ambienceFx } from '../../content/fx';
import { loadTopDownPresentations, topDownMap } from '../../content/topdown';
import { oldVillage } from '../../content/maps/oldVillage.fixture';
import { buildGrid } from '../../core/rules/grid';
import { PARTICLE_STRIDE, sampleParticles } from '../../render/fx/simulate';
import type { EmitterInstance } from '../../render/view';
import { ambientEmitters, waterCells } from './ambience';

/** Sample real particle geometry, so equal clocks or empty lists cannot pass. */
function geometry(emitters: readonly EmitterInstance[]): number[][] {
  return emitters.map(({ def, elapsed, seed, from, to, arc }) => {
    if (def.kind !== 'particles') throw new Error('Expected shipped chimney particles');
    const data = new Float32Array(def.count * PARTICLE_STRIDE);
    const count = sampleParticles(def, elapsed, seed, from, to, data, 0, arc);
    return Array.from(data.subarray(0, count * PARTICLE_STRIDE));
  });
}

/**
 * Ba Dan's scene as it shipped before the grey blockout, frozen on its old 24 x 16 board: the village has no scene
 * while it is a blockout, and this is the only sample with chimneys (`maps/fixtures/oldVillageScene.json`).
 */
async function village() {
  const presentations = await loadTopDownPresentations(
    () =>
      Promise.resolve(
        JSON.parse(
          readFileSync('src/content/maps/fixtures/oldVillageScene.json', 'utf8'),
        ) as unknown,
      ),
    new Map([['ba_dan_village', { url: 'art/topdown/ba-dan/scene.json', cameraCentreMargin: 1 }]]),
  );
  const live = CONTENT.maps.get('ba_dan_village');
  const presentation = presentations.get('ba_dan_village');
  if (!live || !presentation) throw new Error('Missing the frozen top-down village');
  const original = oldVillage(live);
  const map = topDownMap(original, presentation);
  const scene = map.scene;
  const recipe = ambienceFx(map.ambience);
  if (!scene || !recipe?.chimney) throw new Error('Missing shipped village chimney recipe');
  const grid = buildGrid(map);
  const at = (time: number, reduced: boolean) =>
    ambientEmitters(
      recipe,
      grid,
      time,
      scene.chimneys,
      reduced,
      scene.paintedWater ? waterCells(grid) : [],
      scene.canopies,
      { sources: scene.ambienceSources, phase: 'afternoon' },
    );
  return { map, scene, recipe, at };
}

describe('frozen top-down village ambience', () => {
  it('freezes populated smoke geometry a second apart and omits moving ambience', async () => {
    const { map, scene, recipe, at } = await village();
    expect(map.projection).toBe('topdown');
    expect(scene.chimneys).toHaveLength(5);
    expect(scene.chimneys?.some(({ y }) => y < 0)).toBe(true);
    const first = at(12_000, true);
    const later = at(13_000, true);
    expect(first).toHaveLength(10);
    expect(first.every((emitter) => emitter.def === recipe.chimney && emitter.still)).toBe(true);
    expect(later).toEqual(first);
    expect(new Set(first.map(({ from }) => `${from.x},${from.y}`)).size).toBe(5);
    const particles = geometry(first);
    expect(particles.flat().length).toBeGreaterThan(0);
    for (let chimney = 0; chimney < 5; chimney++)
      expect(particles.slice(chimney * 2, chimney * 2 + 2).flat().length).toBeGreaterThan(0);
    expect(particles.every((sample) => sample.every(Number.isFinite))).toBe(true);
    expect(geometry(later)).toEqual(particles);
  });

  it('moves actual smoke geometry when motion is enabled on the same scene', async () => {
    const { recipe, at } = await village();
    const smoke = (time: number) => at(time, false).filter(({ def }) => def === recipe.chimney);
    const first = smoke(12_000);
    const later = smoke(13_000);
    expect(first).toHaveLength(10);
    expect(later).toHaveLength(10);
    expect(first.every((emitter) => !emitter.still)).toBe(true);
    const before = geometry(first);
    const after = geometry(later);
    expect(before.flat().length).toBeGreaterThan(0);
    expect(after.flat().length).toBeGreaterThan(0);
    expect(after).not.toEqual(before);
    const positions = (samples: number[][]) =>
      samples.map((sample) => sample.filter((_, index) => index % PARTICLE_STRIDE < 2));
    expect(positions(after)).not.toEqual(positions(before));
  });
});
