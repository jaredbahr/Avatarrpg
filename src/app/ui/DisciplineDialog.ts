/**
 * The discipline gate.
 *
 * The one moment in a run where two earthbenders stop being the same
 * earthbender, so it gets a card per path rather than a list of names.
 *
 * Locked paths are shown, not hidden. A table that can see Metalbending sitting
 * there greyed out with "find someone who can teach it" has a reason to go
 * looking; a table that only ever sees the two paths it happens to qualify for
 * does not know the rest of the game exists. The reducer re-checks the flag on
 * the way in, so showing a locked card can never make it pickable.
 */

import type { App } from '../App';
import type { DisciplineDef, PendingChoice } from '../../core/types';
import { disciplineUnlocked } from '../../core/rules/leveling';
import { Dialog } from './Dialog';
import type { DialogOptions } from './Dialog';
import { button, el, painterCanvas } from './dom';
import { resolvePainter } from '../../render/painters/registry';

export class DisciplineDialog extends Dialog {
  protected options: DialogOptions;

  constructor(
    private app: App,
    private choice: PendingChoice,
    private onDone: () => void,
  ) {
    super();
    const unit = app.state?.party.find((u) => u.id === choice.unitId);
    const player = app.session.playerFor(choice.unitId);
    const who = unit ? (player ? `${unit.name} (${player.name})` : unit.name) : 'Someone';
    this.options = {
      title: `${who} chooses a path`,
      subtitle: 'This one sticks. It decides every technique from here to level 10.',
      dismissable: false,
      wide: true,
    };
  }

  protected override onClose(): void {
    this.onDone();
  }

  protected build(body: HTMLElement): void {
    const state = this.app.state;
    const flags = state?.flags ?? {};

    const cards = el('div', { class: 'choice-cards' });
    for (const id of this.choice.options) {
      const discipline = this.app.content.disciplines.get(id);
      if (!discipline) continue;
      cards.appendChild(this.card(discipline, disciplineUnlocked(discipline, flags)));
    }
    body.appendChild(cards);
  }

  private card(discipline: DisciplineDef, unlocked: boolean): HTMLElement {
    const card = el('div', {
      class: `ability-card discipline-card${unlocked ? '' : ' is-locked'}`,
    });

    card.appendChild(
      el(
        'div',
        { class: 'row' },
        painterCanvas(discipline.icon, 3, (ctx, size) => {
          resolvePainter(discipline.icon).draw(ctx, { x: 0, y: 0, size });
        }),
        el(
          'div',
          { class: 'stack tight' },
          el('h3', { text: discipline.name }),
          el('span', { class: 'muted tiny', text: discipline.blurb }),
        ),
      ),
    );

    card.appendChild(el('p', { text: discipline.description }));

    const grants = el('ul', { class: 'discipline-grants' });
    for (const entry of [...discipline.kit].sort((a, b) => a.level - b.level)) {
      const names =
        'ability' in entry
          ? [entry.ability]
          : 'choose' in entry
            ? [...entry.choose]
            : [...entry.specialize];
      const label = names.map((id) => this.app.content.abilities.get(id)?.name ?? id).join(' or ');
      grants.appendChild(el('li', { text: `Level ${entry.level} — ${label}` }));
    }
    card.appendChild(grants);

    card.appendChild(el('p', { class: 'muted tiny', text: discipline.flavor }));

    if (unlocked) {
      card.appendChild(
        button(`Take up ${discipline.name}`, () => this.pick(discipline.id), {
          class: 'btn-primary',
        }),
      );
    } else {
      card.appendChild(el('p', { class: 'locked-hint', text: discipline.lockedHint }));
      card.appendChild(button('Locked', () => {}, { class: 'btn-ghost', disabled: true }));
    }

    return card;
  }

  private pick(disciplineId: string): void {
    this.app.dispatch({ type: 'chooseDiscipline', unitId: this.choice.unitId, disciplineId });
    this.close();
  }
}
