import { describe, expect, it } from 'vitest';
import { DISCOVERIES } from '../maps/discoveries';
import { CONTENT, CONTENT_BUNDLE, RETURNEE_IDS } from '../index';
import { createGame } from '../../core/state/createGame';
import type { GameState, StoryNode } from '../../core/types';
import {
  STORY_PRESENTATIONS,
  validateStoryPresentations,
  worldConversationFor,
} from './presentations';

/**
 * The profile-backed Slice B placeholders, named the way the validator names
 * them: an NPC bound to a returnee resident whose conversation is its map's
 * explore hub. `validateContent` defers exactly these by name.
 */
function placeholderProblems(): string[] {
  const exploreMap = new Map(
    CONTENT_BUNDLE.story
      .filter((node): node is Extract<StoryNode, { kind: 'explore' }> => node.kind === 'explore')
      .map((node) => [node.id, node.mapId] as const),
  );
  return CONTENT_BUNDLE.maps.flatMap((map) =>
    map.npcs
      .filter(
        (npc) =>
          npc.resident !== undefined &&
          (RETURNEE_IDS as readonly string[]).includes(npc.resident) &&
          exploreMap.get(npc.node) === map.id,
      )
      .map(
        (npc) =>
          'map "' +
          map.id +
          '" npc "' +
          npc.id +
          '" conversation "' +
          npc.node +
          '" has no story presentation',
      ),
  );
}

function conversation(
  nodeId: string,
  mapId: string,
  screen: GameState['screen'] = 'dialogue',
): GameState {
  const initial = createGame(CONTENT, {
    seed: 'world-presentations',
    party: [{ characterId: 'kaya' }],
    startNode: 'village_explore',
  });
  return {
    ...initial,
    screen,
    location: { ...initial.location, mapId },
    story: { ...initial.story, nodeId, lineIndex: 1 },
  };
}

describe('world conversation presentations', () => {
  it('validates every explicit and generated presentation against content', () => {
    // The returnee placeholders are the only NPC conversations that go without
    // one, and `validateContent` defers precisely those.
    expect(
      validateStoryPresentations(STORY_PRESENTATIONS, CONTENT_BUNDLE.story, CONTENT_BUNDLE.maps),
    ).toEqual(placeholderProblems());

    for (const discovery of DISCOVERIES) {
      expect(STORY_PRESENTATIONS['discover_' + discovery.id]).toEqual({
        kind: 'world',
        mapId: discovery.map,
      });
      expect(STORY_PRESENTATIONS['revisit_' + discovery.id]).toEqual({
        kind: 'world',
        mapId: discovery.map,
      });
    }
  });

  /*
   * A resident NPC standing on its own map's explore hub is a silent bounce to
   * exploration, not a conversation: tapping them does nothing. Only the
   * profile-backed returnees are meant to sit like that, and that exception is
   * `validateContent`'s to make, so an ordinary resident must be rejected here.
   */
  it('rejects an ordinary resident bound to its map explore node', () => {
    const village = CONTENT_BUNDLE.maps.find((map) => map.id === 'ba_dan_village');
    const dorin = village?.npcs.find((npc) => npc.id === 'guard_dorin');
    if (!village || !dorin) throw new Error('Missing village Dorin');
    const maps = CONTENT_BUNDLE.maps.map((map) =>
      map === village
        ? {
            ...map,
            npcs: map.npcs.map((npc) =>
              npc === dorin ? { ...npc, node: 'village_explore' } : npc,
            ),
          }
        : map,
    );
    expect(validateStoryPresentations(STORY_PRESENTATIONS, CONTENT_BUNDLE.story, maps)).toContain(
      'map "ba_dan_village" npc "guard_dorin" conversation "village_explore" has no story presentation',
    );
  });

  it('retains the map only for an exact eligible location and screen', () => {
    const eligible = conversation('discover_duck_nest', 'forest_road');
    expect(
      worldConversationFor(CONTENT, conversation('discover_duck_nest', 'forest_road')),
    ).toEqual({
      kind: 'world',
      mapId: 'forest_road',
    });
    expect(
      worldConversationFor(CONTENT, conversation('discover_duck_nest', 'ba_dan_village')),
    ).toBeUndefined();
    expect(
      worldConversationFor(CONTENT, conversation('discover_duck_nest', 'forest_road', 'explore')),
    ).toBeUndefined();
    expect(
      worldConversationFor(CONTENT, {
        ...eligible,
        battle: {} as GameState['battle'],
      }),
    ).toBeUndefined();
  });

  it('keeps staged interludes and unknown nodes on the ordinary dialogue route', () => {
    expect(
      worldConversationFor(CONTENT, conversation('act1_open', 'ba_dan_village')),
    ).toBeUndefined();
    expect(
      worldConversationFor(CONTENT, conversation('quarry_descent', 'quarry_floor')),
    ).toBeUndefined();
    expect(
      worldConversationFor(CONTENT, conversation('missing_node', 'ba_dan_village')),
    ).toBeUndefined();
  });

  it('retains the quarry floor for the marker assessment after its interlude', () => {
    expect(
      worldConversationFor(CONTENT, conversation('quarry_assessment', 'quarry_floor')),
    ).toEqual({ kind: 'world', mapId: 'quarry_floor' });
    expect(
      worldConversationFor(CONTENT, conversation('quarry_assessment', 'ambush_road')),
    ).toBeUndefined();
  });

  it.each([
    ['after_forest', 'forest_road', 'lost_forest_road'],
    ['after_ambush', 'ambush_road', 'lost_ambush'],
  ])('keeps %s in the world after battle results are absorbed', (nodeId, mapId, lossFlag) => {
    const aftermath = conversation(nodeId, mapId);
    expect(worldConversationFor(CONTENT, aftermath)).toEqual({
      kind: 'world',
      mapId,
    });
    expect(
      worldConversationFor(CONTENT, {
        ...aftermath,
        flags: { ...aftermath.flags, [lossFlag]: true },
      }),
    ).toEqual({ kind: 'world', mapId });
  });

  it('rejects a registry entry that points at a missing node', () => {
    const problems = validateStoryPresentations(
      { ...STORY_PRESENTATIONS, missing_node: { kind: 'world', mapId: 'ba_dan_village' } },
      CONTENT_BUNDLE.story,
      CONTENT_BUNDLE.maps,
    );
    expect(problems).toContain('story presentation "missing_node" points to a missing story node');
  });
});
