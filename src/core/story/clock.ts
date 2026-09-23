/**
 * The world clock (ADR 0047 §1).
 *
 * One clock for the whole world. The phase only ever changes through
 * `advancePhase`, a pure helper with exactly two callers in Slice A: the
 * `wait` command (`src/core/state/reducer.ts`) and, in a later work item, an
 * authored story `flags` node's `phase` field. Nothing else touches it —
 * not walking, exits, triggers, dialogue, choices, battles, `setFlags`,
 * pause, menus or saving.
 */

import type { DayPhase, GameState } from '../types';

const PHASE_ORDER: readonly DayPhase[] = [
  'dawn',
  'morning',
  'midday',
  'afternoon',
  'evening',
  'night',
];

/**
 * Moves the clock forward to the next occurrence of `to`. If the clock is
 * already at `to`, that is a full cycle away, not now — this always moves
 * forward by at least one phase. Crossing night into dawn increments `day`
 * exactly once per call, however many phases are stepped through.
 */
export function advancePhase(state: GameState, to: DayPhase): GameState {
  const { day, phase } = state.world.clock;
  const fromIndex = PHASE_ORDER.indexOf(phase);
  const toIndex = PHASE_ORDER.indexOf(to);
  const steps =
    fromIndex === toIndex
      ? PHASE_ORDER.length
      : (toIndex - fromIndex + PHASE_ORDER.length) % PHASE_ORDER.length;
  const crossesIntoNewDay = fromIndex + steps >= PHASE_ORDER.length;
  return {
    ...state,
    world: {
      ...state.world,
      clock: { day: crossesIntoNewDay ? day + 1 : day, phase: to },
    },
  };
}
