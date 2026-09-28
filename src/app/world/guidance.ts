import { distance } from '../../core/rules/grid';
import { evaluate } from '../../core/story/conditions';
import { exitCells, visibleNpcs } from '../../core/story/world';
import type { PlacedNpc } from '../../core/story/world';
import type { ContentIndex, GameState, MapDef, MapExit, Vec2 } from '../../core/types';

/** How far the action bar reaches for a person or nearby world object. */
const TALK_RANGE = 3;

export type NearbyExploreTarget =
  | { readonly kind: 'exit'; readonly exit: MapExit; readonly destination: string }
  | { readonly kind: 'npc'; readonly npc: PlacedNpc; readonly inspect: boolean }
  | null;

/** The short destination name used by the action bar for an authored route. */
export function exitDestination(content: ContentIndex, exit: MapExit): string {
  const arrow = exit.label.lastIndexOf('→');
  if (arrow >= 0) return exit.label.slice(arrow + 1).trim();
  return content.maps.get(exit.toMapId)?.name || exit.toMapId;
}

/** Exits whose mouth, `pos` or any `area` cell, reaches within a tile of `pos`. */
export function nearbyExits(map: MapDef, pos: Vec2): readonly MapExit[] {
  return (map.exits ?? []).filter((exit) =>
    exitCells(exit).some((cell) => distance(pos, cell) <= 1),
  );
}

/**
 * Resolves the one primary nearby action. A real person stays primary; an open
 * route can supersede only the authored sign that marks that route. Locked
 * routes leave the real NPC interaction available.
 */
export function nearbyExploreTarget(
  content: ContentIndex,
  map: MapDef,
  state: GameState,
): NearbyExploreTarget {
  let best: PlacedNpc | null = null;
  let nearest = TALK_RANGE + 1;
  let proximity = Infinity;
  for (const npc of visibleNpcs(content, map, state)) {
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
  const exit = nearbyExits(map, state.location.pos).find((item) => evaluate(state, item.requires));
  if (exit && (!best || best.interaction === 'route-sign')) {
    return { kind: 'exit', exit, destination: exitDestination(content, exit) };
  }
  return best ? { kind: 'npc', npc: best, inspect: best.sprite.startsWith('world.') } : null;
}
