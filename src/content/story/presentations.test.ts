import { describe, expect, it } from 'vitest';
import { DISCOVERIES } from '../maps/discoveries';
import { CONTENT, CONTENT_BUNDLE } from '../index';
import { createGame } from '../../core/state/createGame';
import type { GameState } from '../../core/types';
import {
  STORY_PRESENTATIONS,
  validateStoryPresentations,
  worldConversationFor,
} from './presentations';

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
    expect(
      validateStoryPresentations(STORY_PRESENTATIONS, CONTENT_BUNDLE.story, CONTENT_BUNDLE.maps),
    ).toEqual([]);

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
      worldConversationFor(CONTENT, conversation('missing_node', 'ba_dan_village')),
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
