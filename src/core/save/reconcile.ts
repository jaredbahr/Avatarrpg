/**
 * Repairs a loaded game against the current content.
 *
 * A save is a snapshot of a party, not of the rules that made it. Between a
 * family closing the lid on a Saturday and opening it again, the kits can have
 * moved: a discipline gate added, a level it sits at changed. The save is not
 * wrong — it just predates the gate.
 *
 * `migrate` in `serialize.ts` cannot fix this, because it works on raw JSON and
 * has no content to look a kit up in. This does, and it runs on load.
 *
 * The rule it enforces is narrow on purpose: a party member who is at or past a
 * discipline gate and has not taken a path is owed the pick. Owing it again is
 * harmless (the dialog simply appears), where *not* owing it means a player
 * quietly never receives the reward for the level they earned.
 */

import type { ContentIndex, GameState, PendingChoice } from '../types';
import { specializationsUpTo } from '../rules/leveling';
import { buildGrid, samePos } from '../rules/grid';
import { findSettleTile } from '../story/settle';
import { visibleNpcs } from '../story/world';

export function reconcileDisciplines(content: ContentIndex, state: GameState): GameState {
  const owed: PendingChoice[] = [];

  for (const member of state.party) {
    if (member.disciplineId) continue;
    if (!member.characterId) continue;

    const character = content.characters.get(member.characterId);
    if (!character) continue;

    const options = specializationsUpTo(character.kit, member.level);
    if (options.length === 0) continue;

    const alreadyOffered = state.pendingChoices.some(
      (c) => c.unitId === member.id && c.kind === 'discipline',
    );
    if (alreadyOffered) continue;

    owed.push({ unitId: member.id, level: member.level, kind: 'discipline', options });
  }

  if (owed.length === 0) return state;
  return { ...state, pendingChoices: [...state.pendingChoices, ...owed] };
}

/**
 * Repairs a loaded game's world state (ADR 0047 §5). Clears a stale
 * conversation pin — one whose screen or map no longer holds it, or
 * whose NpcDef no longer exists in content — and, in explore, runs the
 * same leader-resettle search `settle` runs after every command, silently
 * (no events: there is nothing to animate on a load). Idempotent:
 * reconciling an already-reconciled state changes nothing.
 */
export function reconcileWorld(content: ContentIndex, state: GameState): GameState {
  let next = state;
  const talk = next.world.talk;

  if (talk) {
    const holds = next.screen === 'dialogue' && next.location.mapId === talk.mapId;
    const map = content.maps.get(talk.mapId);
    const npcExists = map?.npcs.some((npc) => npc.id === talk.npcId) ?? false;
    if (!holds || !npcExists) {
      next = { ...next, world: { ...next.world, talk: null } };
    }
  }

  if (next.screen === 'explore') {
    const map = content.maps.get(next.location.mapId);
    if (map) {
      const onNpc = visibleNpcs(map, next).some((npc) => samePos(npc.pos, next.location.pos));
      if (onNpc) {
        const grid = buildGrid(map);
        const found = findSettleTile(content, map, grid, next, next.location.pos);
        if (found) {
          next = { ...next, location: { ...next.location, pos: found.pos } };
        }
      }
    }
  }

  return next;
}
