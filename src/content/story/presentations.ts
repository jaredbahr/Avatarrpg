/**
 * Story presentation metadata.
 *
 * Story nodes deliberately do not guess where they are from their speaker or
 * portrait. A world conversation opts into the retained exploration scene by
 * naming the map it belongs to here. Staged interludes remain in interludes.ts
 * and therefore keep their illustrated presentation.
 */

import type { ContentIndex, GameState, MapDef, StoryNode } from '../../core/types';
import { INTERLUDES } from './interludes';
import { DISCOVERIES } from '../maps/discoveries';

export interface WorldPresentation {
  readonly kind: 'world';
  readonly mapId: string;
}

export type StoryPresentation = WorldPresentation;

const NPC_PRESENTATIONS: readonly (readonly [string, string])[] = [
  // Ba Dan Village.
  ['riverside_invitation', 'ba_dan_village'],
  ['mira_intro', 'ba_dan_village'],
  ['mira_epilogue', 'ba_dan_village'],
  ['gao_friendly', 'ba_dan_village'],
  ['gao_cold', 'ba_dan_village'],
  ['gao_home', 'ba_dan_village'],
  ['gao_home_cold', 'ba_dan_village'],
  ['pella_tips', 'ba_dan_village'],
  ['pella_again', 'ba_dan_village'],
  ['pella_home', 'ba_dan_village'],
  ['dorin_directions', 'ba_dan_village'],
  ['dorin_home', 'ba_dan_village'],
  // A Ba Dan day (ADR 0047 W6): every conversation node, so a scene keeps its map.
  ['plant_chair', 'ba_dan_village'],
  ['plant_chair_seat', 'ba_dan_village'],
  ['plant_chair_talk', 'ba_dan_village'],
  ['plant_chair_leaf', 'ba_dan_village'],
  ['plant_chair_box', 'ba_dan_village'],
  ['plant_chair_quiet', 'ba_dan_village'],
  ['handover_scene', 'ba_dan_village'],
  ['handover_repeat', 'ba_dan_village'],
  ['handover_float', 'ba_dan_village'],
  ['hanru_watch', 'ba_dan_village'],
  ['school_notice', 'ba_dan_village'],

  // Riverside.
  ['riverside_mira', 'ba_dan_riverside'],
  ['riverside_mira_home', 'ba_dan_riverside'],
  ['riverside_dorin', 'ba_dan_riverside'],
  ['riverside_shrine', 'ba_dan_riverside'],
  ['riverside_pella', 'ba_dan_riverside'],

  // Forest road.
  ['after_forest', 'forest_road'],
  ['forest_dema', 'forest_road'],
  ['forest_dema_again', 'forest_road'],
  ['dema_home', 'forest_road'],
  ['forest_return_arrival', 'forest_road'],

  // The watch speaks at the gate before the party chooses its approach.
  ['gate_parley', 'quarry_gate'],

  // The marker's brief assessment follows the staged descent, but still
  // belongs over the quarry floor where the party is standing.
  ['quarry_assessment', 'quarry_floor'],

  // The cutting.
  ['after_ambush', 'ambush_road'],
  ['cutting_tea', 'ambush_road'],
  ['cutting_tea_again', 'ambush_road'],
  ['sen_home', 'ambush_road'],
] as const;

const world = (mapId: string): WorldPresentation => ({ kind: 'world', mapId });

/** Discovery nodes are derived from the same authored map list as their markers. */
const DISCOVERY_PRESENTATIONS: Readonly<Record<string, WorldPresentation>> = Object.fromEntries(
  DISCOVERIES.flatMap((discovery) => [
    ['discover_' + discovery.id, world(discovery.map)],
    ['revisit_' + discovery.id, world(discovery.map)],
  ]),
);

/** Explicitly reviewed ordinary NPC conversations plus generated discoveries. */
export const STORY_PRESENTATIONS: Readonly<Record<string, StoryPresentation>> = Object.freeze({
  ...Object.fromEntries(NPC_PRESENTATIONS.map(([nodeId, mapId]) => [nodeId, world(mapId)])),
  ...DISCOVERY_PRESENTATIONS,
});

/** Alias for callers that only need the world subset. */
export const WORLD_PRESENTATIONS = STORY_PRESENTATIONS;

export function presentationFor(nodeId: string | null | undefined): StoryPresentation | undefined {
  return nodeId ? STORY_PRESENTATIONS[nodeId] : undefined;
}

function isConversationNode(
  node: StoryNode | undefined,
): node is Extract<StoryNode, { kind: 'dialogue' | 'choice' }> {
  return node?.kind === 'dialogue' || node?.kind === 'choice';
}

/**
 * Returns the world presentation only when the saved state can safely retain
 * its map scene. The exact map id is part of the authored contract, so a
 * malformed or stale node falls back to the ordinary dialogue scene.
 */
export function worldConversationFor(
  content: ContentIndex,
  state: GameState | null | undefined,
): WorldPresentation | undefined {
  if (!state || state.screen !== 'dialogue' || state.battle) return undefined;
  const node = state.story.nodeId ? content.story.get(state.story.nodeId) : undefined;
  if (!isConversationNode(node) || INTERLUDES[node.id]) return undefined;
  const presentation = presentationFor(node.id);
  return presentation?.kind === 'world' && presentation.mapId === state.location.mapId
    ? presentation
    : undefined;
}

/**
 * Cross-reference validation for presentation metadata. Map NPC routes are
 * checked too, so adding a new ordinary conversation cannot silently fall back
 * to a different presentation without an explicit registry entry.
 */
export function validateStoryPresentations(
  registry: Readonly<Record<string, StoryPresentation>>,
  story: readonly StoryNode[],
  maps: readonly MapDef[],
): string[] {
  const problems: string[] = [];
  const storyById = new Map(story.map((node) => [node.id, node]));
  const mapById = new Map(maps.map((map) => [map.id, map]));
  const explorationMapIds = new Set(
    story
      .filter((node): node is Extract<StoryNode, { kind: 'explore' }> => node.kind === 'explore')
      .map((node) => node.mapId),
  );

  for (const [nodeId, presentation] of Object.entries(registry)) {
    const node = storyById.get(nodeId);
    if (!node) {
      problems.push('story presentation "' + nodeId + '" points to a missing story node');
      continue;
    }
    if (!isConversationNode(node)) {
      problems.push(
        'story presentation "' +
          nodeId +
          '" must target a dialogue or choice node, not "' +
          node.kind +
          '"',
      );
    }
    if (INTERLUDES[nodeId]) {
      problems.push('story presentation "' + nodeId + '" is a staged interlude');
    }
    if (presentation.kind !== 'world') {
      problems.push(
        'story presentation "' + nodeId + '" has unknown kind "' + presentation.kind + '"',
      );
      continue;
    }
    const map = mapById.get(presentation.mapId);
    if (!map) {
      problems.push(
        'story presentation "' + nodeId + '" uses unknown map "' + presentation.mapId + '"',
      );
    } else if (!explorationMapIds.has(map.id)) {
      problems.push(
        'story presentation "' +
          nodeId +
          '" uses map "' +
          presentation.mapId +
          '" without an exploration story node',
      );
    }
  }

  for (const map of maps) {
    for (const npc of map.npcs) {
      for (const nodeId of [npc.node, ...(npc.routes ?? []).map((route) => route.node)]) {
        const presentation = registry[nodeId];
        if (!presentation) {
          const node = storyById.get(nodeId);
          // Profile-owned placeholder actors may deliberately bounce to the
          // current exploration hub until their dialogue ships in a later wave.
          if (npc.resident && node?.kind === 'explore' && node.mapId === map.id) continue;
          problems.push(
            'map "' +
              map.id +
              '" npc "' +
              npc.id +
              '" conversation "' +
              nodeId +
              '" has no story presentation',
          );
          continue;
        }
        if (presentation.kind === 'world' && presentation.mapId !== map.id) {
          problems.push(
            'map "' +
              map.id +
              '" npc "' +
              npc.id +
              '" conversation "' +
              nodeId +
              '" is presented on "' +
              presentation.mapId +
              '"',
          );
        }
      }
    }
  }

  return problems;
}
