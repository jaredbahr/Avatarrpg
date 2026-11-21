import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { TOPDOWN_SCENES } from '../../content/topdown';
import { topDownSceneSchema } from '../../content/topdownSceneSchema';
import { createGame } from '../../core/state/createGame';
import type { GameState, MapDef, MapScene } from '../../core/types';
import { gatesOf, sceneForStory } from './sceneGates';

function game(visited: readonly string[] = []): GameState {
  const base = createGame(CONTENT, {
    seed: 'scene-gates',
    party: [{ characterId: 'kaya' }, { characterId: 'sura' }, { characterId: 'bo' }],
    startNode: 'village_explore',
  });
  return { ...base, story: { ...base.story, visited: [...visited] } };
}

const piece = (id: string, gate?: string) => ({
  id,
  url: 'art/topdown/x/uprights.webp',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  footprint: [],
  depth: { x: 0, y: 0 },
  ...(gate !== undefined && { gate }),
});

const SCENE: MapScene = {
  ground: [
    { url: 'art/topdown/x/ground.webp', x: 0, y: 0, width: 1, height: 1 },
    { url: 'art/topdown/x/overlays.webp', x: 0, y: 0, width: 1, height: 1, gate: 'after' },
  ],
  scenery: [
    piece('tree'),
    piece('camp', 'before'),
    piece('sack', 'after'),
    piece('stray', 'nowhere'),
  ],
};

const MAP = {
  id: 'x',
  scene: SCENE,
  sceneGates: {
    before: { kind: 'not', of: { kind: 'visited', nodeId: 'won' } },
    after: { kind: 'visited', nodeId: 'won' },
  },
} as unknown as MapDef;

describe('the story over the scene (ADR 0123)', () => {
  it('draws each gated piece only while its gate holds, and never one whose gate is not defined', () => {
    const before = sceneForStory(MAP, game());
    expect(before?.ground.map((g) => g.url)).toEqual(['art/topdown/x/ground.webp']);
    expect(before?.scenery.map((s) => s.id)).toEqual(['tree', 'camp']);
    const after = sceneForStory(MAP, game(['won']));
    expect(after?.ground).toHaveLength(2);
    expect(after?.scenery.map((s) => s.id)).toEqual(['tree', 'sack']);
    expect(sceneForStory(MAP, null)?.scenery.map((s) => s.id)).toEqual(['tree']);
  });

  it('hands back the same scene while nothing a gate reads has changed', () => {
    const a = sceneForStory(MAP, game());
    expect(sceneForStory(MAP, game(['elsewhere']))).toBe(a);
    expect(sceneForStory(MAP, game(['won']))).not.toBe(a);
    const ungated = { ...MAP, scene: { ...SCENE, ground: SCENE.ground.slice(0, 1), scenery: [] } };
    expect(sceneForStory(ungated, game())).toBe(ungated.scene);
  });

  it('gives every gate a shipped scene names a condition on its map', () => {
    expect(TOPDOWN_SCENES.size).toBeGreaterThan(0);
    for (const [mapId, source] of TOPDOWN_SCENES) {
      const scene = topDownSceneSchema(source.url).parse(
        JSON.parse(readFileSync(`public/${source.url}`, 'utf8')),
      );
      const map = CONTENT.maps.get(mapId);
      for (const gate of gatesOf(scene))
        expect(map?.sceneGates?.[gate], `${mapId} gate ${gate}`).toBeDefined();
    }
  });

  it('dresses the river road for each of SF-2.3’s outcomes', () => {
    const road = CONTENT.maps.get('river_road');
    if (!road) throw new Error('river_road');
    const scene = topDownSceneSchema('art/topdown/river-road/scene.json').parse(
      JSON.parse(readFileSync('public/art/topdown/river-road/scene.json', 'utf8')),
    );
    const at = (visited: readonly string[]) =>
      sceneForStory({ ...road, scene }, game(visited))
        ?.scenery.filter((s) => s.gate !== undefined)
        .map((s) => s.id.replace('river_road.td.', ''))
        .sort();
    // the packs, the ring and the rubbish are grounded flats in the camp's overlay; these are its uprights
    const camp = ['camp-pot', 'camp-toll-sign'];
    expect(at([])).toEqual(['bridge-toll-pole', ...camp].sort());
    expect(at(['sf23_battle', 'sf23_pole_up', 'sf23_won'])).toEqual(['bridge-toll-pole-up']);
    expect(at(['sf23_battle', 'sf23_lost', 'sf23_one_sack'])).toEqual(
      ['bridge-toll-pole-up', 'camp-cabbage-sack', ...camp].sort(),
    );
  });
});
