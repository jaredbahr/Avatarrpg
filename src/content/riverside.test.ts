import { describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_BUNDLE } from './index';
import { npcStandTiles } from './schemas';
import { RIVERSIDE, RIVERSIDE_ENTRY, RIVERSIDE_SPOTS } from './maps/riverside';
import { buildGrid, findPath, tileAt } from '../core/rules/grid';
import { createGame } from '../core/state/createGame';
import { apply } from '../core/state/reducer';

const grid = buildGrid(RIVERSIDE);
const start = () => {
  const state = createGame(CONTENT, {
    seed: 'river-walk',
    party: [{ characterId: 'sura' }, { characterId: 'kaya' }],
    startNode: RIVERSIDE_ENTRY,
  });
  return apply(CONTENT, state, { type: 'enterNode', nodeId: RIVERSIDE_ENTRY }).state;
};

describe('the riverside paths', () => {
  it('connects every activity, neighbor and the exit to the square', () => {
    const state = start();
    for (const pos of [
      ...Object.values(RIVERSIDE_SPOTS),
      // A resident-bound NpcDef has no `pos`: its tiles are its resident's anchors.
      ...RIVERSIDE.npcs.flatMap((n) => npcStandTiles(CONTENT_BUNDLE, RIVERSIDE.id, n)),
      RIVERSIDE.exit!.pos,
    ]) {
      const result = apply(CONTENT, state, { type: 'walkTo', pos });
      expect(
        result.events.filter((e) => e.type === 'message'),
        JSON.stringify(pos),
      ).toEqual([]);
    }
  });
  it('reaches the tea porch by the stone steps while the house and railing stay blocked', () => {
    const route = findPath(
      { grid, blocked: new Set(), surfaces: CONTENT.surfaces, size: 1 },
      start().location.pos,
      RIVERSIDE_SPOTS.tea,
      864,
    );
    expect(route?.path.slice(-3)).toEqual([
      { x: 9, y: 19 },
      { x: 8, y: 19 },
      { x: 8, y: 18 },
    ]);
    for (const pos of [
      { x: 9, y: 18 },
      { x: 8, y: 17 },
      { x: 7, y: 18 },
    ]) {
      expect(apply(CONTENT, start(), { type: 'walkTo', pos }).state.location).toEqual(
        start().location,
      );
    }
  });
  it('takes the bridge to the east bank instead of crossing deep water', () => {
    const route = findPath(
      { grid, blocked: new Set(), surfaces: CONTENT.surfaces, size: 1 },
      start().location.pos,
      RIVERSIDE_SPOTS.practice,
      864,
    );
    expect(route).not.toBeNull();
    const streamCrossing = route!.path.filter((p) => p.x >= 22 && p.x <= 28);
    expect(streamCrossing.length).toBeGreaterThan(0);
    expect(streamCrossing.every((p) => p.y === 11 || p.y === 12)).toBe(true);
    for (const pos of [
      { x: 25, y: 8 },
      { x: 25, y: 16 },
      { x: 5, y: 6 },
      { x: 10, y: 11 },
    ]) {
      const state = start();
      expect(apply(CONTENT, state, { type: 'walkTo', pos }).state.location).toEqual(state.location);
    }
  });
  it('allows a loop around the banyan via the painted western lane', () => {
    let state = start();
    for (const pos of [
      { x: 6, y: 12 },
      { x: 6, y: 10 },
      { x: 6, y: 8 },
      { x: 11, y: 8 },
      { x: 14, y: 10 },
      { x: 14, y: 12 },
    ]) {
      const result = apply(CONTENT, state, { type: 'walkTo', pos });
      expect(
        result.events.filter((e) => e.type === 'message'),
        JSON.stringify(pos),
      ).toEqual([]);
      expect(result.state.location.pos).toEqual(pos);
      state = result.state;
    }
  });
  it('matches the painting: open sand is walkable and painted solids block (R1 audit)', () => {
    const walkable = (x: number, y: number) => tileAt(grid, { x, y })?.blocked === false;
    // The west lane, the path north of the square, the south path beside the
    // exit, the sand pocket south of the square and the south-east bank path.
    for (const [x, y] of [
      [1, 6],
      [3, 8],
      [4, 9],
      [10, 3],
      [11, 5],
      [11, 20],
      [18, 19],
      [20, 21],
      [32, 18],
      [34, 20],
    ] as const) {
      expect(walkable(x, y), `(${x},${y})`).toBe(true);
    }
    // The garden fences, the rocky bank, the practice posts, and the lantern,
    // rock and trunk on the lower east-bank lane.
    for (const [x, y] of [
      [16, 5],
      [10, 16],
      [20, 13],
      [31, 10],
      [30, 11],
      [30, 12],
      [33, 13],
      [30, 14],
      [31, 14],
      [30, 16],
    ] as const) {
      expect(walkable(x, y), `(${x},${y})`).toBe(false);
    }
  });
  it('lets flowers never block on their own: only a solid in the bed does', () => {
    const walkable = (x: number, y: number) => tileAt(grid, { x, y })?.blocked === false;
    // Beds in the square, before the middle house, inside the north-east
    // fence, at the lantern's foot and at the sand pocket's edge.
    for (const [x, y] of [
      [9, 5],
      [10, 5],
      [12, 5],
      [13, 5],
      [5, 7],
      [6, 7],
      [19, 6],
      [20, 5],
      [20, 6],
      [20, 7],
      [4, 10],
      [18, 21],
      [19, 21],
    ] as const) {
      expect(walkable(x, y), `(${x},${y})`).toBe(true);
    }
    // The fence and the flower pot the beds grow against, and the shrine
    // terrace's rocky ledge.
    for (const [x, y] of [
      [16, 5],
      [19, 5],
      [21, 6],
      [12, 4],
      [29, 4],
      [33, 4],
    ] as const) {
      expect(walkable(x, y), `(${x},${y})`).toBe(false);
    }
  });
  it('opens the garden walkway to its painted boundary', () => {
    const walkable = (x: number, y: number) => tileAt(grid, { x, y })?.blocked === false;
    // The slabs west of the porch steps and the lawn they cross.
    for (const [x, y] of [
      [8, 20],
      [5, 21],
      [6, 21],
      [7, 21],
      [8, 21],
      [4, 20],
      [5, 20],
      [6, 20],
    ] as const) {
      expect(walkable(x, y), `(${x},${y})`).toBe(true);
    }
    // Boulders, the fence and its corner post, and the trees to the south.
    for (const [x, y] of [
      [4, 21],
      [7, 20],
      [5, 19],
      [3, 20],
      [5, 22],
      [6, 22],
    ] as const) {
      expect(walkable(x, y), `(${x},${y})`).toBe(false);
    }
    const state = start();
    const result = apply(CONTENT, state, { type: 'walkTo', pos: { x: 5, y: 21 } });
    expect(result.events.filter((e) => e.type === 'message')).toEqual([]);
    expect(result.state.location.pos).toEqual({ x: 5, y: 21 });
  });
  it('leaves by any cell of the south path, never by an invisible edge', () => {
    const exit = CONTENT.maps.get(RIVERSIDE.id)?.exits?.[0];
    const area = new Set((exit?.area ?? []).map((cell) => `${cell.x},${cell.y}`));
    for (let y = 20; y < RIVERSIDE.height; y++) {
      for (let x = 9; x <= 11; x++) {
        if (tileAt(grid, { x, y })?.blocked === false)
          expect(area.has(`${x},${y}`), `(${x},${y})`).toBe(true);
      }
    }
    expect(area.has('10,19')).toBe(false);
  });
  it('returns from the shrine to the same bank, with the discovery recorded', () => {
    let state = apply(CONTENT, start(), { type: 'walkTo', pos: RIVERSIDE_SPOTS.shrine }).state;
    expect(state.story.nodeId).toBe('riverside_shrine');
    const position = state.location.pos;
    for (let i = 0; i < 3; i++) state = apply(CONTENT, state, { type: 'advanceDialogue' }).state;
    expect(state.screen).toBe('explore');
    expect(state.flags.riverside_shrine_found).toBe(true);
    expect(state.location.pos).toEqual(position);
  });
});
