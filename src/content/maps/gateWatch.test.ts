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
    // the hauler and a little east of south from the worker.
    const party = { x: 8, y: 5 };
    for (const watcher of GATE_WATCHERS) {
      expect(watcher.faces).toBe('south');
      const pos = watcher.pos;
      expect(pos).toBeDefined();
      if (!pos) continue;
      expect(party.y - pos.y).toBeGreaterThan(2 * Math.abs(party.x - pos.x) - 1);
      const sheet = TOPDOWN_KEYS[watcher.sprite];
      expect(sheet).toBeDefined();
      if (!sheet) continue;
      const entry = topdownSheet(sheet[0], watcher.sprite, sheet[1]);
      expect(entry.clips[headingClip('idle', 'south')]?.frames.length).toBeGreaterThan(0);
    }
  });
});
