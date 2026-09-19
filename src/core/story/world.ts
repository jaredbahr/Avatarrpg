import type { ContentIndex, GameState, MapDef, MapTrigger, NpcDef } from '../types';
import { evaluate } from './conditions';

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
