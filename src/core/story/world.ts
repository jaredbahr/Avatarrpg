import type { ContentIndex, GameState, MapDef, MapTrigger, NpcDef } from '../types';
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

/** NPCs currently present on the map; every UI and reducer lookup shares this predicate. */
export function visibleNpcs(map: MapDef, state: GameState): readonly NpcDef[] {
  return map.npcs.filter((npc) => !npc.when || evaluate(state, npc.when));
}

let placedMemo: readonly [ContentIndex, MapDef, GameState, readonly NpcDef[]] | undefined;

/**
 * `visibleNpcs` with residents (ADR 0047 §2): a bound NpcDef is present only
 * where its resident's placement puts it on this map, with `npc` naming it,
 * and comes back at that anchor's tile. W4b renames this to `visibleNpcs`
 * and moves every caller over. One-entry memo: the renderer asks each frame.
 */
export function placedNpcs(
  content: ContentIndex,
  map: MapDef,
  state: GameState,
): readonly NpcDef[] {
  const m = placedMemo;
  if (m && m[0] === content && m[1] === map && m[2] === state) return m[3];
  const { placements } = resolveResidents(content, state);
  const npcs: NpcDef[] = [];
  for (const npc of visibleNpcs(map, state)) {
    if (!npc.resident) {
      npcs.push(npc);
      continue;
    }
    const at = placements.find(
      (p) => p.id === npc.resident && p.mapId === map.id && p.slot?.npc === npc.id,
    );
    if (at?.pos) npcs.push({ ...npc, pos: at.pos });
  }
  placedMemo = [content, map, state, npcs];
  return npcs;
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
