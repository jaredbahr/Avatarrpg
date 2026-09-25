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

import type {
  ContentIndex,
  GameState,
  PendingChoice,
  ResidentDef,
  ResidentSlot,
  ResidentSlotValue,
} from '../types';
import { specializationsUpTo } from '../rules/leveling';
import { settle } from '../story/settle';
import { npcResident } from '../story/residents';

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
 * Repairs a loaded game's world state (ADR 0047 §5). Runs `settle` silently
 * (no events: there is nothing to animate on a load), which clears a pin
 * whose screen or map no longer holds it and steps the leader off an NPC
 * tile, then clears the one kind of stale pin `settle` cannot see: content
 * that has drifted since the save, so the pinned NpcDef, its resident
 * binding or the pinned map anchor no longer exists. Idempotent.
 */
export function reconcileWorld(content: ContentIndex, state: GameState): GameState {
  const settled = settle(content, state, state).state;
  const talk = settled.world.talk;
  if (!talk) return settled;
  const resident = npcResident(content, talk.mapId, talk.npcId);
  const record = resident ? content.residents.get(resident) : undefined;
  const site = content.anchors.get(talk.anchor)?.site;
  const holds =
    record !== undefined &&
    residentSlots(record).some((slot) => slot.anchor === talk.anchor && slot.npc === talk.npcId) &&
    site?.kind === 'map' &&
    site.mapId === talk.mapId;
  return holds ? settled : { ...settled, world: { ...settled.world, talk: null } };
}

/** Every authored public slot a resident may occupy, independent of the loaded state's phase. */
function residentSlots(resident: ResidentDef): readonly ResidentSlot[] {
  const values: (ResidentSlotValue | undefined)[] = [
    resident.fallback,
    ...Object.values(resident.schedule),
    ...(resident.overrides ?? []).flatMap((override) => [
      override.all,
      ...Object.values(override.slots),
    ]),
  ];
  return values.filter((value): value is ResidentSlot => typeof value === 'object');
}
