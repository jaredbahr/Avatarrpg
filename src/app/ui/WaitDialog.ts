/**
 * "Wait until…" (ADR 0047 §1, D8): the next five phases in clock order.
 *
 * A refused option stays on screen, dimmed, with the rule's reason, as a
 * locked dialogue option does. When every option is refused the tiles give
 * way to the reason and a way to the map's seat, so a player who opened the
 * dialog away from one is never left at a dead end. Waiting changes the time
 * and nothing else.
 */

import type { App } from '../App';
import type { DayPhase, Vec2 } from '../../core/types';
import { phaseLabel } from '../world/journal';
import { seatHere, waitOffers } from '../world/waiting';
import { Dialog } from './Dialog';
import { button, el } from './dom';

export class WaitDialog extends Dialog {
  protected options = { title: 'Wait until…', subtitle: 'Only the time changes.' };

  /** `walk` takes the party to a seat when none of the options can be taken here. */
  constructor(
    private app: App,
    private walk: (pos: Vec2) => void,
  ) {
    super();
  }

  protected build(body: HTMLElement): void {
    const state = this.app.state;
    if (!state) return;
    const offers = waitOffers(this.app.content, state);
    const seat = this.app.content.maps.get(state.location.mapId)?.restSpots?.[0];
    if (offers.every((offer) => offer.refusal)) {
      body.append(el('p', { class: 'locked-hint', text: offers[0]?.refusal ?? '' }));
      if (seat && !seatHere(this.app.content, state))
        body.append(
          button(
            `Walk to ${seat.label}`,
            () => {
              this.close();
              this.walk(seat.pos);
            },
            { class: 'btn-primary' },
          ),
        );
    } else {
      const list = el('div', { class: 'choice-options wait-options' });
      for (const { phase, tomorrow, refusal } of offers)
        list.append(
          el(
            'button',
            {
              class: refusal ? 'choice-option is-locked' : 'choice-option',
              attrs: refusal ? { disabled: 'true', 'aria-disabled': 'true' } : {},
              onClick: refusal ? undefined : () => this.wait(phase),
            },
            el('strong', { text: phaseLabel(phase) }),
            el('span', { class: 'muted', text: tomorrow ? 'Tomorrow' : 'Later today' }),
            refusal ? el('span', { class: 'locked-hint', text: refusal }) : null,
          ),
        );
      body.append(list);
    }
    body.append(button('Return to the path', () => this.close(), { class: 'wait-return' }));
  }

  private wait(until: DayPhase): void {
    this.close();
    const events = this.app.dispatch({ type: 'wait', until });
    // The log line the rule wrote ("Evening falls."), shown once as it happens.
    if (events.some((event) => event.type === 'phaseChanged'))
      this.app.toasts.show(this.app.state?.log.at(-1) ?? '');
  }
}
