/**
 * "Wait until…" (ADR 0047 §1, D8): the next five phases in clock order.
 *
 * Each option runs the real `wait` rule on the current state, so what the
 * dialog offers is exactly what the reducer will do. A refused option stays
 * on screen, dimmed, with the rule's reason, as a locked dialogue option
 * does; when every option is refused for the same reason (away from a seat),
 * the reason is said once. Waiting changes the time and nothing else.
 */

import type { App } from '../App';
import { apply } from '../../core/state/reducer';
import { DAY_PHASES } from '../../core/types';
import type { DayPhase } from '../../core/types';
import { phaseLabel } from '../world/journal';
import { Dialog } from './Dialog';
import { button, el } from './dom';

export class WaitDialog extends Dialog {
  protected options = {
    title: 'Wait a while',
    subtitle: 'Pick when to stop. Only the time changes.',
  };

  constructor(private app: App) {
    super();
  }

  protected build(body: HTMLElement): void {
    const state = this.app.state;
    if (!state) return;
    const now = DAY_PHASES.indexOf(state.world.clock.phase);
    const offers = [...DAY_PHASES, ...DAY_PHASES].slice(now + 1, now + 6).map((phase, step) => {
      const { events } = apply(this.app.content, state, { type: 'wait', until: phase });
      const moved = events.some((event) => event.type === 'phaseChanged');
      const reason = events.find((event) => event.type === 'message');
      return {
        phase,
        tomorrow: now + 1 + step >= DAY_PHASES.length,
        refusal: moved ? null : reason?.type === 'message' ? reason.text : 'Not now.',
      };
    });
    const shared = new Set(offers.map((offer) => offer.refusal)).size === 1 && offers[0]?.refusal;
    if (shared) body.append(el('p', { class: 'locked-hint', text: shared }));
    const list = el('div', { class: 'choice-options wait-options' });
    for (const { phase, tomorrow, refusal } of offers) {
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
          refusal && !shared ? el('span', { class: 'locked-hint', text: refusal }) : null,
        ),
      );
    }
    body.append(
      list,
      button('Back to the path', () => this.close()),
    );
  }

  private wait(until: DayPhase): void {
    this.close();
    const events = this.app.dispatch({ type: 'wait', until });
    // The log line the rule wrote ("Evening falls."), shown once as it happens.
    if (events.some((event) => event.type === 'phaseChanged'))
      this.app.toasts.show(this.app.state?.log.at(-1) ?? '');
  }
}
