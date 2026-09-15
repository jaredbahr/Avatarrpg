/**
 * Party setup.
 *
 * A strict sequence, because six people crowding one tablet needs a turn
 * order even here: pick how many are playing, then each person in turn types a
 * name, picks an element, picks a character, and confirms. Then a summary, then
 * Begin.
 *
 * Two rules that matter at a real table:
 *  - A character already taken cannot be taken again. Two Kayas is confusing
 *    for everyone and makes the turn banner useless.
 *  - The hand-off card between players is explicit, so nobody picks for
 *    somebody else while they are getting a drink.
 */

import type { App, Scene } from '../App';
import type { CharacterDef, ElementId } from '../../core/types';
import { button, clear, el, painterCanvas } from '../ui/dom';
import { resolvePainter } from '../../render/painters/registry';
import { defaultPlayerName } from '../session';

type Step = 'count' | 'handoff' | 'name' | 'element' | 'character' | 'summary';

interface Draft {
  name: string;
  element: ElementId | null;
  characterId: string | null;
}

export class PartySetupScene implements Scene {
  readonly name = 'setup';

  private host: HTMLElement | null = null;
  private step: Step = 'count';
  private playerCount = 2;
  private current = 0;
  private drafts: Draft[] = [];

  constructor(private app: App) {}

  mount(host: HTMLElement): void {
    this.host = host;
    this.render();
  }

  unmount(): void {
    this.host = null;
  }

  sync(): void {
    this.render();
  }

  /* ---------------------------------------------------------------- */

  private get elements() {
    return [...this.app.content.elements.values()];
  }

  private takenCharacterIds(): Set<string> {
    return new Set(
      this.drafts
        .map((d, index) => (index === this.current ? null : d.characterId))
        .filter((id): id is string => id !== null),
    );
  }

  private render(): void {
    const host = this.host;
    if (!host) return;
    clear(host);

    const scene = el('div', { class: 'scene setup-scene' });
    const panel = el('div', { class: 'panel setup-panel scroll' });

    switch (this.step) {
      case 'count':
        this.renderCount(panel);
        break;
      case 'handoff':
        this.renderHandoff(panel);
        break;
      case 'name':
        this.renderName(panel);
        break;
      case 'element':
        this.renderElement(panel);
        break;
      case 'character':
        this.renderCharacter(panel);
        break;
      case 'summary':
        this.renderSummary(panel);
        break;
    }

    scene.appendChild(panel);
    host.appendChild(scene);
  }

  /* ---------------------------------------------------------------- */

  private renderCount(panel: HTMLElement): void {
    panel.appendChild(el('h1', { text: 'Who is playing?' }));
    panel.appendChild(
      el('p', {
        class: 'muted',
        text: 'Everyone shares this screen and passes it along. One to six.',
      }),
    );

    const row = el('div', { class: 'row row-wrap count-row' });
    for (let n = 1; n <= 6; n++) {
      const node = button(
        String(n),
        () => {
          this.playerCount = n;
          this.render();
        },
        { class: n === this.playerCount ? 'btn-primary btn-count' : 'btn-count' },
      );
      node.setAttribute('aria-pressed', String(n === this.playerCount));
      node.setAttribute('aria-label', `${n} player${n === 1 ? '' : 's'}`);
      row.appendChild(node);
    }
    panel.appendChild(row);

    panel.appendChild(
      el('p', {
        class: 'muted tiny',
        text:
          this.playerCount === 1
            ? 'Playing alone: hand-off cards are skipped, and fights are scaled down to match.'
            : `${this.playerCount} players: each fight brings enough enemies to be a real fight.`,
      }),
    );

    panel.appendChild(
      el(
        'div',
        { class: 'row setup-footer' },
        button('Back', () => this.app.start(), { class: 'btn-ghost' }),
        el('div', { class: 'spacer' }),
        button('Continue', () => this.startDrafting(), { class: 'btn-primary btn-large' }),
      ),
    );
  }

  private startDrafting(): void {
    this.drafts = Array.from({ length: this.playerCount }, (_, index) => ({
      name: defaultPlayerName(index),
      element: null,
      characterId: null,
    }));
    this.current = 0;
    this.step = this.playerCount > 1 ? 'handoff' : 'name';
    this.render();
  }

  private renderHandoff(panel: HTMLElement): void {
    panel.classList.add('handoff');
    panel.appendChild(
      el('p', { class: 'muted', text: `Player ${this.current + 1} of ${this.playerCount}` }),
    );
    panel.appendChild(el('h1', { text: 'Pass the tablet along' }));
    panel.appendChild(el('p', { text: 'Next person: tap when you have it.' }));
    panel.appendChild(
      button(
        "I've got it",
        () => {
          this.step = 'name';
          this.render();
        },
        { class: 'btn-primary btn-large' },
      ),
    );
  }

  private renderName(panel: HTMLElement): void {
    const draft = this.drafts[this.current];
    if (!draft) return;

    panel.appendChild(
      el('p', { class: 'muted', text: `Player ${this.current + 1} of ${this.playerCount}` }),
    );
    panel.appendChild(el('h1', { text: 'What should we call you?' }));

    const input = el('input', {
      type: 'text',
      value: draft.name,
      placeholder: defaultPlayerName(this.current),
      attrs: { maxlength: '16', 'aria-label': 'Your name', autocomplete: 'off' },
      onInput: (event) => {
        draft.name = (event.target as HTMLInputElement).value;
      },
      onKeyDown: (event) => {
        if (event.key === 'Enter') this.finishName(input);
      },
    });
    panel.appendChild(el('div', { class: 'stack' }, input));
    panel.appendChild(
      el('p', { class: 'muted tiny', text: 'This is the name on the "hand the tablet to" card.' }),
    );

    panel.appendChild(
      el(
        'div',
        { class: 'row setup-footer' },
        button('Back', () => this.goBack(), { class: 'btn-ghost' }),
        el('div', { class: 'spacer' }),
        button('Next', () => this.finishName(input), { class: 'btn-primary btn-large' }),
      ),
    );

    window.setTimeout(() => input.focus(), 0);
  }

  private finishName(input: HTMLInputElement): void {
    const draft = this.drafts[this.current];
    if (!draft) return;
    const typed = input.value.trim();
    draft.name = typed.length > 0 ? typed : defaultPlayerName(this.current);
    this.step = 'element';
    this.render();
  }

  private renderElement(panel: HTMLElement): void {
    const draft = this.drafts[this.current];
    if (!draft) return;

    panel.appendChild(el('p', { class: 'muted', text: draft.name }));
    panel.appendChild(el('h1', { text: 'Pick your path' }));

    const grid = el('div', { class: 'card-grid' });
    for (const element of this.elements) {
      const selected = draft.element === element.id;
      const card = el(
        'button',
        {
          class: `pick-card element-${element.id}${selected ? ' selected' : ''}`,
          attrs: { 'aria-pressed': String(selected) },
          onClick: () => {
            draft.element = element.id;
            draft.characterId = null;
            this.render();
          },
        },
        el('h3', { text: element.name }),
        el('p', { class: 'tagline', text: element.tagline }),
        el('p', { class: 'tiny', text: element.playstyle }),
        el(
          'div',
          { class: 'row row-wrap chips' },
          el('span', { class: 'chip', text: `${element.base.maxHp} HP` }),
          el('span', { class: 'chip', text: `${element.base.maxAp} AP` }),
          el('span', { class: 'chip', text: `Power ${element.base.power}` }),
          el('span', { class: 'chip', text: `Speed ${element.base.speed}` }),
        ),
      );
      grid.appendChild(card);
    }
    panel.appendChild(grid);

    if (draft.element) {
      const chosen = this.app.content.elements.get(draft.element);
      if (chosen) panel.appendChild(el('p', { class: 'muted', text: chosen.description }));
    }

    panel.appendChild(
      el(
        'div',
        { class: 'row setup-footer' },
        button('Back', () => this.goBack(), { class: 'btn-ghost' }),
        el('div', { class: 'spacer' }),
        button(
          'Next',
          () => {
            this.step = 'character';
            this.render();
          },
          { class: 'btn-primary btn-large', disabled: draft.element === null },
        ),
      ),
    );
  }

  private renderCharacter(panel: HTMLElement): void {
    const draft = this.drafts[this.current];
    if (!draft?.element) return;

    const taken = this.takenCharacterIds();
    const options = [...this.app.content.characters.values()].filter(
      (c) => c.element === draft.element,
    );

    panel.appendChild(el('p', { class: 'muted', text: draft.name }));
    panel.appendChild(el('h1', { text: 'Pick your character' }));

    const grid = el('div', { class: 'card-grid' });
    for (const character of options) {
      const isTaken = taken.has(character.id);
      const selected = draft.characterId === character.id;
      grid.appendChild(this.characterCard(character, selected, isTaken, draft));
    }
    panel.appendChild(grid);

    if (options.every((c) => taken.has(c.id))) {
      panel.appendChild(
        el('p', {
          class: 'warn-note',
          text: 'Both characters of this element are taken. Go back and pick another path.',
        }),
      );
    }

    panel.appendChild(
      el(
        'div',
        { class: 'row setup-footer' },
        button('Back', () => this.goBack(), { class: 'btn-ghost' }),
        el('div', { class: 'spacer' }),
        button('Confirm', () => this.confirmPlayer(), {
          class: 'btn-primary btn-large',
          disabled: draft.characterId === null,
        }),
      ),
    );
  }

  private characterCard(
    character: CharacterDef,
    selected: boolean,
    taken: boolean,
    draft: Draft,
  ): HTMLElement {
    const card = el(
      'button',
      {
        class: `pick-card character-card element-${character.element}${selected ? ' selected' : ''}${taken ? ' taken' : ''}`,
        disabled: taken,
        attrs: { 'aria-pressed': String(selected) },
        onClick: () => {
          draft.characterId = character.id;
          this.render();
        },
      },
      painterCanvas(character.portrait, 5, (ctx, size) => {
        resolvePainter(character.portrait).draw(ctx, { x: 0, y: 0, size });
      }),
      el('h3', { text: character.name }),
      el('p', { class: 'tagline', text: character.blurb }),
      el('p', { class: 'tiny muted', text: character.bio }),
      taken ? el('span', { class: 'chip chip-warn', text: 'Already taken' }) : null,
    );
    return card;
  }

  private confirmPlayer(): void {
    if (this.current + 1 < this.playerCount) {
      this.current += 1;
      this.step = 'handoff';
    } else {
      this.step = 'summary';
    }
    this.render();
  }

  private goBack(): void {
    switch (this.step) {
      case 'character':
        this.step = 'element';
        break;
      case 'element':
        this.step = 'name';
        break;
      case 'name':
        if (this.current > 0) {
          this.current -= 1;
          this.step = 'character';
        } else {
          this.step = 'count';
        }
        break;
      case 'handoff':
        if (this.current > 0) {
          this.current -= 1;
          this.step = 'character';
        } else {
          this.step = 'count';
        }
        break;
      case 'summary':
        this.current = this.playerCount - 1;
        this.step = 'character';
        break;
      default:
        this.app.start();
        return;
    }
    this.render();
  }

  private renderSummary(panel: HTMLElement): void {
    panel.appendChild(el('h1', { text: 'The party' }));
    panel.appendChild(
      el('p', { class: 'muted', text: 'Check the names, then begin. You can pause at any time.' }),
    );

    const list = el('div', { class: 'card-grid' });
    for (const draft of this.drafts) {
      const character = draft.characterId
        ? this.app.content.characters.get(draft.characterId)
        : undefined;
      if (!character) continue;
      list.appendChild(
        el(
          'div',
          { class: `pick-card element-${character.element}` },
          painterCanvas(character.portrait, 4, (ctx, size) => {
            resolvePainter(character.portrait).draw(ctx, { x: 0, y: 0, size });
          }),
          el('h3', { text: character.name }),
          el('p', { class: 'tagline', text: draft.name }),
        ),
      );
    }
    panel.appendChild(list);

    panel.appendChild(
      el(
        'div',
        { class: 'row setup-footer' },
        button('Back', () => this.goBack(), { class: 'btn-ghost' }),
        el('div', { class: 'spacer' }),
        button('Begin', () => this.begin(), { class: 'btn-primary btn-large', id: 'begin-game' }),
      ),
    );
  }

  private begin(): void {
    const players = this.drafts.map((draft) => ({ name: draft.name, unitId: '' }));
    const slots = this.drafts
      .filter((draft): draft is Draft & { characterId: string } => draft.characterId !== null)
      .map((draft) => ({ characterId: draft.characterId }));

    if (slots.length !== this.drafts.length) {
      this.app.toasts.show('Somebody still needs to pick a character.', 'warn');
      return;
    }

    this.app.newGame(players, slots);
  }
}
