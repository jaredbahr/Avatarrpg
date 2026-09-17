/** Exploration feedback runs the real walking rules on an immutable preview. */
import type { ContentIndex, GameState, Vec2 } from '../../core/types';
import { apply } from '../../core/state/reducer';
import { distance, samePos } from '../../core/rules/grid';
import { activeTriggers } from '../../core/story/world';

export interface WalkPreview {
  readonly from: Vec2;
  readonly path: readonly Vec2[];
  readonly label: string;
  readonly refusal: string | null;
}

export function previewWalk(content: ContentIndex, state: GameState, target: Vec2): WalkPreview {
  const result = apply(content, state, { type: 'walkTo', pos: target });
  const walk = result.events.find((event) => event.type === 'partyWalked');
  const stop = walk?.path.at(-1) ?? state.location.pos;
  const map = content.maps.get(state.location.mapId);
  const trigger =
    map && activeTriggers(map, state).find((item) => item.area.some((cell) => samePos(cell, stop)));
  const npc = map?.npcs.find((item) => samePos(item.pos, target));
  const exit = map?.exits?.find((item) => samePos(item.pos, target));
  const message = result.events.find((event) => event.type === 'message');
  return {
    from: state.location.pos,
    path: walk?.path ?? [],
    // A visible encounter takes precedence over a landmark beyond it.
    label: trigger?.label ?? npc?.name ?? exit?.label ?? 'the path',
    refusal: !walk && message ? message.text : null,
  };
}

/** One replaceable intent, never a chain that can run through the story unattended. */
export class NextWalk {
  private pending: { state: GameState; target: Vec2; preview: WalkPreview } | null = null;

  set(content: ContentIndex, state: GameState, target: Vec2): WalkPreview {
    const preview = previewWalk(content, state, target);
    // An accidental wall tap must not erase an already valid next destination.
    if (!preview.refusal) this.pending = { state, target, preview };
    return preview;
  }

  preview(state: GameState): WalkPreview | null {
    if (this.pending?.state !== state) this.clear();
    return this.pending?.preview ?? null;
  }

  take(state: GameState): Vec2 | null {
    const target = this.pending?.state === state ? this.pending.target : null;
    this.clear();
    return target;
  }

  clear(): void {
    this.pending = null;
  }
}

/** Only nearby, reachable people and objects; never a checklist of unseen maps. */
export function nearbyPlaces(content: ContentIndex, state: GameState) {
  const map = content.maps.get(state.location.mapId);
  return (map?.npcs ?? [])
    .filter((npc) => distance(state.location.pos, npc.pos) <= 6)
    .map((npc) => ({ npc, preview: previewWalk(content, state, npc.pos) }))
    .filter(({ npc, preview }) => !preview.refusal && preview.label === npc.name)
    .sort((a, b) => a.preview.path.length - b.preview.path.length);
}
