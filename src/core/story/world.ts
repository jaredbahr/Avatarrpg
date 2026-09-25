import type { ContentIndex, GameState, MapDef, MapTrigger, NpcDef, Vec2 } from '../types';
import { evaluate } from './conditions';
import { resolveResidents } from './residents';

export function triggerKey(map: MapDef, trigger: MapTrigger): string {
  return `${map.id}:${trigger.id}`;
}

export function activeTriggers(map: MapDef, state: GameState): readonly MapTrigger[] {
  return (map.triggers ?? []).filter(
    (trigger) =>
      (!trigger.once || !state.world.fired.includes(triggerKey(map, trigger))) &&
      evaluate(state, trigger.when),
  );
}

/** An NpcDef as placed on the map: plain ones keep `pos`, bound ones take their anchor's tile. */
export type PlacedNpc = NpcDef & { readonly pos: Vec2 };

let visibleMemo: readonly [ContentIndex, MapDef, GameState, readonly PlacedNpc[]] | undefined;

/**
 * NPCs currently present on the map; every UI and reducer lookup shares this
 * predicate. An `NpcDef.when` must hold, and a resident-bound NpcDef (ADR 0047
 * §2) is present only where its resident's placement puts it on this map, with
 * `npc` naming it, coming back at that anchor's tile. One-entry memo: the
 * renderer asks each frame.
 */
export function visibleNpcs(
  content: ContentIndex,
  map: MapDef,
  state: GameState,
): readonly PlacedNpc[] {
  const m = visibleMemo;
  if (m && m[0] === content && m[1] === map && m[2] === state) return m[3];
  const { placements } = resolveResidents(content, state);
  const npcs: PlacedNpc[] = [];
  for (const npc of map.npcs) {
    if (npc.when && !evaluate(state, npc.when)) continue;
    if (!npc.resident) {
      if (npc.pos) npcs.push(npc as PlacedNpc);
      continue;
    }
    const at = placements.find(
      (p) => p.id === npc.resident && p.mapId === map.id && p.slot?.npc === npc.id,
    );
    if (at?.pos) npcs.push({ ...npc, pos: at.pos });
  }
  visibleMemo = [content, map, state, npcs];
  return npcs;
}

/** A background role standing on a map tile (ADR 0047 §2): drawn, never talked to. */
export interface PlacedRole {
  readonly id: string;
  readonly label: string;
  readonly sprite: string;
  readonly pos: Vec2;
}

/**
 * The background roles placed on `map` now. They say nothing, so the party
 * walks up to one rather than onto it, and settle never leaves the leader
 * standing on one (ADR 0047, W8 amendment).
 */
export function backgroundFigures(
  content: ContentIndex,
  map: MapDef,
  state: GameState,
): readonly PlacedRole[] {
  const roles: PlacedRole[] = [];
  for (const p of resolveResidents(content, state).placements) {
    const role = content.backgroundRoles.get(p.id);
    if (role && p.mapId === map.id && p.pos)
      roles.push({ id: role.id, label: role.label, sprite: role.sprite, pos: p.pos });
  }
  return roles;
}

/** One objective for the banner and journal, derived from the current story and world state. */
export function worldObjective(content: ContentIndex, state: GameState): string | null {
  const map = content.maps.get(state.location.mapId);
  const node = state.story.nodeId ? content.story.get(state.story.nodeId) : undefined;
  if (node?.kind === 'explore' && node.mapId === map?.id)
    return (
      node.objectiveVariants?.find((variant) => evaluate(state, variant.when))?.text ??
      node.objective
    );
  if (!map) return null;
  return (
    map.objectiveVariants?.find((variant) => evaluate(state, variant.when))?.text ??
    map.objective ??
    null
  );
}

/** Structured target metadata paired with the same active objective source. */
export function worldObjectiveNpcId(content: ContentIndex, state: GameState): string | null {
  const map = content.maps.get(state.location.mapId);
  const node = state.story.nodeId ? content.story.get(state.story.nodeId) : undefined;
  if (node?.kind === 'explore' && node.mapId === map?.id) {
    const variant = node.objectiveVariants?.find((candidate) => evaluate(state, candidate.when));
    return variant ? (variant.objectiveNpcId ?? null) : (node.objectiveNpcId ?? null);
  }
  return null;
}
