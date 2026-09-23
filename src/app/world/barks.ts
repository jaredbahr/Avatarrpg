import { distance } from '../../core/rules/grid';
import { visibleNpcs } from '../../core/story/world';
import type { ContentIndex, GameState, MapDef } from '../../core/types';

/**
 * The handover's rotating short variants (ADR 0047 §8, LW-S-BD-03). Once the
 * scene has been seen, a party near the gate at dawn or in the evening gets
 * one exchange as a subtitle: the outgoing guard says an item, the incoming
 * one repeats it. Picked from the day and the watch, so it changes each
 * handover. Presentation only: no RNG, no flags, nothing saved.
 */
const ITEMS: readonly (readonly [string, string])[] = [
  ['Road’s dry past the bend.', 'Dry past the bend.'],
  ['Two carts through, both expected.', 'Two carts, expected.'],
  ['East road lamp is trimmed.', 'Trimmed. It stays lit.'],
];

export function handoverBark(content: ContentIndex, map: MapDef, state: GameState): string | null {
  const { day, phase } = state.world.clock;
  const evening = phase === 'evening';
  if ((!evening && phase !== 'dawn') || state.flags['scene.bd03_handover'] === undefined)
    return null;
  const guards = visibleNpcs(content, map, state).filter(
    (npc) => npc.id === 'guard_dorin' || npc.id === 'guard_hanru',
  );
  if (guards.length < 2 || !guards.some((npc) => distance(state.location.pos, npc.pos) <= 3))
    return null;
  const item = ITEMS[(day * 2 + (evening ? 1 : 0)) % ITEMS.length];
  if (!item) return null;
  const [said, repeated] = item;
  // Dorin hands over in the evening; Hanru hands the night back at dawn.
  const [from, to] = evening ? ['Dorin', 'Hanru'] : ['Hanru', 'Dorin'];
  return `${from}: “${said}” ${to}: “${repeated}”`;
}
