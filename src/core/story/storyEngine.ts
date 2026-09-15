/**
 * Walking the story graph.
 *
 * Nodes that need no player input (`flags`, `branch`) resolve straight through
 * to the next node that does, so the UI only ever sees something it can draw.
 * A visit guard stops a mis-authored cycle of flag nodes from hanging the game
 * — it degrades to an error message rather than a frozen tablet.
 *
 * The rotating decider lives here as a plain counter. The core has no idea how
 * many people are playing; `src/app/session.ts` maps the counter onto a name.
 */

import { RngCursor } from '../rng';
import type { ContentIndex, GameEvent, GameState, StepResult, StoryNode } from '../types';
import { createBattle } from '../state/createGame';

const MAX_CHAIN = 32;

export function currentNode(content: ContentIndex, state: GameState): StoryNode | undefined {
  if (!state.story.nodeId) return undefined;
  return content.story.get(state.story.nodeId);
}

/** Spawn position for the party on an explore map. */
function exploreStart(content: ContentIndex, mapId: string) {
  const map = content.maps.get(mapId);
  return map?.partySpawns[0] ?? { x: 1, y: 1 };
}

/**
 * Enters a story node, resolving pass-through nodes until it lands on one that
 * needs the player: dialogue, a choice, an explore map, a battle, or the end.
 */
export function enterStoryNode(
  content: ContentIndex,
  state: GameState,
  nodeId: string,
): StepResult {
  const events: GameEvent[] = [];
  let current = state;
  let target = nodeId;

  for (let step = 0; step < MAX_CHAIN; step++) {
    const node = content.story.get(target);
    if (!node) {
      events.push({ type: 'message', text: `Story node "${target}" is missing.` });
      return { state: current, events };
    }

    const visited = current.story.visited.includes(node.id)
      ? current.story.visited
      : [...current.story.visited, node.id];

    events.push({ type: 'storyNodeEntered', nodeId: node.id });

    switch (node.kind) {
      case 'flags': {
        const flags = { ...current.flags, ...node.set };
        for (const [key, value] of Object.entries(node.set)) {
          events.push({ type: 'flagSet', key, value });
        }
        current = { ...current, flags, story: { ...current.story, visited } };
        target = node.next;
        continue;
      }

      case 'branch': {
        current = { ...current, story: { ...current.story, visited } };
        target = current.flags[node.flag] ? node.ifSet : node.ifUnset;
        continue;
      }

      case 'dialogue':
      case 'choice': {
        events.push({ type: 'screenChanged', screen: 'dialogue' });
        return {
          state: {
            ...current,
            screen: 'dialogue',
            story: { ...current.story, nodeId: node.id, visited, lineIndex: 0 },
          },
          events,
        };
      }

      case 'explore': {
        events.push({ type: 'screenChanged', screen: 'explore' });
        const pos =
          current.location.mapId === node.mapId
            ? current.location.pos
            : exploreStart(content, node.mapId);
        return {
          state: {
            ...current,
            screen: 'explore',
            battle: null,
            story: { ...current.story, nodeId: node.id, visited, lineIndex: 0 },
            location: { mapId: node.mapId, pos },
          },
          events,
        };
      }

      case 'battle': {
        const rng = new RngCursor(current.rng);
        const battle = createBattle(content, current, node.encounterId, rng);
        const encounter = content.encounters.get(node.encounterId);
        events.push({ type: 'battleStarted', encounterId: node.encounterId });
        if (encounter) events.push({ type: 'message', text: encounter.intro });
        events.push({ type: 'screenChanged', screen: 'combat' });
        events.push({ type: 'roundStarted', round: 1 });
        return {
          state: {
            ...current,
            screen: 'combat',
            rng: rng.state,
            battle,
            story: { ...current.story, nodeId: node.id, visited, lineIndex: 0 },
            location: { mapId: battle.mapId, pos: current.location.pos },
          },
          events,
        };
      }

      case 'end': {
        events.push({ type: 'screenChanged', screen: 'ended' });
        return {
          state: {
            ...current,
            screen: 'ended',
            battle: null,
            story: { ...current.story, nodeId: node.id, visited, lineIndex: 0 },
          },
          events,
        };
      }
    }
  }

  events.push({
    type: 'message',
    text: 'The story got stuck in a loop. Returning you to the last stable point.',
  });
  return { state: current, events };
}

/** Advances one line of dialogue, or leaves the node when the lines run out. */
export function advanceDialogue(content: ContentIndex, state: GameState): StepResult {
  const node = currentNode(content, state);
  if (!node || node.kind !== 'dialogue') return { state, events: [] };

  const nextLine = state.story.lineIndex + 1;
  if (nextLine < node.lines.length) {
    return {
      state: { ...state, story: { ...state.story, lineIndex: nextLine } },
      events: [{ type: 'dialogueAdvanced', lineIndex: nextLine }],
    };
  }

  return enterStoryNode(content, state, node.next);
}

/**
 * Takes a choice, sets its flags, and rotates the decider so the next branch
 * belongs to somebody else. Rotation happens even if the same option is picked
 * twice — the point is that the role moves, not that the outcome differs.
 */
export function chooseOption(
  content: ContentIndex,
  state: GameState,
  optionIndex: number,
): StepResult {
  const node = currentNode(content, state);
  if (!node || node.kind !== 'choice') return { state, events: [] };

  const option = node.options[optionIndex];
  if (!option) {
    return {
      state,
      events: [{ type: 'message', text: 'That choice is not available.' }],
    };
  }

  const events: GameEvent[] = [];
  let flags = state.flags;
  if (option.setFlags) {
    flags = { ...flags, ...option.setFlags };
    for (const [key, value] of Object.entries(option.setFlags)) {
      events.push({ type: 'flagSet', key, value });
    }
  }

  const rotated: GameState = {
    ...state,
    flags,
    story: { ...state.story, deciderIndex: state.story.deciderIndex + 1 },
  };

  const result = enterStoryNode(content, rotated, option.next);
  return { state: result.state, events: [...events, ...result.events] };
}

/** The story node an NPC opens, honouring its flag-gated alternative. */
export function npcNode(
  content: ContentIndex,
  state: GameState,
  mapId: string,
  npcId: string,
): string | null {
  const map = content.maps.get(mapId);
  const npc = map?.npcs.find((n) => n.id === npcId);
  if (!npc) return null;
  if (npc.altFlag && npc.altNode && state.flags[npc.altFlag]) return npc.altNode;
  return npc.node;
}

/**
 * Where an NPC conversation should return to. NPC nodes all point back at the
 * explore node they were opened from, so this is simply "the node we were on"
 * — but keeping it explicit means a future NPC can send the party somewhere.
 */
export function exploreNodeFor(content: ContentIndex, mapId: string): string | null {
  for (const node of content.story.values()) {
    if (node.kind === 'explore' && node.mapId === mapId) return node.id;
  }
  return null;
}
