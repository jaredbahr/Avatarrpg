/**
 * The level 3 / level 7 technique choice.
 *
 * Not dismissable: the choice is the reward, and leaving it hanging would let
 * a party walk into the next fight two abilities short. Both options are shown
 * in full — cost, range, what it does and what it leaves on the ground — so
 * picking is a real decision rather than a coin flip on the name.
 */

import type { App } from '../App';
import type { PendingChoice } from '../../core/types';
import { Dialog } from './Dialog';
import type { DialogOptions } from './Dialog';
import { button, el, painterCanvas } from './dom';
import { resolvePainter } from '../../render/painters/registry';
import { abilityCard } from './AbilityCard';

export class LevelUpDialog extends Dialog {
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
      title: `${who} reached level ${choice.level}`,
      subtitle: 'Pick one. The other stays available in a later act.',
      dismissable: false,
      wide: true,
    };
  }

  protected override onClose(): void {
    this.onDone();
  }

  protected build(body: HTMLElement): void {
    const unit = this.app.state?.party.find((u) => u.id === this.choice.unitId);

    if (unit) {
      const character = unit.characterId
        ? this.app.content.characters.get(unit.characterId)
        : undefined;
      if (character) {
        body.appendChild(
          el(
            'div',
            { class: 'row levelup-who' },
            painterCanvas(character.portrait, 4, (ctx, size) => {
              resolvePainter(character.portrait).draw(ctx, { x: 0, y: 0, size });
            }),
            el(
              'div',
              { class: 'stack tight' },
              el('strong', { text: character.name }),
              el('span', { class: 'muted tiny', text: character.blurb }),
            ),
          ),
        );
      }
    }

    const cards = el('div', { class: 'choice-cards' });
    for (const abilityId of this.choice.options) {
      const ability = this.app.content.abilities.get(abilityId);
      if (!ability) continue;

      const card = abilityCard(this.app.content, ability, { expanded: true });
      card.appendChild(
        button(`Learn ${ability.name}`, () => this.pick(abilityId), { class: 'btn-primary' }),
      );
      cards.appendChild(card);
    }
    body.appendChild(cards);
  }

  private pick(abilityId: string): void {
    this.app.dispatch({
      type: 'chooseLevelUp',
      unitId: this.choice.unitId,
      abilityId,
    });
    this.close();
  }
}
