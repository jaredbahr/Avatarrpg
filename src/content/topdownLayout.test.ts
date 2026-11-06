/**
 * The top-down layout rules (ADR 0104 §3): Ba Dan's layout agrees with `village.ts`, and each rule
 * fails on a fixture built to break it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MapDef } from '../core/types';
import { CONTENT, CONTENT_BUNDLE } from './index';
import { validateContent, validateTopDownLayout } from './schemas';
import type { TopDownLayout, TopDownObject } from './topdownLayout';
import { BA_DAN_TOPDOWN_LAYOUT, TOPDOWN_LAYOUTS } from './topdownLayouts';
import {
  classifyPoint,
  MOUTHS,
  type GroundClass,
  type Terrain,
  type TopDownTerrainLayer,
} from './scenes/baDan.topdown.terrain';

/** The village as the game runs it, with the exits `connectAct1` adds (the riverside path). */
function village(): MapDef {
  const map = CONTENT.maps.get('ba_dan_village');
  if (!map) throw new Error('no village');
  return map;
}

describe("Ba Dan's top-down layout", () => {
  it('passes the content validation with its map', () => {
    const problems = validateContent({ ...CONTENT_BUNDLE, topdownLayouts: TOPDOWN_LAYOUTS });
    expect(problems, `\n${problems.join('\n')}\n`).toEqual([]);
  });

  it('keeps the classifier pure and seeded', () => {
    const source = readFileSync('src/content/scenes/baDan.topdown.terrain.ts', 'utf8');
    expect(source).not.toMatch(/Math\.random\(|Date\.now\(|document\.\w|window\.\w/);
    expect(classifyPoint(380, 260)).toEqual(classifyPoint(380, 260));
  });

  it('reads the canal and the ford as water and the crossings as ground', () => {
    expect(classifyPoint(5 * 40 + 20, 6 * 40 + 20).ground).toBe('water');
    expect(classifyPoint(20, 7 * 40 + 20).ground).toBe('water');
    expect(classifyPoint(13 * 40 + 20, 6 * 40 + 20).ground).toBe('ground');
    // The bridge's cell is water under its deck; the deck carries it.
    expect(classifyPoint(9 * 40 + 20, 6 * 40 + 20).ground).toBe('water');
    expect(BA_DAN_TOPDOWN_LAYOUT.objects.find((o) => o.id === 'bridge')?.deck).toBe(true);
  });

  it('opens the east road and the river steps as rim mouths', () => {
    expect(MOUTHS.map((m) => m.id)).toEqual(['east-road', 'riverside-steps']);
  });
});

/** A 4x3 board: an open middle, a blocked rock at (1, 1), the exit at (3, 1). */
const FIXTURE: MapDef = {
  id: 'fixture.topdown-layout',
  name: 'Top-down layout fixture',
  kind: 'explore',
  projection: 'topdown',
  width: 4,
  height: 3,
  rows: ['....', '.T..', '....'],
  legend: { '.': { terrain: 'grass' }, T: { terrain: 'grass', blocked: true } },
  partySpawns: [{ x: 0, y: 1 }],
  npcs: [{ id: 'post', name: 'Post', pos: { x: 2, y: 2 }, sprite: 'x', node: 'n' }],
  props: [],
  ambience: 'village',
  exit: { pos: { x: 3, y: 1 }, label: 'East' },
};

/** Ground everywhere on the board, a road on row 1, void east of x = 160 (the rim at the exit). */
function terrain(
  over: (x: number, y: number) => GroundClass | null = () => null,
): TopDownTerrainLayer {
  return {
    classify: (x, y) => {
      const forced = over(x, y);
      const ground: GroundClass = forced ?? (x >= 168 ? 'void' : 'ground');
      const road = y >= 40 && y < 80;
      const t: Terrain = ground === 'void' ? 'V' : road ? 'C' : 'G';
      return { ground, terrain: t };
    },
    mouths: [{ id: 'east', side: 'east', cells: [{ x: 3, y: 1 }] }],
    mouthReach: 2,
  };
}

const rock: TopDownObject = {
  id: 'rock',
  sprite: 'rock',
  kind: 'prop',
  x: 60,
  base: 76,
  footprint: [{ x: 1, y: 1 }],
  solid: true,
  depth: { x: 1.5, y: 1.9 },
};

function layout(change: Partial<TopDownLayout> = {}): TopDownLayout {
  return {
    mapId: FIXTURE.id,
    terrain: terrain(),
    objects: [rock],
    slots: [{ id: 'sign', npc: 'post', cell: { x: 2, y: 2 } }],
    ...change,
  };
}

describe('the top-down layout rules', () => {
  it('accepts the sound fixture', () => {
    expect(validateTopDownLayout(FIXTURE, layout())).toEqual([]);
  });

  it('rejects a footprint off the map unless the object is exterior', () => {
    const tree = {
      ...rock,
      id: 'tree',
      footprint: [
        { x: 1, y: 1 },
        { x: 1, y: -1 },
      ],
    };
    expect(validateTopDownLayout(FIXTURE, layout({ objects: [tree] }))).toEqual([
      'map "fixture.topdown-layout" top-down layout object "tree" has footprint (1,-1) off the map and is not exterior',
    ]);
    expect(
      validateTopDownLayout(FIXTURE, layout({ objects: [{ ...tree, exterior: true }] })),
    ).toEqual([]);
  });

  it('rejects a blocked cell that nothing solid or blocked covers', () => {
    expect(validateTopDownLayout(FIXTURE, layout({ objects: [] }))).toEqual([
      'map "fixture.topdown-layout" top-down layout blocked (1,1) is neither a solid object\'s footprint nor blocked terrain',
    ]);
    // Blocked terrain covers it as well as a solid piece does.
    const pond = terrain((x, y) => (x >= 40 && x < 80 && y >= 40 && y < 80 ? 'water' : null));
    expect(validateTopDownLayout(FIXTURE, layout({ objects: [], terrain: pond }))).toEqual([]);
  });

  it('rejects a solid object on an open cell', () => {
    const crate = {
      ...rock,
      id: 'crate',
      footprint: [
        { x: 1, y: 1 },
        { x: 2, y: 0 },
      ],
    };
    expect(validateTopDownLayout(FIXTURE, layout({ objects: [crate] }))).toEqual([
      'map "fixture.topdown-layout" top-down layout solid object "crate" stands on open cell (2,0)',
    ]);
  });

  it('rejects a walkable centre on void, cliff or water, unless a deck carries it', () => {
    const hole = terrain((x, y) => (x >= 80 && x < 120 && y < 40 ? 'cliff' : null));
    expect(validateTopDownLayout(FIXTURE, layout({ terrain: hole }))).toEqual([
      'map "fixture.topdown-layout" top-down layout walkable (2,0) has its centre on cliff',
    ]);
    const canal = terrain((x, y) => (x >= 80 && x < 120 && y < 40 ? 'water' : null));
    const deck: TopDownObject = {
      ...rock,
      id: 'deck',
      kind: 'bridge',
      footprint: [{ x: 2, y: 0 }],
      solid: false,
      deck: true,
    };
    expect(validateTopDownLayout(FIXTURE, layout({ terrain: canal }))).toEqual([
      'map "fixture.topdown-layout" top-down layout walkable (2,0) has its centre on water',
    ]);
    expect(
      validateTopDownLayout(FIXTURE, layout({ terrain: canal, objects: [rock, deck] })),
    ).toEqual([]);
  });

  it('rejects water reaching into where a figure stands, though the centre is dry', () => {
    const lapping = terrain((x, y) => (x >= 80 && x < 92 && y < 40 ? 'water' : null));
    expect(validateTopDownLayout(FIXTURE, layout({ terrain: lapping }))).toEqual([
      'map "fixture.topdown-layout" top-down layout walkable (2,0) has water where a figure stands',
    ]);
  });

  it('rejects an exit that is not on a rim mouth', () => {
    const closed = { ...terrain(), mouths: [] };
    expect(validateTopDownLayout(FIXTURE, layout({ terrain: closed }))).toEqual([
      'map "fixture.topdown-layout" top-down layout exit (3,1) is not on a rim mouth',
    ]);
  });

  it('rejects a mouth that leaves its road, runs into a solid piece or never reaches the rim', () => {
    // one cell of a mouth on its road is enough; the others may cross grass to the rim
    const wide = {
      ...terrain(),
      mouths: [
        {
          id: 'east',
          side: 'east' as const,
          cells: [
            { x: 3, y: 1 },
            { x: 3, y: 2 },
          ],
        },
      ],
    };
    expect(validateTopDownLayout(FIXTURE, layout({ terrain: wide }))).toEqual([]);
    const grass = {
      ...terrain(),
      mouths: [{ id: 'east', side: 'east' as const, cells: [{ x: 3, y: 2 }] }],
    };
    expect(validateTopDownLayout(FIXTURE, layout({ terrain: grass }))).toContain(
      'map "fixture.topdown-layout" top-down layout mouth "east" at (3,2) leaves its road for ground (G) 0 px out',
    );
    const far = { ...terrain((x) => (x >= 168 ? 'ground' : null)) };
    expect(validateTopDownLayout(FIXTURE, layout({ terrain: far }))).toContain(
      'map "fixture.topdown-layout" top-down layout mouth "east" at (3,1) does not reach the rim within 2 cells',
    );
    const west = {
      ...terrain(),
      mouths: [
        {
          id: 'east',
          side: 'west' as const,
          cells: [
            { x: 3, y: 1 },
            { x: 3, y: 0 },
          ],
        },
      ],
    };
    const problems = validateTopDownLayout(
      { ...FIXTURE, exit: { pos: { x: 3, y: 0 }, label: 'East' } },
      layout({ terrain: west }),
    );
    expect(problems).toContain(
      'map "fixture.topdown-layout" top-down layout mouth "east" at (3,1) runs into "rock"',
    );
  });

  it('rejects a slot off its NPC or under a solid piece', () => {
    expect(
      validateTopDownLayout(
        FIXTURE,
        layout({ slots: [{ id: 'sign', npc: 'post', cell: { x: 1, y: 1 } }] }),
      ),
    ).toEqual([
      'map "fixture.topdown-layout" top-down layout slot "sign" is not on npc "post"\'s cell',
      'map "fixture.topdown-layout" top-down layout slot "sign" is under a solid object',
    ]);
  });

  it('catches the same faults on the real village', () => {
    const noOak = BA_DAN_TOPDOWN_LAYOUT.objects.filter((o) => o.id !== 'e-oak-10');
    expect(validateTopDownLayout(village(), { ...BA_DAN_TOPDOWN_LAYOUT, objects: noOak })).toEqual([
      'map "ba_dan_village" top-down layout blocked (23,10) is neither a solid object\'s footprint nor blocked terrain',
      'map "ba_dan_village" top-down layout blocked (23,11) is neither a solid object\'s footprint nor blocked terrain',
    ]);
  });
});
