import { distance } from '../../core/rules/grid';
import { evaluate } from '../../core/story/conditions';
import { visibleNpcs } from '../../core/story/world';
import type { ContentIndex, GameState, MapDef, MapExit, NpcDef } from '../../core/types';

/** How far the action bar reaches for a person or nearby world object. */
const TALK_RANGE = 3;

export type NearbyExploreTarget =
  | { readonly kind: 'exit'; readonly exit: MapExit; readonly destination: string }
  | { readonly kind: 'npc'; readonly npc: NpcDef; readonly inspect: boolean }
  | null;

/** The short destination name used by the action bar for an authored route. */
export function exitDestination(content: ContentIndex, exit: MapExit): string {
  const arrowDestination = exit.label.split('→').at(-1)?.trim();
  return arrowDestination || content.maps.get(exit.toMapId)?.name || exit.toMapId;
}

/**
 * Resolves the one primary nearby action. An open route wins over a nearby
 * sign, while locked routes leave the real NPC interaction available.
 */
export function nearbyExploreTarget(
  content: ContentIndex,
  map: MapDef,
  state: GameState,
): NearbyExploreTarget {
  const exit = map.exits?.find(
    (item) => distance(state.location.pos, item.pos) <= 1 && evaluate(state, item.requires),
  );
  if (exit) return { kind: 'exit', exit, destination: exitDestination(content, exit) };

  let best: NpcDef | null = null;
  let nearest = TALK_RANGE + 1;
  let proximity = Infinity;
  for (const npc of visibleNpcs(map, state)) {
    const gap = distance(state.location.pos, npc.pos);
    const groundGap = Math.hypot(
      state.location.pos.x - npc.pos.x,
      state.location.pos.y - npc.pos.y,
    );
    if (gap < nearest || (gap === nearest && gap <= TALK_RANGE && groundGap < proximity)) {
      best = npc;
      nearest = gap;
      proximity = groundGap;
    }
  }
  return best ? { kind: 'npc', npc: best, inspect: best.sprite.startsWith('world.') } : null;
}
