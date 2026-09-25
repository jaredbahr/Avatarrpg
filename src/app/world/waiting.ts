import { distance } from '../../core/rules/grid';
import { apply } from '../../core/state/reducer';
import { DAY_PHASES } from '../../core/types';
import type { ContentIndex, DayPhase, GameState } from '../../core/types';

export interface WaitOffer {
  readonly phase: DayPhase;
  readonly tomorrow: boolean;
  /** The rule's reason when waiting until this phase is refused. */
  readonly refusal: string | null;
}

/**
 * The next five phases in clock order, each checked by running the real
 * `wait` rule on the current state (ADR 0047 §1), so what the dialog offers
 * is exactly what the reducer will do.
 */
export function waitOffers(content: ContentIndex, state: GameState): readonly WaitOffer[] {
  const now = DAY_PHASES.indexOf(state.world.clock.phase);
  return [...DAY_PHASES, ...DAY_PHASES].slice(now + 1, now + 6).map((phase, step) => {
    const { events } = apply(content, state, { type: 'wait', until: phase });
    const reason = events.find((event) => event.type === 'message');
    return {
      phase,
      tomorrow: now + 1 + step >= DAY_PHASES.length,
      refusal: events.some((event) => event.type === 'phaseChanged')
        ? null
        : reason?.type === 'message'
          ? reason.text
          : 'Not now.',
    };
  });
}

/** The map's seat the party is at (within one tile, as the rule asks), if any. */
export function seatHere(content: ContentIndex, state: GameState) {
  return content.maps
    .get(state.location.mapId)
    ?.restSpots?.find((spot) => distance(state.location.pos, spot.pos) <= 1);
}
