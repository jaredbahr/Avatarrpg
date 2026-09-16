/**
 * Credits.
 *
 * Some of the licences this project accepts ask for the author to be named
 * wherever the work is used, and a file in the repository is not "wherever
 * the work is used" — the game is. So the pause menu carries the same list
 * the `NOTICE` file carries, generated from `src/content/credits.ts` so the
 * two cannot drift apart.
 */

import type { CreditEntry } from '../../content/credits';
import { CREDITS, needsAttribution, thirdParty } from '../../content/credits';
import { Dialog } from './Dialog';
import type { DialogOptions } from './Dialog';
import { button, el } from './dom';

export class CreditsDialog extends Dialog {
  protected options: DialogOptions = {
    title: 'Credits',
    subtitle: 'Everything in the game that someone else made, and who made it.',
    dismissable: true,
    wide: true,
  };

  protected build(body: HTMLElement): void {
    const outside = thirdParty(CREDITS);

    if (outside.length === 0) {
      body.appendChild(
        el('p', { class: 'muted', text: 'Everything here was made for this project.' }),
      );
    } else {
      body.appendChild(el('div', { class: 'stack credit-list' }, ...outside.map(entryRow)));
    }

    body.appendChild(el('hr', { class: 'rule' }));
    body.appendChild(
      el('p', {
        class: 'muted tiny',
        text: 'A fan project made for one family. Not for sale and not for distribution.',
      }),
    );
    body.appendChild(button('Done', () => this.close(), { class: 'btn-primary' }));
  }
}

function entryRow(entry: CreditEntry): HTMLElement {
  return el(
    'div',
    { class: 'credit' },
    el('strong', { class: 'credit-what', text: entry.what }),
    el('span', { class: 'credit-work', text: entry.work }),
    el('span', {
      class: 'credit-by',
      // The wording attribution licences ask for: the work, and who made it.
      text: needsAttribution(entry.licence)
        ? `by ${entry.authors} · ${entry.licence}`
        : `${entry.authors} · ${entry.licence}`,
    }),
  );
}
