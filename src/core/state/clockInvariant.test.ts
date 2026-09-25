/**
 * The world clock invariant (ADR 0047 §1): only `wait` and an authored
 * `flags` node's `phase` field move the clock, and nothing else — not
 * walking, `enterNode`, `setFlags`, dialogue, choices or battles (see
 * `src/core/story/clock.ts`).
 *
 * This pins the core of that rule against real content and the real `apply`
 * entry point (which now also runs `settle`). It does not try to enumerate
 * the whole story graph — that is a larger project, not this slice.
 */

import { describe as suite, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from './createGame';
import { apply } from './reducer';
import type { Command, GameState } from '../types';

/** Explore, on the courtyard one tile from Mira's table at (10,5). */
function exploring(): GameState {
  const base = createGame(CONTENT, {
    seed: 'clock-invariant',
    party: ['kaya', 'bo', 'nilak'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
  return {
    ...base,
    screen: 'explore',
    location: { mapId: 'ba_dan_village', pos: { x: 10, y: 6 } },
    story: { ...base.story, nodeId: 'village_explore' },
  };
}

suite('the world clock invariant', () => {
  it('a clock-shaped flag cannot reach the real clock: setFlags only writes state.flags', () => {
    const state = exploring();

    const result = apply(CONTENT, state, {
      type: 'setFlags',
      flags: { 'world.clock': 'tampering' },
    });

    // `setFlags` lands in `state.flags`, a different field entirely from
    // `state.world.clock`.
    expect(result.state.flags['world.clock']).toBe('tampering');
    expect(result.state.world.clock).toBe(state.world.clock);
    expect(result.state.world.clock).toEqual(state.world.clock);
  });

  it("wait's success path writes no flags (the literal key the ADR names)", () => {
    const state = exploring();
    expect(state.flags['world.ducks_seen']).toBeUndefined();

    const result = apply(CONTENT, state, { type: 'wait', until: 'evening' });

    // Time only: the clock moved, the flags object is the same reference.
    expect(result.state.world.clock).toEqual({ day: 1, phase: 'evening' });
    expect(result.state.flags).toBe(state.flags);
    expect(result.state.flags['world.ducks_seen']).toBeUndefined();
  });

  it('ordinary commands leave the clock unchanged across apply', () => {
    const state = exploring();
    expect(state.world.clock).toEqual({ day: 1, phase: 'midday' });

    const commands: readonly Command[] = [
      { type: 'enterNode', nodeId: 'village_explore' },
      { type: 'setFlags', flags: { ruon_spared: true } },
      { type: 'walkTo', pos: { x: 11, y: 6 } },
    ];
    for (const command of commands) {
      const result = apply(CONTENT, state, command);
      expect(result.state.world.clock).toEqual(state.world.clock);
    }

    // Entering `act1_victory` is the one legitimate exception: it is the
    // authored `flags` node whose `phase: 'evening'` moves the clock by
    // design, and `src/core/story/storyPhase.test.ts` already covers it.
  });
});
