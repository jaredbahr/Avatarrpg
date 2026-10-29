import { describe, expect, it } from 'vitest';
import { placeParty } from '../../app/anim/trail';
import { CONTENT, CONTENT_BUNDLE } from '../../content';
import { validateContent } from '../../content/schemas';
import { buildGrid, tileAt } from '../rules/grid';
import { partyOfSize } from '../sim/balance';
import { enterStoryNode } from '../story/storyEngine';
import type { GameState, Vec2 } from '../types';
import { createBattle, createGame } from './createGame';
import { apply } from './reducer';
import { deserialize, serialize, stateFromBlob } from '../save/serialize';
import { RngCursor } from '../rng';

const node = CONTENT.story.get('battle_forest_road');
if (node?.kind !== 'battle' || !node.approach) throw new Error('Missing forest approach');
const entries = node.approach.entries;
const approachMapId = node.approach.mapId;
const map = CONTENT.maps.get('forest_road');
if (!map) throw new Error('Missing forest road');
const mapId = map.id;

const key = ({ x, y }: Vec2) => `${x},${y}`;

function atCrossing(count: number, at: Vec2): GameState {
  const seed = createGame(CONTENT, {
    seed: `forest-approach-${count}-${key(at)}`,
    party: partyOfSize(count),
    startNode: 'forest_explore',
  });
  const explore = apply(CONTENT, seed, { type: 'enterNode', nodeId: 'forest_explore' }).state;
  return { ...explore, location: { mapId, pos: at } };
}

function finishDialogue(state: GameState): GameState {
  for (let i = 0; i < 40 && state.screen === 'dialogue'; i++)
    state = apply(CONTENT, state, { type: 'advanceDialogue' }).state;
  return state;
}

describe('forest approach continuity', () => {
  it('rejects a missing crossing row, an occupied combat spawn, and an occupied return line', () => {
    const withEntries = (changed: typeof entries) =>
      validateContent({
        ...CONTENT_BUNDLE,
        story: CONTENT_BUNDLE.story.map((storyNode) =>
          storyNode.id === node.id
            ? { ...node, approach: { mapId: approachMapId, entries: changed } }
            : storyNode,
        ),
      });
    expect(withEntries(entries.slice(0, -1))).toContain(
      'story node "battle_forest_road" has no approach for crossing (8,10)',
    );
    expect(
      withEntries(
        entries.map((entry) =>
          entry.at.y === 4
            ? { ...entry, partySpawns: [{ x: 14, y: 4 }, ...entry.partySpawns.slice(1)] }
            : entry,
        ),
      ),
    ).toContain('story node "battle_forest_road" approach (8,4) has unsafe spawn (14,4)');
    expect(
      withEntries(
        entries.map((entry) =>
          entry.at.y === 4 ? { ...entry, returnPos: { x: 9, y: 4 } } : entry,
        ),
      ),
    ).toContain('story node "battle_forest_road" approach (8,4) has unsafe return seat (14,4)');
  });

  it('enters on the actual main crossing and keeps direct battle creation unchanged', () => {
    const poised = atCrossing(3, { x: 7, y: 4 });
    const entered = apply(CONTENT, poised, { type: 'walkTo', pos: { x: 19, y: 4 } });
    expect(entered.state.story.nodeId).toBe('battle_forest_road');
    expect(entered.state.world.returnPos.forest_road).toEqual({ x: 8, y: 4 });
    expect(
      entered.state.battle?.units.filter((u) => u.faction === 'party').map((u) => u.pos),
    ).toEqual(entries.find((entry) => entry.at.y === 4)?.partySpawns.slice(0, 3));
    const direct = createBattle(CONTENT, poised, 'enc_forest_road', new RngCursor(poised.rng));
    expect(direct.units.filter((u) => u.faction === 'party').map((u) => u.pos)).toEqual(
      map.partySpawns.slice(0, 3),
    );
  });

  it('places parties of one through six on safe authored cells for every crossing row', () => {
    const grid = buildGrid(map);
    const props = new Set(map.props.map((placement) => key(placement.pos)));
    expect(entries.map(({ at }) => at.y)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const entry of entries) {
      for (let count = 1; count <= 6; count++) {
        const start = atCrossing(count, entry.at);
        const battle = enterStoryNode(CONTENT, start, 'battle_forest_road').state.battle;
        const party = battle?.units.filter((unit) => unit.faction === 'party') ?? [];
        expect(
          party.map((unit) => unit.pos),
          `${key(entry.at)} / ${count}`,
        ).toEqual(entry.partySpawns.slice(0, count));
        expect(new Set(party.map((unit) => key(unit.pos))).size).toBe(count);
        for (const unit of party) {
          const tile = tileAt(grid, unit.pos);
          expect(tile?.blocked, key(unit.pos)).toBe(false);
          expect(['water', 'rubble'].includes(tile?.surface?.id ?? ''), key(unit.pos)).toBe(false);
          expect(props.has(key(unit.pos)), key(unit.pos)).toBe(false);
        }
        const returned = placeParty(grid, entry.returnPos, count);
        expect(new Set(returned.map(key)).size).toBe(count);
        for (const pos of returned) {
          const tile = tileAt(grid, pos);
          expect(tile?.blocked, key(pos)).toBe(false);
          expect(['water', 'rubble'].includes(tile?.surface?.id ?? ''), key(pos)).toBe(false);
          expect(props.has(key(pos)), key(pos)).toBe(false);
        }
      }
    }
  });

  for (const defeat of [false, true]) {
    it(`returns beside every crossing after ${defeat ? 'defeat' : 'victory'}, including a dialogue reload`, () => {
      for (const entry of entries) {
        const started = enterStoryNode(
          CONTENT,
          atCrossing(3, entry.at),
          'battle_forest_road',
        ).state;
        if (!started.battle) throw new Error('Missing battle');
        const result = apply(
          CONTENT,
          { ...started, battle: { ...started.battle, phase: defeat ? 'defeat' : 'victory' } },
          { type: 'resolveBattle' },
        ).state;
        expect(result.screen, key(entry.at)).toBe('dialogue');
        expect(result.world.returnPos.forest_road, key(entry.at)).toEqual(entry.returnPos);
        expect(result.location, key(entry.at)).toEqual({ mapId, pos: entry.returnPos });
        const saved = deserialize(
          serialize(result, {
            label: 'Forest',
            summary: 'After battle',
            savedAt: 1,
            session: { players: [] },
          }),
        );
        if (!saved.ok) throw new Error(saved.error);
        const explore = finishDialogue(stateFromBlob(saved.blob));
        expect(explore.screen, key(entry.at)).toBe('explore');
        expect(explore.location, key(entry.at)).toEqual({ mapId: map.id, pos: entry.returnPos });
        expect(explore.world.cleared.includes('enc_forest_road'), key(entry.at)).toBe(!defeat);
        const departed = apply(CONTENT, explore, { type: 'walkTo', pos: { x: 19, y: 4 } }).state;
        expect(departed.location.mapId, key(entry.at)).toBe('quarry_gate');
        expect(departed.world.returnPos.forest_road, key(entry.at)).toEqual({ x: 19, y: 4 });
      }
    });
  }
});
