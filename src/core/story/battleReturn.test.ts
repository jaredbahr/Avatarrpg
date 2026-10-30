import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { buildGrid, distance, posKey, tileAt } from '../rules/grid';
import { partyOfSize } from '../sim/balance';
import { createGame } from '../state/createGame';
import { apply } from '../state/reducer';
import type { GameState, Vec2 } from '../types';
import { battleReturnTile } from './battleReturn';
import { enterStoryNode } from './storyEngine';

function atCrossing(mapId: string, pos: Vec2): GameState {
  const state = createGame(CONTENT, {
    seed: `return-${mapId}-${posKey(pos)}`,
    party: partyOfSize(3),
    startNode: 'forest_explore',
  });
  return {
    ...state,
    screen: 'explore',
    location: { mapId, pos },
    world: { ...state.world, returnPos: { ...state.world.returnPos, [mapId]: pos } },
  };
}

describe('battle crossing return', () => {
  it('keeps the Cutting ambush spawns and moves both outcomes to clear road', () => {
    const map = CONTENT.maps.get('ambush_road');
    if (!map) throw new Error('Missing Cutting map');
    for (const phase of ['victory', 'defeat'] as const) {
      const started = enterStoryNode(CONTENT, atCrossing(map.id, { x: 8, y: 4 }), 'battle_ambush');
      const battle = started.state.battle;
      if (!battle) throw new Error('Missing ambush battle');
      expect(
        battle.units.filter((unit) => unit.faction === 'party').map((unit) => unit.pos),
      ).toEqual(map.partySpawns.slice(0, 3));
      const resolved = apply(
        CONTENT,
        { ...started.state, battle: { ...battle, phase } },
        { type: 'resolveBattle' },
      );
      expect(resolved.state.location).toEqual({ mapId: map.id, pos: { x: 9, y: 4 } });
      expect(resolved.state.world.returnPos[map.id]).toEqual({ x: 9, y: 4 });
    }
  });

  it('finds a dry, walkable return beside every battle crossing without props or painted rubble', () => {
    let checked = 0;
    for (const map of CONTENT.maps.values()) {
      const grid = buildGrid(map);
      const props = new Set(map.props.map(({ pos }) => posKey(pos)));
      for (const trigger of map.triggers ?? []) {
        const node = CONTENT.story.get(trigger.node);
        if (node?.kind !== 'battle') continue;
        for (const crossing of trigger.area) {
          const returned = battleReturnTile(map, crossing);
          expect(returned, `${map.id} ${posKey(crossing)}`).not.toBeNull();
          if (!returned) continue;
          const tile = tileAt(grid, returned);
          expect(tile?.blocked, `${map.id} ${posKey(crossing)}`).toBe(false);
          expect(tile?.surface?.id, `${map.id} ${posKey(crossing)}`).not.toBe('water');
          expect(tile?.surface?.id, `${map.id} ${posKey(crossing)}`).not.toBe('rubble');
          expect(props.has(posKey(returned)), `${map.id} ${posKey(crossing)}`).toBe(false);
          expect(
            (map.scene?.paintedRubble ?? []).every((cell) => distance(cell, returned) > 1),
            `${map.id} ${posKey(crossing)}`,
          ).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
