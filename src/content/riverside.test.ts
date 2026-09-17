import { describe, expect, it } from 'vitest';
import { CONTENT } from './index';
import { RIVERSIDE, RIVERSIDE_ENTRY, RIVERSIDE_SPOTS } from './maps/riverside';
import { buildGrid, findPath } from '../core/rules/grid';
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
      ...RIVERSIDE.npcs.map((n) => n.pos),
      RIVERSIDE.exit!.pos,
    ]) {
      const result = apply(CONTENT, state, { type: 'walkTo', pos });
      expect(
        result.events.filter((e) => e.type === 'message'),
        JSON.stringify(pos),
      ).toEqual([]);
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
      { x: 9, y: 9 },
    ]) {
      const state = start();
      expect(apply(CONTENT, state, { type: 'walkTo', pos }).state.location).toEqual(state.location);
    }
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
