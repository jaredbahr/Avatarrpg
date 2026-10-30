import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { buildGrid, distance, posKey, tileAt } from '../rules/grid';
import { partyOfSize } from '../sim/balance';
import { createGame } from '../state/createGame';
import { apply } from '../state/reducer';
import type { GameState, MapDef, Vec2 } from '../types';
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

function smallRoad(rows: readonly string[], props: readonly Vec2[]): MapDef {
  const base = CONTENT.maps.get('ambush_road');
  if (!base) throw new Error('Missing Cutting map');
  return {
    ...base,
    width: rows[0]?.length ?? 0,
    height: rows.length,
    rows,
    props: props.map((pos) => ({ propId: 'water_barrel', pos })),
  };
}

describe('battle crossing return', () => {
  it('keeps the Cutting ambush spawns and both outcomes on clear road', () => {
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
      expect(resolved.state.location).toEqual({ mapId: map.id, pos: { x: 8, y: 4 } });
      expect(resolved.state.world.returnPos[map.id]).toEqual({ x: 8, y: 4 });
    }
  });

  it('keeps a clear crossing, but moves the Forest Road crossing away from painted rubble', () => {
    const road = smallRoad(['XXXXX', 'X===X', 'XXXXX'], []);
    expect(battleReturnTile(CONTENT, road, { x: 2, y: 1 })).toEqual({ x: 2, y: 1 });
    const forest = CONTENT.maps.get('forest_road');
    if (!forest) throw new Error('Missing Forest Road map');
    expect(battleReturnTile(CONTENT, forest, { x: 8, y: 4 })).toEqual({ x: 9, y: 4 });
  });

  it('rejects a nearer road beyond a wall and reaches the farther road by walking', () => {
    const road = smallRoad(
      ['XXXXXX', 'X=X==X', 'X,XXXX', 'X,XXXX', 'X=XXXX', 'XXXXXX'],
      [{ x: 1, y: 1 }],
    );
    expect(battleReturnTile(CONTENT, road, { x: 1, y: 1 })).toEqual({ x: 1, y: 4 });
  });

  it('prefers reachable road over adjacent grass when the crossing is occupied', () => {
    const road = smallRoad(['XXXXX', 'X=XXX', 'X,XXX', 'X=XXX', 'XXXXX'], [{ x: 1, y: 1 }]);
    expect(battleReturnTile(CONTENT, road, { x: 1, y: 1 })).toEqual({ x: 1, y: 3 });
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
          const returned = battleReturnTile(CONTENT, map, crossing);
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
