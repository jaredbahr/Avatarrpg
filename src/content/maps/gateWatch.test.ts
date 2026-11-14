import { describe, expect, it } from 'vitest';
import { CONTENT } from '../index';
import { createGame } from '../../core/state/createGame';
import { visibleNpcs } from '../../core/story/world';
import { buildGrid, tileAt } from '../../core/rules/grid';
import type { GameState } from '../../core/types';
import { GATE_WATCHERS } from './gateWatch';
import { TOPDOWN_KEYS, topdownSheet } from '../assets/manifest';
import { headingClip } from '../assets/clips';

function game(): GameState {
  return createGame(CONTENT, {
    seed: 'gate-watch-696',
    party: [{ characterId: 'kaya' }, { characterId: 'sura' }, { characterId: 'bo' }],
    startNode: 'village_explore',
  });
}

/** A table that has walked these nodes in order, standing on the last. */
function walked(base: GameState, nodes: readonly string[]): GameState {
  return { ...base, story: { ...base.story, nodeId: nodes.at(-1) ?? null, visited: [...nodes] } };
}

describe('the quarry gate watchers (#696)', () => {
  const map = CONTENT.maps.get('quarry_gate');
  const watching = (nodes: readonly string[]) => {
    if (!map) return [];
    const state = {
      ...walked(game(), nodes),
      location: { mapId: map.id, pos: { x: 8, y: 5 } },
    };
    return visibleNpcs(CONTENT, map, state)
      .filter((npc) => GATE_WATCHERS.some((watcher) => watcher.id === npc.id))
      .map((npc) => npc.id);
  };

  it('stand on open ground under the curtain wall', () => {
    expect(map).toBeDefined();
    if (!map) return;
    const grid = buildGrid(map);
    for (const watcher of GATE_WATCHERS) {
      expect(watcher.pos?.y).toBe(1);
      expect(watcher.pos && tileAt(grid, watcher.pos)?.blocked).toBe(false);
      expect(map.npcs.some((npc) => npc.id === watcher.id)).toBe(true);
    }
    // The wall row above them is the wall.
    for (const watcher of GATE_WATCHERS)
      expect(watcher.pos && tileAt(grid, { x: watcher.pos.x, y: 0 })?.blocked).toBe(true);
  });

  it('include the deserter the parley names, beside the east stack of barrels', () => {
    // "A Fire Nation deserter stands beside the oil barrels": the same figure the
    // gate fight then fields, on the open cell #725 left for him.
    const deserter = GATE_WATCHERS.find((npc) => npc.id === 'gate_watch_deserter');
    expect(deserter?.pos).toEqual({ x: 13, y: 1 });
    expect(deserter?.sprite).toBe(CONTENT.enemies.get('fire_deserter')?.sprite);
    const fight = CONTENT.encounters.get('enc_quarry_gate');
    expect(fight?.enemies.some((enemy) => enemy.enemyId === 'fire_deserter')).toBe(true);
    const others = GATE_WATCHERS.filter((npc) => npc !== deserter).map((npc) => npc.pos);
    expect(others).not.toContainEqual(deserter?.pos);
  });

  it('are there only while the parley is read', () => {
    const ids = GATE_WATCHERS.map((watcher) => watcher.id);
    expect(watching(['forest_after_explore'])).toEqual([]);
    expect(watching(['forest_after_explore', 'gate_parley'])).toEqual(ids);
    expect(watching(['forest_after_explore', 'gate_parley', 'battle_quarry_gate'])).toEqual([]);
    expect(
      watching([
        'forest_after_explore',
        'gate_parley',
        'gate_bluff',
        'battle_quarry_gate',
        'ruon_surrender',
      ]),
    ).toEqual([]);
    // An earthbender's talk: they watch until Ruon has the gate opened.
    expect(watching(['forest_after_explore', 'gate_parley', 'gate_kinship'])).toEqual(ids);
    expect(
      watching(['forest_after_explore', 'gate_parley', 'gate_kinship', 'gate_talked_through']),
    ).toEqual([]);
    expect(
      watching([
        'forest_after_explore',
        'gate_parley',
        'battle_quarry_gate',
        'ruon_surrender',
        'ruon_choice',
        'gate_escort_explore',
        'act1_victory',
        'gate_return_explore',
      ]),
    ).toEqual([]);
  });

  it('face the party coming up to the gate, on their own top-down idle', () => {
    // The parley is read with the leader on (8, 5), below the wall: due south of
    // the hauler, a little east of south from the worker, and down and west of
    // the deserter at the east stack of barrels.
    const party = { x: 8, y: 5 };
    for (const watcher of GATE_WATCHERS) {
      const pos = watcher.pos;
      expect(pos).toBeDefined();
      if (!pos) continue;
      const dx = party.x - pos.x;
      const dy = party.y - pos.y;
      // Within 45 degrees of the party: the hauler and the worker look south, the
      // deserter (five columns east of the party, four rows up) south-west.
      const toParty = Math.atan2(dy, dx);
      const faced = { south: Math.PI / 2, southWest: (3 * Math.PI) / 4 }[
        watcher.faces as 'south' | 'southWest'
      ];
      expect(faced, watcher.id).toBeDefined();
      expect(Math.abs(toParty - (faced ?? 0)), watcher.id).toBeLessThan(Math.PI / 4);
      const heading = watcher.faces;
      if (!heading) continue;
      const sheet = TOPDOWN_KEYS[watcher.sprite];
      expect(sheet).toBeDefined();
      if (!sheet) continue;
      const entry = topdownSheet(sheet[0], watcher.sprite, sheet[1]);
      expect(entry.clips[headingClip('idle', heading)]?.frames.length).toBeGreaterThan(0);
    }
  });
});
