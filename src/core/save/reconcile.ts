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
  Grid,
  MapDef,
  PendingChoice,
  ResidentDef,
  ResidentSlot,
  ResidentSlotValue,
  Vec2,
} from '../types';
import { cachedGrid, tileAt } from '../rules/grid';
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
 * binding or the pinned map anchor no longer exists. Before `settle`, it
 * snaps a saved explore position back onto walkable ground when a map edit
 * has buried it (M9). Idempotent.
 */
export function reconcileWorld(content: ContentIndex, state: GameState): GameState {
  // Snap first, so `settle` then sees the repaired tile: if the nearest
  // walkable cell happens to be one somebody else is standing on, the
  // leader step moves the party off it in the same pass.
  const snapped = snapExplore(content, state);
  const settled = settle(content, snapped, snapped).state;
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

/**
 * How far a saved explore position may move to find walkable ground before
 * the map's own entry is used instead. Chebyshev steps, like `distance`.
 */
const EXPLORE_SNAP_RADIUS = 6;

/**
 * A saved explore position a map edit has buried (M9).
 *
 * Explore keeps exactly one position for the whole party — `location.pos`;
 * the followers are a presentation line the scene re-seats at load, never
 * saved, so there is nothing per-member to repair. That one cell can be
 * off-grid or inside new terrain once the map changes, so the party is moved
 * to the nearest cell explore movement would accept, or to the map's entry
 * spawn (the same one `enterStoryNode` uses) when nothing is reachable close
 * by. Mid-battle saves are left alone: a battle carries its own grid.
 */
function snapExplore(content: ContentIndex, state: GameState): GameState {
  if (state.screen !== 'explore' || state.battle) return state;
  const map = content.maps.get(state.location.mapId);
  if (!map) return state;
  const grid = cachedGrid(map);
  if (walkable(grid, state.location.pos)) return state;
  const pos = nearestWalkable(grid, state.location.pos, EXPLORE_SNAP_RADIUS) ?? entrySpawn(map);
  return { ...state, location: { ...state.location, pos } };
}

/** Explore movement's walkability: an in-bounds tile that is not blocked. */
function walkable(grid: Grid, p: Vec2): boolean {
  const tile = tileAt(grid, p);
  return tile !== undefined && !tile.blocked;
}

/** The party's entry cell on an explore map, matching `enterStoryNode`'s `exploreStart`. */
function entrySpawn(map: MapDef): Vec2 {
  return map.partySpawns[0] ?? { x: 1, y: 1 };
}

/**
 * The nearest walkable cell to `from`, searched geometrically: ring by ring
 * outward by Chebyshev distance, up to `radius` steps. This is not pathing —
 * a map edit only buries the saved cell, so the repair is a distance search,
 * not a route. Candidates are in-bounds, non-blocked cells; an off-grid cell
 * is simply not one, and the rings still reach past it, so a position off the
 * map edge finds that edge's walkable cells. The first ring holding a
 * candidate wins, and ties break row-major — smallest y, then smallest x — so
 * the same map and cell always snap to the same tile. Returns null when
 * nothing walkable is that close.
 */
function nearestWalkable(grid: Grid, from: Vec2, radius: number): Vec2 | null {
  for (let distance = 1; distance <= radius; distance++) {
    let best: Vec2 | null = null;
    for (let dy = -distance; dy <= distance; dy++) {
      for (let dx = -distance; dx <= distance; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== distance) continue;
        const cell = { x: from.x + dx, y: from.y + dy };
        if (!walkable(grid, cell)) continue;
        if (best === null || cell.y < best.y || (cell.y === best.y && cell.x < best.x)) {
          best = cell;
        }
      }
    }
    if (best !== null) return best;
  }

  return null;
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
